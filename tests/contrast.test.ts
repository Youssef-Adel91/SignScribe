import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const lum = (hex: string) => {
  const c = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const css = readFileSync('src/styles/tokens.css', 'utf8');
const token = (name: string, block = css.split(":root[data-text-size='large']")[0]) => {
  const m = block.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`token ${name} missing`);
  return m[1];
};

describe('contrast ratios match the numbers in PLAN.md section 5', () => {
  const cases: [string, string, string, number][] = [
    ['command zone text on camera panel', token('cam-text'), token('cam'), 9.85],
    ['idle command zone text on camera panel', token('cam-text-off'), token('cam'), 5.7],
    ['recognised letter on white', token('amber-letter'), '#ffffff', 5.0],
    ['detection badge: white on green', '#ffffff', token('green-badge'), 5.0],
    ['placeholder on white', token('muted-2'), '#ffffff', 4.76],
  ];
  it.each(cases)('%s', (_n, fg, bg, expected) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(expected - 0.1);
  });

  it('every text token on white meets WCAG AA 4.5:1', () => {
    for (const t of [
      'ink',
      'ink-2',
      'muted',
      'muted-2',
      'teal',
      'teal-ink',
      'green-ink',
      'amber-ink',
      'amber-letter',
      'blue-ink',
    ]) {
      expect(ratio(token(t), '#ffffff'), t).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(['blue', 'pink'])(
    'profile theme %s: accent text >= 4.5:1 on white, on the page background and on its own tint',
    (theme) => {
      const block = css.split(`:root[data-theme='${theme}']`)[1].split('}')[0];
      const t = (n: string) => token(n, block);
      for (const fg of ['teal', 'teal-ink'])
        for (const bg of ['#ffffff', t('bg'), t('teal-bg'), t('teal-wash')])
          expect(ratio(t(fg), bg), `${theme} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      // white text on the accent (selected tiles, buttons)
      expect(ratio('#ffffff', t('teal')), `${theme} white on teal`).toBeGreaterThanOrEqual(4.5);
      // body text still reads on the tinted page
      for (const fg of ['ink', 'ink-2', 'muted', 'muted-2'])
        expect(ratio(token(fg), t('bg')), `${theme} ${fg} on page`).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('high contrast always wins over a profile theme', () => {
    expect(css).toMatch(/:root\[data-theme='blue'\]:not\(\[data-contrast='high'\]\)/);
    expect(css).toMatch(/:root\[data-theme='pink'\]:not\(\[data-contrast='high'\]\)/);
  });

  it('high-contrast palette reaches at least 7:1 for body text and 4.5:1 for the rest', () => {
    const block = css.split(":root[data-contrast='high']")[1];
    for (const t of [
      'ink',
      'ink-2',
      'muted',
      'muted-2',
      'teal',
      'teal-ink',
      'green-ink',
      'amber-ink',
      'amber-letter',
    ]) {
      const r = ratio(token(t, block.includes(`--${t}:`) ? block : css), '#ffffff');
      expect(r, t).toBeGreaterThanOrEqual(t === 'ink' || t === 'ink-2' || t === 'muted' ? 7 : 4.5);
    }
  });
});
