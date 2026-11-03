import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('"Make it comfortable" (screen 14) keeps its words inside the tiles', () => {
  const css = read('src/screens/S14Comfort.module.css');
  const small = css.split('.opt {')[1].split('}')[0];
  it('a tile grows with its text: a minimum height, never a fixed one', () => {
    expect(small).toMatch(/min-height:/);
    expect(small).not.toMatch(/(^|[^-])height:/);
  });
  it('the tick sits on the corner so it cannot cover a title', () => {
    expect(small).toMatch(/--check-top:/);
    expect(small).toMatch(/--check-right:/);
    expect(read('src/ui/Tile.module.css')).toMatch(/var\(--check-top/);
  });
  it('at 150 % text the explaining sentence goes, so the four questions fit one screen', () => {
    expect(css).toMatch(/data-text-size='xlarge'\] \.lede\s*{\s*display: none/);
  });
});

describe('three quick choices (screen 03) keeps its words inside the tiles', () => {
  const css = read('src/screens/S03Preferences.module.css');
  it('a tile grows with its text: minimum heights only, and the explaining sentence goes at 150 %', () => {
    expect(css).not.toMatch(/(^|[^-])height:\s*calc\(var\(--u\) \* (150|88)\)/m);
    expect(css).toMatch(/data-text-size='xlarge'\]\) \.lede\s*{\s*display: none/);
  });
});

describe('profile themes colour the whole system', () => {
  const tokens = read('src/styles/tokens.css');
  it.each(['blue', 'pink'])('%s sets a second accent and the line under the top bar', (theme) => {
    const block = tokens.split(`:root[data-theme='${theme}']`)[1].split('}')[0];
    expect(block).toMatch(/--accent-2:/);
    expect(block).toMatch(/--bar-line:/);
  });
  it('male is blue and green, female is pink only', () => {
    const blue = tokens.split(`:root[data-theme='blue']`)[1].split('}')[0];
    const pink = tokens.split(`:root[data-theme='pink']`)[1].split('}')[0];
    expect(blue).toMatch(/--accent-2:\s*#15803d/); // green
    expect(blue).toMatch(/--teal:\s*#1d4ed8/); // blue
    expect(pink).not.toMatch(/#15803d/);
    // the blue parts of the interface (hold ring, tints) follow the pink profile too
    expect(pink).toMatch(/--blue:\s*#be185d/);
  });
  it('the tick on a chosen tile, the "Suggested" tag and the top bar use the second accent', () => {
    expect(read('src/ui/Tile.module.css')).toMatch(/background: var\(--accent-2\)/);
    expect(read('src/ui/HintBar.module.css')).toMatch(/background: var\(--accent-2\)/);
    expect(read('src/ui/TopBar.module.css')).toMatch(/var\(--bar-line/);
  });
});

describe('gesture guide copy (S13)', () => {
  const src = readFileSync(join(process.cwd(), 'src/screens/S13GestureGuide.tsx'), 'utf8');
  it('reads the Space hold time from HOLD.open and makes no undo promise', () => {
    expect(src).toContain('HOLD.open');
    expect(src).not.toMatch(/undo is offered/i);
  });
});
