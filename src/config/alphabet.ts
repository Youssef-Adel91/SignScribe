import active from '../../config/alphabet.json';

/**
 * The label set (which letters exist, which are drawn in the air) comes from config/alphabets/*.json, the same
 * files the Python tools read, and config/alphabet.json says which one is active. Set VITE_ALPHABET=arsl at build
 * time to use another one. Nothing in the code lists letters.
 */
export interface AlphabetConfig {
  id: string;
  name: string;
  /** false for a template nobody has checked against a dataset yet */
  reviewed: boolean;
  static: string[];
  dynamic: string[];
  aliases: Record<string, string>;
  /** label -> the letter to show a person, only where it is certain */
  display: Record<string, string | null>;
  /** open questions the team still has to answer (see config/alphabets/arsl.json) */
  todo: unknown[];
  /** 'arabic' = text is written right to left */
  script: 'latin' | 'arabic';
  /**
   * Classes that are commands, not letters (class id -> what it does). Only what the alphabet file lists exists:
   * arsl.json lists none, so the hand gestures stay the way to give Space / Delete / Done.
   */
  controls: Record<string, ControlName>;
}

/**
 * The class a model may have for "no letter": a hand that is moving, relaxed, or in the command zone. It is not part of any alphabet
 * file. A take with this label is recorded by the collection mode, and a model that predicts it is shown as nothing.
 */
export const REJECT_LABEL = 'none';

/**
 * What a control class does: start a new word (space), take the last letter back (delete), go back / cancel (cancel), finish (done).
 * The old name 'finish' is read as 'done'.
 */
export type ControlName = 'space' | 'delete' | 'cancel' | 'done';
const CONTROL_NAMES: readonly ControlName[] = ['space', 'delete', 'cancel', 'done'];

const files = import.meta.glob<Partial<AlphabetConfig>>('../../config/alphabets/*.json', {
  eager: true,
  import: 'default',
});

export function parseAlphabet(raw: Partial<AlphabetConfig>, fallbackId: string): AlphabetConfig {
  const stat = raw.static ?? [];
  const dyn = raw.dynamic ?? [];
  const all = [...stat, ...dyn];
  if (all.length === 0) throw new Error(`alphabet "${fallbackId}" has no labels`);
  if (new Set(all).size !== all.length)
    throw new Error(`alphabet "${fallbackId}" lists a label twice`);
  // a label is one letter (ASL: "A") or a short name without spaces (ArSL21L: "ain")
  if (all.some((l) => typeof l !== 'string' || l.length < 1 || l.length > 16 || /\s/.test(l)))
    throw new Error(
      `alphabet "${fallbackId}": every label must be 1 to 16 characters without spaces`,
    );
  const rawControls = ((raw as { controls?: unknown }).controls ?? {}) as Record<string, unknown>;
  const controls: Record<string, ControlName> = {};
  for (const [cls, what] of Object.entries(rawControls)) {
    if (!all.includes(cls))
      throw new Error(`alphabet "${fallbackId}": control class "${cls}" is not a label`);
    const action = what === 'finish' ? 'done' : what; // the old name
    if (!CONTROL_NAMES.includes(action as ControlName))
      throw new Error(
        `alphabet "${fallbackId}": control "${String(what)}" is not one of ${CONTROL_NAMES.join(', ')}`,
      );
    if (Object.values(controls).includes(action as ControlName))
      throw new Error(`alphabet "${fallbackId}": two classes do the control "${action}"`);
    controls[cls] = action as ControlName;
  }
  const script = (raw as { script?: unknown }).script;
  return {
    id: raw.id ?? fallbackId,
    name: raw.name ?? fallbackId,
    reviewed: raw.reviewed ?? true,
    static: stat,
    dynamic: dyn,
    aliases: raw.aliases ?? {},
    display: raw.display ?? {},
    todo: raw.todo ?? [],
    script: script === 'arabic' ? 'arabic' : 'latin',
    controls,
  };
}

/** `?alphabet=arsl` picks the active alphabet from the address (the collection page and the tools in the browser) */
function fromAddress(): string | undefined {
  try {
    return new URLSearchParams(window.location.search).get('alphabet') ?? undefined;
  } catch {
    return undefined;
  }
}

export function loadAlphabet(name?: string): AlphabetConfig {
  const wanted = name ?? fromAddress() ?? import.meta.env.VITE_ALPHABET ?? active.active;
  const hit = Object.entries(files).find(([path]) => path.endsWith(`/${wanted}.json`));
  if (!hit)
    throw new Error(
      `no alphabet "${wanted}" in config/alphabets (have: ${Object.keys(files).join(', ')})`,
    );
  return parseAlphabet(hit[1], wanted);
}

