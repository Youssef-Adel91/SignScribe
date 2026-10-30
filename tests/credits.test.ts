import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CREDITS, LICENCE_TEXT } from '../src/config/credits';
import { AboutCredits } from '../src/ui/AboutCredits';

const docs = readFileSync('docs/CREDITS.md', 'utf8');

describe('credits for the datasets', () => {
  it('ArSL21L is credited under CC BY 4.0, with what was changed', () => {
    const c = CREDITS.find((x) => x.id === 'arsl21l')!;
    expect(c.licence).toBe('CC BY 4.0');
    expect(c.licenceUrl).toBe('https://creativecommons.org/licenses/by/4.0/');
    expect(c.changes).toMatch(/not pictures/);
    expect(c.inShippedModel).toBe(true);
  });
  it('ASLAD is credited as a test-only dataset, not in the shipped model', () => {
    const c = CREDITS.find((x) => x.id === 'aslad')!;
    expect(c.inShippedModel).toBe(false);
    expect(c.use).toMatch(/not in the shipped model/);
  });
  it('every credit is also in docs/CREDITS.md, with its licence and the licence address', () => {
    for (const c of CREDITS) {
      expect(docs).toContain(c.name.split(' (')[0]);
      expect(docs).toContain(c.licence === 'CC BY 4.0' ? 'CC BY 4.0' : c.licence);
    }
    expect(docs).toContain(`https://${LICENCE_TEXT}/`);
  });
  it('the docs say that no dataset is in the repository and that the citation still has to be pasted', () => {
    expect(docs).toMatch(/No dataset, picture, landmark file or take is in this repository/);
    expect(docs).toMatch(/TODO\(Youssef\): paste the citation/);
  });
  it('the About text shows every dataset, its licence and the changes (no link: the app has no mouse)', () => {
    const html = renderToStaticMarkup(createElement(AboutCredits));
    for (const c of CREDITS) {
      expect(html).toContain(c.name);
      expect(html).toContain(c.licence);
    }
    expect(html).toContain('About and credits');
    expect(html).toContain(LICENCE_TEXT);
    expect(html).not.toContain('<a ');
  });
});

describe('the credits are on the help screen', () => {
  it('screen 13 renders the About section', () => {
    const src = readFileSync('src/screens/S13GestureGuide.tsx', 'utf8');
    expect(src).toContain('<AboutCredits />');
  });
});
