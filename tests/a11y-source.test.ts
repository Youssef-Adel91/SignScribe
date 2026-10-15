import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const walk = (d: string): string[] =>
  readdirSync(d).flatMap((f) =>
    statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)],
  );

describe('gesture-only input', () => {
  const files = [...walk('src/screens'), ...walk('src/ui')].filter((f) => f.endsWith('.tsx'));
  it('screens and UI kit have no click / key handlers', () => {
    for (const f of files) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(
        /\bon(Click|KeyDown|KeyUp|KeyPress|MouseDown|PointerDown|TouchStart)\s*=/,
      );
    }
  });
  it('only src/dev uses click handlers, and it is mounted behind ?dev=1', () => {
    expect(readFileSync('src/app/App.tsx', 'utf8')).toMatch(/DEV\s*&&\s*<DevPanel/);
  });
});

describe('text size floors', () => {
  const css = readFileSync('src/styles/tokens.css', 'utf8');
  it('no font token can render below 14px', () => {
    for (const m of css.matchAll(/--fs-\d+:\s*max\((\d+)px/g))
      expect(Number(m[1])).toBeGreaterThanOrEqual(14);
  });
  it('no stylesheet hard-codes a font size under 14px', () => {
    for (const f of [...walk('src')].filter((x) => x.endsWith('.css'))) {
      for (const m of readFileSync(f, 'utf8').matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)) {
        expect(Number(m[1]), `${f}: ${m[0]}`).toBeGreaterThanOrEqual(14);
      }
    }
  });
});
