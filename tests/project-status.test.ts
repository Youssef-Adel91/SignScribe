import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// docs/PROJECT_STATUS.md may only contain percentages that Youssef pasted from his own measurement (listed here) or that a
// generated results file (docs/MODEL_RESULTS.md, written by ml/evaluate.py) holds. Anything else is an invented number.
const PASTED = new Set([
  '91.1%',
  '94.9%',
  '88.9%',
  '93.8%', // pooled leave-one-person-out accuracy, k-NN / MLP, with and without augmentation
  '94.3%',
  '85.0%',
  '96.7%',
  '75.3%',
  '98.0%', // k-NN calibration: shown / precision
  '97.6%',
  '96.3%',
  '94.1%',
  '97.5%',
  '90.6%',
  '98.2%', // MLP calibration
  '13.4%',
  '9.3%', // the INVALID leave-one-source-out run
]);
const percents = (text: string) => text.match(/\d+(?:[.,]\d+)?\s?%/g) ?? [];

describe('docs/PROJECT_STATUS.md audit', () => {
  const doc = readFileSync('docs/PROJECT_STATUS.md', 'utf8');
  const generated = new Set(
    percents(readFileSync('docs/MODEL_RESULTS.md', 'utf8')).map((p) => p.replace(/\s/g, '')),
  );

  it('every percentage is pasted by Youssef or comes from a generated results file', () => {
    const bad = [...new Set(percents(doc).map((p) => p.replace(/\s/g, '')))].filter(
      (p) => !PASTED.has(p) && !generated.has(p),
    );
    expect(bad).toEqual([]);
  });

  it('says plainly what is NOT trained and what is NOT MEASURED, and that the k-NN file is not in git', () => {
    expect(doc).toMatch(/NOT TRAINED/);
    expect(doc).toMatch(/NOT MEASURED/);
    expect(doc).toMatch(/not in git/);
    expect(doc).toMatch(/INVALID/);
    expect(doc).toMatch(/image data, leave-one-person-out, not webcam/);
  });

  it('does not claim anything was verified on a real camera', () => {
    for (const line of doc.split('\n').filter((l) => /verified on a real camera/i.test(l)))
      expect(line).toMatch(/nothing|not |never/i);
    expect(doc).toMatch(/nothing in this repository has been verified on a real camera/i);
  });

  it('carries the current KNOWN_ISSUES rows', () => {
    const rows = readFileSync('docs/KNOWN_ISSUES.md', 'utf8')
      .split('\n')
      .filter((l) => /^\| \d+ \|/.test(l));
    expect(rows.length).toBeGreaterThan(20);
    for (const r of rows) expect(doc).toContain(r);
  });
});
