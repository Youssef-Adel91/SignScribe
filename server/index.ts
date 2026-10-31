import { createServer } from 'node:http';
import { createServer as createTcp } from 'node:net';
import { WebSocketServer } from 'ws';
import { LIMITS, type ContextPush } from '../src/nlp/protocol.ts';
import { loadConfig, type Config } from './config.ts';
import { RateLimiter, both, handleMessage } from './handler.ts';
import { AnthropicProvider, FakeProvider, type SentenceProvider } from './llm.ts';
import { PresenceStore } from './presence.ts';
import { SentenceService } from './sentences.ts';
import { selfTest, type SelfTest } from './selftest.ts';

export function makeProvider(c: Config): SentenceProvider | null {
  if (c.provider === 'anthropic') return new AnthropicProvider(c.apiKey, c.model);
  if (c.provider === 'fake') return new FakeProvider();
  return null;
}

export interface Running {
  wsPort: number;
  tcpPort: number;
  close(): Promise<void>;
}

/**
 * Two doors to one service: WebSocket for the browser app (browsers cannot open raw sockets) and a plain
 * TCP socket with one JSON message per line, for clients written like the lab's Python socket client.
 * It listens on 127.0.0.1 unless HOST says otherwise.
 */
export async function start(
  config: Config = loadConfig(),
  log: (line: string) => void = (l) => console.log(l),
  deps: { selfTest?: () => Promise<SelfTest> } = {},
): Promise<Running> {
  // with a key, ask the API once now: a wrong model name or key must be loud, not a silent fallback
  let llm: SelfTest | null = null;
  if (config.provider === 'anthropic') {
    llm = await (deps.selfTest ?? (() => selfTest(config.apiKey, config.model)))();
    if (llm.ok) log(`language model check: ok (${config.model})`);
    else {
      log(`!!! WARNING: the language model does not work (${llm.kind}): ${llm.message}`);
      log('!!! Every sentence will come from the offline rules until this is fixed.');
    }
  }
  const service = new SentenceService({
    provider: makeProvider(config),
    timeoutMs: config.llmTimeoutMs,
    log,
  });

  const presence = new PresenceStore(config.presenceTtlMs, config.presenceRateLimit, log);

  // ---- WebSocket (+ /health)
  const http = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          provider: config.provider,
          languageModel: llm === null ? 'not used' : llm.ok ? 'ok' : `failed: ${llm.kind}`,
        }),
      );
    } else {
      res.writeHead(404).end();
    }
  });
  // limits for the whole server: one busy or hostile client must not use up the API budget or the sockets
  const globalLimiter = new RateLimiter(config.globalRateLimit);
  const sockets = new Set<import('node:net').Socket>();
  const open = () => wss.clients.size + sockets.size;
  const wss = new WebSocketServer({
    server: http,
    maxPayload: LIMITS.maxMessage,
    verifyClient: ({ origin }: { origin?: string }) =>
      config.origins.includes('*') || (!!origin && config.origins.includes(origin)),
  });
  const pushContext = (socket: import('ws').WebSocket, p = presence.current()) => {
    if (socket.readyState !== socket.OPEN) return;
    const msg: ContextPush = { type: 'context', userId: p.userId, place: p.place, demo: p.demo };
    socket.send(JSON.stringify(msg));
  };
  // every connected app hears about a change at once; a new app hears the current state when it connects
  presence.subscribe((p) => {
    for (const c of wss.clients) pushContext(c, p);
  });
  const expiry = setInterval(() => presence.tick(), 1000);
  expiry.unref();
  wss.on('connection', (socket) => {
    if (open() > config.maxConnections) {
      socket.close(1013, 'server busy'); // 1013: try again later
      return;
    }
    if (presence.current().userId || presence.current().place) pushContext(socket);
    const limiter = both(new RateLimiter(config.rateLimit), globalLimiter);
    socket.on('message', (data) => {
      void handleMessage(data.toString(), service, limiter, Date.now(), { presence }).then(
        (out) => socket.readyState === socket.OPEN && socket.send(JSON.stringify(out)),
      );
    });
    socket.on('error', () => {});
  });

  // ---- plain TCP, one JSON message per line
  const tcp = createTcp((socket) => {
    if (open() >= config.maxConnections) {
      socket.end(
        JSON.stringify({
          id: '',
          ok: false,
          error: 'rate_limited',
          message: 'server busy, try again later',
        }) + '\n',
      );
      return;
    }
    sockets.add(socket);
    socket.setEncoding('utf8');
    const limiter = both(new RateLimiter(config.rateLimit), globalLimiter);
    let buf = '';
    socket.on('data', (chunk: string) => {
      buf += chunk;
      if (buf.length > LIMITS.maxMessage * 2 && !buf.includes('\n')) {
        socket.end(
          JSON.stringify({ id: '', ok: false, error: 'too_large', message: 'message too large' }) +
            '\n',
        );
        return;
      }
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (line)
          void handleMessage(line, service, limiter, Date.now(), { presence }).then(
            (out) => !socket.destroyed && socket.write(JSON.stringify(out) + '\n'),
          );
      }
    });
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
  });

  await new Promise<void>((r) => http.listen(config.wsPort, config.host, r));
  await new Promise<void>((r) => tcp.listen(config.tcpPort, config.host, r));
  const wsPort = (http.address() as import('node:net').AddressInfo).port;
  const tcpPort = (tcp.address() as import('node:net').AddressInfo).port;
  const loopback = ['127.0.0.1', '::1', 'localhost'].includes(config.host);
  if (!loopback && config.provider === 'anthropic')
    log(
      `!!! WARNING: HOST=${config.host} makes the server reachable from the network while it holds your API key. Anyone who can connect spends your quota. Use 127.0.0.1, or put it behind a proxy that checks who is calling (server/README.md).`,
    );
  if (config.origins.includes('*') && config.provider === 'anthropic')
    log(
      '!!! WARNING: ALLOWED_ORIGINS=* lets any web page use your API key through this server (and the plain TCP socket has no origin check at all).',
    );
  log(
    `sentence server: WebSocket ws://${config.host}:${wsPort}, TCP ${config.host}:${tcpPort}, provider ${config.provider}`,
  );

  return {
    wsPort,
    tcpPort,
    async close() {
      clearInterval(expiry);
      for (const c of wss.clients) c.terminate();
      for (const s of sockets) s.destroy();
      await new Promise<void>((r) => wss.close(() => r()));
      await new Promise<void>((r) => http.close(() => r()));
      await new Promise<void>((r) => tcp.close(() => r()));
    },
  };
}

// run directly: node server/index.ts
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const config = loadConfig();
  if (config.provider === 'offline')
    console.log(
      'No ANTHROPIC_API_KEY: answering with the offline rules only (set it in .env to use the language model).',
    );
  start(config).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
