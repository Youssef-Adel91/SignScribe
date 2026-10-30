/**
 * Messages between the app (or any socket client) and the sentence server. One JSON object per message:
 * a text frame over WebSocket, or one line over a plain TCP socket (like the lab clients). Documented in
 * server/README.md. Free of imports and of syntax Node cannot strip, like validate.ts.
 */
export const PLACES = ['Clinic', 'Shop', 'Work', 'Home'] as const;
export type PlaceName = (typeof PLACES)[number];
/** which sign alphabet the words were spelt in; no field means 'asl' (English) */
export const ALPHABET_IDS = ['asl', 'arsl'] as const;
export type AlphabetId = (typeof ALPHABET_IDS)[number];
/** Arabic letters (with their marks and presentation forms) and spaces: what an ArSL word is made of */
const ARABIC_WORD = /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF ]+$/;

export const LIMITS = {
  /** bytes in one message */
  maxMessage: 4096,
  maxWords: 12,
  maxWordChars: 30,
  maxAvoid: 3,
  maxAvoidChars: 200,
  maxAttempt: 50,
} as const;

export interface SuggestRequest {
  id: string;
  type: 'suggest';
  words: string[];
  place: PlaceName;
  /** 0 for the first suggestion, +1 for every "try another" */
  attempt: number;
  /** left out = 'asl'. With 'arsl' the words are Arabic and the server skips the English-only checks (see validate.ts) */
  alphabet?: AlphabetId;
  /** sentences already shown, so the server can give a different wording */
  avoid?: string[];
}
export interface PingRequest {
  id: string;
  type: 'ping';
}
export type ClientMessage = SuggestRequest | PingRequest;

export type Source = 'llm' | 'offline';

export interface SuggestOk {
  id: string;
  ok: true;
  type: 'suggest';
  sentence: string;
  source: Source;
  /** why the offline sentence was used instead of the language model, when it was */
  note?: string;
}
export interface PongOk {
  id: string;
  ok: true;
  type: 'pong';
}
export interface Failure {
  id: string;
  ok: false;
  error: 'bad_request' | 'too_large' | 'rate_limited' | 'server_error';
  message: string;
}
export type ServerMessage = SuggestOk | PongOk | Failure;

export type Parsed = { ok: true; msg: ClientMessage } | { ok: false; id: string; message: string };

/** strict parsing of untrusted input: anything that does not fit is refused with a plain reason */
export function parseRequest(text: string): Parsed {
  if (text.length > LIMITS.maxMessage) return { ok: false, id: '', message: 'message too large' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, id: '', message: 'not valid JSON' };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    return { ok: false, id: '', message: 'expected a JSON object' };
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' && o.id.length <= 64 ? o.id : '';
  if (!id) return { ok: false, id: '', message: "'id' must be a string of at most 64 characters" };
  if (o.type === 'ping') return { ok: true, msg: { id, type: 'ping' } };
  if (o.type !== 'suggest') return { ok: false, id, message: "'type' must be 'suggest' or 'ping'" };
  const words = o.words;
  if (!Array.isArray(words) || words.length < 1 || words.length > LIMITS.maxWords)
    return { ok: false, id, message: `'words' must be 1 to ${LIMITS.maxWords} words` };
  if (o.alphabet !== undefined && !ALPHABET_IDS.includes(o.alphabet as AlphabetId))
    return { ok: false, id, message: `'alphabet' must be one of ${ALPHABET_IDS.join(', ')}` };
  const alphabet: AlphabetId = (o.alphabet as AlphabetId | undefined) ?? 'asl';
  for (const w of words) {
    if (
      typeof w !== 'string' ||
      w.length > LIMITS.maxWordChars ||
      !(alphabet === 'arsl' ? ARABIC_WORD : /^[A-Za-z][A-Za-z' ]*$/).test(w.trim())
    )
      return {
        ok: false,
        id,
        message:
          alphabet === 'arsl'
            ? 'each word must be Arabic letters only (spaces allowed)'
            : 'each word must be letters only (spaces and apostrophes allowed)',
      };
  }
  if (!PLACES.includes(o.place as PlaceName))
    return { ok: false, id, message: `'place' must be one of ${PLACES.join(', ')}` };
  const attempt = o.attempt === undefined ? 0 : o.attempt;
  if (
    !Number.isInteger(attempt) ||
    (attempt as number) < 0 ||
    (attempt as number) > LIMITS.maxAttempt
  )
    return {
      ok: false,
      id,
      message: "'attempt' must be a whole number from 0 to " + LIMITS.maxAttempt,
    };
  let avoid: string[] | undefined;
  if (o.avoid !== undefined) {
    if (
      !Array.isArray(o.avoid) ||
      o.avoid.length > LIMITS.maxAvoid ||
      o.avoid.some((a) => typeof a !== 'string' || a.length > LIMITS.maxAvoidChars)
    )
      return { ok: false, id, message: `'avoid' must be at most ${LIMITS.maxAvoid} short strings` };
    avoid = o.avoid as string[];
  }
  return {
    ok: true,
    msg: {
      id,
      type: 'suggest',
      words: (words as string[]).map((w) => w.trim()),
      place: o.place as PlaceName,
      attempt: attempt as number,
      ...(alphabet === 'arsl' ? { alphabet } : {}),
      ...(avoid ? { avoid } : {}),
    },
  };
}