export const ALPHABET = loadAlphabet();
/** every label, static ones first */
export const ALPHABET_LABELS: readonly string[] = [...ALPHABET.static, ...ALPHABET.dynamic];

/* ---------- what a person sees for a class ---------- */

/** the alphabets the app can be set to, by the setting's name -> alphabet file id */
export const ALPHABET_OF_SETTING = { english: 'asl', arabic: 'arsl' } as const;
export type SettingAlphabet = keyof typeof ALPHABET_OF_SETTING;

const cache = new Map<string, AlphabetConfig>();
export function getAlphabet(id: string): AlphabetConfig {
  let a = cache.get(id);
  if (!a) {
    a = loadAlphabet(id);
    cache.set(id, a);
  }
  return a;
}

/** the alphabet file for a setting value ('english' | 'arabic'); anything else is treated as English */
export const alphabetOfSetting = (setting: string): AlphabetConfig =>
  getAlphabet(ALPHABET_OF_SETTING[setting as SettingAlphabet] ?? 'asl');

/** an unconfirmed class is written in its Latin id between these marks, so it is never mistaken for a real letter */
export const UNCONFIRMED_OPEN = '\u27e8';
export const UNCONFIRMED_CLOSE = '\u27e9';

export interface Glyph {
  text: string;
  /** false: the team has not confirmed which letter this class is, `text` is the class id in marks */
  confirmed: boolean;
}

/**
 * The glyph for a class id. An alphabet with a `display` table (ArSL) shows the table's letter ONLY where the table has one
 * and the class is not in a `todo` question; otherwise the Latin class id is shown, in marks, as unconfirmed. An alphabet
 * without a table (ASL) shows the letter itself, as it always did. Nothing is guessed.
 */
export function glyphOf(a: AlphabetConfig, classId: string): Glyph {
  if (Object.keys(a.display).length === 0)
    return { text: classId.toUpperCase().slice(0, 1), confirmed: true };
  const shown = a.display[classId];
  const open = a.todo.some((t) => (t as { classes?: string[] })?.classes?.includes(classId));
  if (typeof shown === 'string' && shown.length > 0 && !open)
    return { text: shown, confirmed: true };
  return { text: `${UNCONFIRMED_OPEN}${classId}${UNCONFIRMED_CLOSE}`, confirmed: false };
}

/** the text of a word with its last letter removed (a glyph can be 2 characters, like ال, or a marked class id) */
export function dropLastGlyph(a: AlphabetConfig, word: string): string {
  if (word.endsWith(UNCONFIRMED_CLOSE)) {
    const i = word.lastIndexOf(UNCONFIRMED_OPEN);
    if (i >= 0) return word.slice(0, i);
  }
  let n = 1;
  for (const l of [...a.static, ...a.dynamic]) {
    const g = glyphOf(a, l);
    if (g.confirmed && g.text.length > n && word.endsWith(g.text)) n = g.text.length;
  }
  return word.slice(0, -n);
}

/** does this text contain a letter nobody has confirmed yet? (the person must not be sent it as if it were a word) */
export const hasUnconfirmed = (text: string): boolean => text.includes(UNCONFIRMED_OPEN);

/* ---------- controls: commands given as classes, not letters ---------- */

/**
 * STATIC controls are classes in `static`: a hand shape held, classified by the letter model like a letter and trained from our own
 * takes. DYNAMIC controls are classes in `dynamic`: a stroke drawn with the index fingertip, matched with the $1 recogniser against
 * templates recorded through the collection page. Which is which is decided only by the list the class is in.
 */
export function controlKind(a: AlphabetConfig, classId: string): 'static' | 'dynamic' | null {
  if (a.controls[classId] === undefined) return null;
  return a.static.includes(classId) ? 'static' : 'dynamic';
}

/** the letters of an alphabet: every label that is not a control class */
export const letterLabels = (a: AlphabetConfig): string[] =>
  [...a.static, ...a.dynamic].filter((l) => a.controls[l] === undefined);

/** the control classes of an alphabet, with their action and kind */
export const controlClasses = (
  a: AlphabetConfig,
): { classId: string; action: ControlName; kind: 'static' | 'dynamic' }[] =>
  Object.entries(a.controls).map(([classId, action]) => ({
    classId,
    action,
    kind: controlKind(a, classId)!,
  }));
