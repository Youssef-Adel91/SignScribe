import { createServer } from 'node:http';
import { createServer as createTcp } from 'node:net';
import { WebSocketServer } from 'ws';
import { LIMITS } from '../src/nlp/protocol.ts';
import { loadConfig, type Config } from './config.ts';
import { RateLimiter, handleMessage } from './handler.ts';
import { AnthropicProvider, FakeProvider, type SentenceProvider } from './llm.ts';
import { SentenceService } from './sentences.ts';

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
): Promise<Running> {
  const service = new SentenceService({
    provider: makeProvider(config),
    timeoutMs: config.llmTimeoutMs,
    log,
  });

  // ---- WebSocket (+ /health)
  const http = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, provider: config.provider }));
    } else {
      res.writeHead(404).end();
    }
  });
  const wss = new WebSocketServer({
    server: http,
    maxPayload: LIMITS.maxMessage,
    verifyClient: ({ origin }: { origin?: string }) =>
      config.origins.includes('*') || (!!origin && config.origins.includes(origin)),
  });
  wss.on('connection', (socket) => {
    const limiter = new RateLimiter(config.rateLimit);
    socket.on('message', (data) => {
      void handleMessage(data.toString(), service, limiter).then(
        (out) => socket.readyState === socket.OPEN && socket.send(JSON.stringify(out)),
      );
    });
    socket.on('error', () => {});
  });

  // ---- plain TCP, one JSON message per line
  const sockets = new Set<import('node:net').Socket>();
  const tcp = createTcp((socket) => {
    sockets.add(socket);
    socket.setEncoding('utf8');
    const limiter = new RateLimiter(config.rateLimit);
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
          void handleMessage(line, service, limiter).then(
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
  log(
    `sentence server: WebSocket ws://${config.host}:${wsPort}, TCP ${config.host}:${tcpPort}, provider ${config.provider}`,
  );

  return {
    wsPort,
    tcpPort,
    async close() {
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
