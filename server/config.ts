export interface Config {
  host: string;
  wsPort: number;
  tcpPort: number;
  apiKey: string;
  model: string;
  /** exact origins allowed to open a WebSocket; '*' = any */
  origins: string[];
  llmTimeoutMs: number;
  /** requests allowed per connection in a 10 s window */
  rateLimit: number;
  /** requests allowed from ALL connections together in a 10 s window (protects the API budget) */
  globalRateLimit: number;
  /** WebSocket + TCP connections open at the same time; more are refused */
  maxConnections: number;
  /** presence messages (Bluetooth scanner) accepted from everyone together in a 10 s window */
  presenceRateLimit: number;
  /** letters from the dollarpy client accepted from everyone together in a 10 s window */
  letterRateLimit: number;
  /** a letter that reached no app is kept this long for the next app that connects (0 = never) */
  letterHoldMs: number;
  /** a presence that is not refreshed for this long is forgotten (the scanner sends a heartbeat) */
  presenceTtlMs: number;
  /** 'anthropic' (needs a key), 'offline' (rules only) or 'fake' (deterministic, for tests) */
  provider: 'anthropic' | 'offline' | 'fake';
}

const num = (v: string | undefined, d: number): number => {
  const n = Number(v);
  return v !== undefined && v !== '' && Number.isFinite(n) && n >= 0 ? n : d;
};

/** Reads the environment (.env is loaded by `node --env-file-if-exists`). Nothing here is ever sent to a client. */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const apiKey = (env.ANTHROPIC_API_KEY ?? '').trim();
  const asked = (env.SENTENCE_PROVIDER ?? '').trim();
  const provider =
    asked === 'fake' ? 'fake' : asked === 'offline' ? 'offline' : apiKey ? 'anthropic' : 'offline';
  return {
    host: env.HOST?.trim() || '127.0.0.1',
    wsPort: num(env.WS_PORT, 8787),
    tcpPort: num(env.TCP_PORT, 8788),
    apiKey,
    model: env.SENTENCE_MODEL?.trim() || 'claude-haiku-4-5-20251001',
    origins: (
      env.ALLOWED_ORIGINS ??
      'http://localhost:5173,http://localhost:4173,http://127.0.0.1:5173,http://127.0.0.1:4173'
    )
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    llmTimeoutMs: num(env.LLM_TIMEOUT_MS, 4000),
    rateLimit: num(env.RATE_LIMIT, 20),
    globalRateLimit: num(env.GLOBAL_RATE_LIMIT, 100),
    maxConnections: num(env.MAX_CONNECTIONS, 30),
    presenceRateLimit: num(env.PRESENCE_RATE_LIMIT, 10),
    presenceTtlMs: num(env.PRESENCE_TTL_MS, 15000),
    letterRateLimit: num(env.LETTER_RATE_LIMIT, 10),
    letterHoldMs: num(env.LETTER_HOLD_MS, 5000),
    provider,
  };
}
