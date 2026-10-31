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

/** what the Bluetooth scanner reports (tools/bluetooth/scan.py): who is near and where, never a device address */
export const PRESENCE = {
  /** a user id is a short label from the scanner's config file, never a name or an address */
  userIdPattern: /^[A-Za-z0-9_-]{1,32}$/,
  minRssi: -127,
  maxRssi: 0,
  /** the only fields a presence message may carry: anything else (an address, a name) is refused, not stored */
  fields: ['id', 'type', 'userId', 'place', 'rssi', 'demo'],
} as const;
export interface PresenceRequest {
  id: string;
  type: 'presence';
  /** null = no known person found */
  userId: string | null;
  /** null = no known place found */
  place: PlaceName | null;
  /** signal strength in dBm of the device that gave userId (or the place, when there is no user); null when nothing was found */
  rssi: number | null;
  /** true when the device is simulated (scan.py --fake): the app says so */
  demo: boolean;
}

/** a letter recognised by another program (tools/dollarpy/classify_live.py): the app shows it and the person adds it by pointing */
export const LETTER_MSG = {
  /** who recognised it: a short lowercase label such as 'dollarpy' */
  sourcePattern: /^[a-z][a-z0-9_-]{1,23}$/,
  fields: ['id', 'type', 'letter', 'score', 'source', 'demo'],
} as const;
export interface LetterRequest {
  id: string;
  type: 'letter';
  /** exactly one letter of any script; the app checks it against its alphabet */
  letter: string;
  /** match score 0..1 (for $P: (2 - distance) / 2). Not a probability of being right */
  score: number;
  source: string;
  /** true when the input is simulated (tools/dollarpy/classify_live.py --simulate): the app says so */
  demo: boolean;
}
export type ClientMessage = SuggestRequest | PingRequest | PresenceRequest | LetterRequest;

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
export interface PresenceOk {
  id: string;
  ok: true;
  type: 'presence';
}
export interface LetterOk {
  id: string;
  ok: true;
  type: 'letter';
}
export interface Failure {
  id: string;
  ok: false;
  error: 'bad_request' | 'too_large' | 'rate_limited' | 'server_error';
  message: string;
}
export type ServerMessage = SuggestOk | PongOk | PresenceOk | LetterOk | Failure;

/** pushed by the server to every connected app (no id: nobody asked for it) when the Bluetooth presence changes */
export interface ContextPush {
  type: 'context';
  userId: string | null;
  place: PlaceName | null;
  demo: boolean;
}

/** strict check of a pushed message, in the browser: anything that does not fit is ignored */
export function parseContextPush(text: string): ContextPush | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || (raw as { type?: unknown }).type !== 'context')
    return null;
  const o = raw as Record<string, unknown>;
  const userId = o.userId ?? null;
  const place = o.place ?? null;
  if (userId !== null && (typeof userId !== 'string' || !PRESENCE.userIdPattern.test(userId)))
    return null;
  if (place !== null && !PLACES.includes(place as PlaceName)) return null;
  return {
    type: 'context',
    userId: userId as string | null,
    place: place as PlaceName | null,
    demo: o.demo === true,
  };
}

/** pushed to the apps when another program recognised a letter (not stored: a late app does not get an old letter) */
export interface LetterPush {
  type: 'letter';
  letter: string;
  score: number;
  source: string;
  demo: boolean;
}

export function parseLetterPush(text: string): LetterPush | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object' || (raw as { type?: unknown }).type !== 'letter') return null;
  const o = raw as Record<string, unknown>;
  const p = parseLetter({ ...o, id: 'x' }, 'x');
  return p.ok && p.msg.type === 'letter'
    ? {
        type: 'letter',
        letter: p.msg.letter,
        score: p.msg.score,
        source: p.msg.source,
        demo: p.msg.demo,
      }
    : null;
}

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
  if (o.type === 'presence') return parsePresence(o, id);
  if (o.type === 'letter') return parseLetter(o, id);
  if (o.type !== 'suggest')
    return { ok: false, id, message: "'type' must be 'suggest', 'presence', 'letter' or 'ping'" };
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

function parsePresence(o: Record<string, unknown>, id: string): Parsed {
  const bad = (message: string): Parsed => ({ ok: false, id, message });
  // a closed list of fields: a device address or name must not slip into the server's memory or logs
  const extra = Object.keys(o).find((k) => !(PRESENCE.fields as readonly string[]).includes(k));
  if (extra !== undefined)
    return bad(
      `unknown field '${extra.slice(0, 20)}' (device addresses and names must not be sent)`,
    );
  const userId = o.userId ?? null;
  if (userId !== null && (typeof userId !== 'string' || !PRESENCE.userIdPattern.test(userId)))
    return bad("'userId' must be null or 1 to 32 letters, digits, '-' or '_'");
  const place = o.place ?? null;
  if (place !== null && !PLACES.includes(place as PlaceName))
    return bad(`'place' must be null or one of ${PLACES.join(', ')}`);
  const rssi = o.rssi ?? null;
  if (userId === null && place === null) {
    if (rssi !== null) return bad("'rssi' must be null when nothing was found");
  } else if (
    !Number.isInteger(rssi) ||
    (rssi as number) < PRESENCE.minRssi ||
    (rssi as number) > PRESENCE.maxRssi
  )
    return bad(
      `'rssi' must be a whole number of dBm from ${PRESENCE.minRssi} to ${PRESENCE.maxRssi}`,
    );
  if (o.demo !== undefined && typeof o.demo !== 'boolean')
    return bad("'demo' must be true or false");
  return {
    ok: true,
    msg: {
      id,
      type: 'presence',
      userId: userId as string | null,
      place: place as PlaceName | null,
      rssi: rssi as number | null,
      demo: o.demo === true,
    },
  };
}

function parseLetter(o: Record<string, unknown>, id: string): Parsed {
  const bad = (message: string): Parsed => ({ ok: false, id, message });
  const extra = Object.keys(o).find((k) => !(LETTER_MSG.fields as readonly string[]).includes(k));
  if (extra !== undefined) return bad(`unknown field '${extra.slice(0, 20)}'`);
  const letter = o.letter;
  if (typeof letter !== 'string' || [...letter].length !== 1 || !/^\p{L}$/u.test(letter))
    return bad("'letter' must be exactly one letter");
  const score = o.score;
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 1)
    return bad("'score' must be a number from 0 to 1");
  const source = o.source;
  if (typeof source !== 'string' || !LETTER_MSG.sourcePattern.test(source))
    return bad("'source' must be a short lowercase label such as 'dollarpy'");
  if (o.demo !== undefined && typeof o.demo !== 'boolean')
    return bad("'demo' must be true or false");
  return { ok: true, msg: { id, type: 'letter', letter, score, source, demo: o.demo === true } };
}
