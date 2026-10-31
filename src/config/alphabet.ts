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
}

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
  return {
    id: raw.id ?? fallbackId,
    name: raw.name ?? fallbackId,
    reviewed: raw.reviewed ?? true,
    static: stat,
    dynamic: dyn,
    aliases: raw.aliases ?? {},
    display: raw.display ?? {},
    todo: raw.todo ?? [],
  };
}

export function loadAlphabet(name?: string): AlphabetConfig {
  const wanted = name ?? import.meta.env.VITE_ALPHABET ?? active.active;
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
