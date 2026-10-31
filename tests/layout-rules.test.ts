import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('layout rules', () => {
  it('the layout step fails on Normal and Large overflow (Extra large is only counted)', () => {
    const src = readFileSync('tools/e2e/layout.mjs', 'utf8');
    expect(src).toMatch(/MUST_BE_CLEAN = new Set\(\['normal', 'large'\]\)/);
    expect(src).toMatch(/if \(MUST_BE_CLEAN\.has\(textSize\)\) bad\+\+/);
    expect(src).toMatch(/process\.exitCode = bad \? 1 : 0/);
  });

  it('screen 9: a caption never uses the 60 px word style (it made Large text overflow, KNOWN_ISSUES #3)', () => {
    const tsx = readFileSync('src/screens/S09WordSuggestion.tsx', 'utf8');
    const css = readFileSync('src/screens/S09WordSuggestion.module.css', 'utf8');
    expect(tsx).not.toMatch(/<p className=\{styles\.match\}>Matches/);
    expect(tsx).toMatch(/styles\.caption/);
    expect(css).toMatch(/\.caption\s*\{[^}]*font-size:\s*var\(--fs-17\)/);
  });
});
