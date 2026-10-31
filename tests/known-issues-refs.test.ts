// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every "KNOWN_ISSUES #n" in the repository must point at a row that exists in docs/KNOWN_ISSUES.md, and the rows are numbered
 * 1..N once each. (After the ArSL branches were merged their issues were renumbered after the last number in main; this keeps a
 * renumbering from leaving a dangling reference behind.)
 */
const SELF = 'tests/known-issues-refs.test.ts';
const TEXT = /\.(md|ts|tsx|mjs|js|py|json|css|html|txt)$/;

function trackedFiles(): string[] {
  try {
    return execFileSync('git', ['ls-files'], { encoding: 'utf8', maxBuffer: 1 << 26 })
      .split('\n')
      .filter(Boolean);
  } catch {
    const out: string[] = [];
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        if (['node_modules', 'dist', '.git', '.venv', 'ml/data'].includes(n)) continue;
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p);
        else out.push(p);
      }
    };
    walk('.');
    return out.map((p) => p.replace(/^\.\//, ''));
  }
}

const issues = readFileSync('docs/KNOWN_ISSUES.md', 'utf8');
const rows = [...issues.matchAll(/^\| (\d+) \|/gm)].map((m) => Number(m[1]));
const exists = new Set(rows);

/** the numbers mentioned after "KNOWN_ISSUES": #5, #5, #7, #5-#9, "as #5 to #14" */
export function referencedNumbers(text: string): number[] {
  const out: number[] = [];
  const run = /KNOWN_ISSUES(?:\.md)?`?\s*((?:#\d+(?:\s*[-–]\s*#?\d+)?|\s*(?:,|and|to|as)\s*)+)/g;
  for (const m of text.matchAll(run)) {
    for (const part of m[1].matchAll(/#(\d+)(?:\s*[-–]\s*#?(\d+))?/g)) {
      const a = Number(part[1]);
      const b = part[2] ? Number(part[2]) : a;
      for (let n = Math.min(a, b); n <= Math.max(a, b); n++) out.push(n);
    }
  }
  for (const m of text.matchAll(/\b[Ii]ssue #(\d+)\b/g)) out.push(Number(m[1]));
  return out;
}

describe('docs/KNOWN_ISSUES.md numbering', () => {
  it('has the rows 1..N, each number once, in order', () => {
    expect(rows.length).toBeGreaterThan(14);
    expect(rows).toEqual(Array.from({ length: rows.length }, (_, i) => i + 1));
  });
});

describe('every referenced issue number exists', () => {
  const files = trackedFiles().filter(
    (f) =>
      TEXT.test(f) && f !== SELF && !f.startsWith('node_modules/') && f !== 'package-lock.json',
  );
  const found: { file: string; n: number }[] = [];
  for (const f of files) {
    let text = '';
    try {
      text = readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    if (f === 'docs/KNOWN_ISSUES.md') {
      // inside the table itself: "(#15)" and "KNOWN_ISSUES #n"
      for (const m of text.matchAll(/\(#(\d+)\)/g)) found.push({ file: f, n: Number(m[1]) });
    }
    for (const n of referencedNumbers(text)) found.push({ file: f, n });
  }
  it('finds the references it is meant to (the check is not empty)', () => {
    expect(found.length).toBeGreaterThan(8);
    expect(new Set(found.map((x) => x.file))).toContain('docs/DONE.md');
  });
  it('none points at a missing row', () => {
    const missing = found.filter((x) => !exists.has(x.n)).map((x) => `${x.file}: #${x.n}`);
    expect(missing).toEqual([]);
  });
  it('the parser reads the forms used in this repository', () => {
    expect(referencedNumbers('see `docs/KNOWN_ISSUES.md` #5-#9 and KNOWN_ISSUES #3, #7')).toEqual([
      5, 6, 7, 8, 9, 3, 7,
    ]);
    expect(referencedNumbers('listed in KNOWN_ISSUES.md as #5 to #7')).toEqual([5, 7]);
    expect(referencedNumbers('issue #4 is fixed')).toEqual([4]);
    expect(referencedNumbers('nothing here #12')).toEqual([]);
  });
  it('a dangling reference would be caught', () => {
    expect(referencedNumbers('docs/KNOWN_ISSUES.md #99').filter((n) => !exists.has(n))).toEqual([
      99,
    ]);
  });
});
