import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(tsx?|css)$/.test(n) ? [p] : [];
  });
}

describe('size tokens', () => {
  it('every var(--s-N) used in the source is defined in tokens.css (an undefined one makes an icon fill its box)', () => {
    const defined = new Set(
      [...readFileSync('src/styles/tokens.css', 'utf8').matchAll(/^\s*(--s-\d+):/gm)].map(
        (m) => m[1],
      ),
    );
    const missing = new Set<string>();
    for (const f of files('src')) {
      // a use with a fallback, var(--s-72, 20px), is fine
      for (const m of readFileSync(f, 'utf8').matchAll(/var\((--s-\d+)\s*\)/g))
        if (!defined.has(m[1])) missing.add(`${m[1]} (${f})`);
    }
    expect([...missing]).toEqual([]);
  });
});
