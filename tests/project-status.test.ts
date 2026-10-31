import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// docs/PROJECT_STATUS.md may only contain percentages that a generated results file (docs/MODEL_RESULTS.md, written by
// ml/evaluate.py) holds, plus the two numbers of the INVALID leave-one-source-out run that Youssef supplied. Anything else is an
// invented number. docs/MODEL_RESULTS.md is the single source of truth for accuracy.
const SUPPLIED_INVALID = new Set(['13.4%', '9.3%']);
const percents = (text: string) => text.match(/\d+(?:[.,]\d+)?\s?%/g) ?? [];
const cells = (line: string) =>
  line
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim());

/** the section of docs/MODEL_RESULTS.md that starts with `## <title>` (up to the next `## `) */
function section(text: string, title: string): string[] {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.trim() === `## ${title}`);
  if (start < 0) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^## /.test(l));
  return end < 0 ? rest : rest.slice(0, end);
}

describe('docs/PROJECT_STATUS.md audit', () => {
  const doc = readFileSync('docs/PROJECT_STATUS.md', 'utf8');
  const results = readFileSync('docs/MODEL_RESULTS.md', 'utf8');
  const generated = new Set(percents(results).map((p) => p.replace(/\s/g, '')));

  it('every percentage comes from docs/MODEL_RESULTS.md (or is one of the two supplied numbers of the invalid run)', () => {
    const bad = [...new Set(percents(doc).map((p) => p.replace(/\s/g, '')))].filter(
      (p) => !SUPPLIED_INVALID.has(p) && !generated.has(p),
    );
    expect(bad).toEqual([]);
  });

  it('the pooled accuracy rows equal the ones in docs/MODEL_RESULTS.md, with and without augmentation', () => {
    const pooled = (title: string, model: string) => {
      const row = section(results, title).find(
        (l) => cells(l)[0] === model && /^\d+$/.test(cells(l)[2] ?? ''),
      );
      return row ? cells(row)[3] : undefined; // model | description | samples | pooled accuracy | ...
    };
    const status = (label: string) => {
      const row = doc.split('\n').find((l) => cells(l)[0] === label);
      return row ? { knn: cells(row)[1], mlp: cells(row)[2] } : undefined;
    };
    for (const [title, label] of [
      ['with augmentation', 'pooled accuracy, with augmentation'],
      ['no augmentation', 'pooled accuracy, without augmentation'],
    ] as const) {
      expect(pooled(title, 'knn'), `${title} knn is in MODEL_RESULTS`).toMatch(/%$/);
      expect(status(label), label).toEqual({
        knn: pooled(title, 'knn'),
        mlp: pooled(title, 'mlp'),
      });
    }
  });

  it('the threshold table equals the one in docs/MODEL_RESULTS.md (with augmentation)', () => {
    const rows = section(results, 'with augmentation').map(cells);
    const fromResults = (model: string, th: string) => {
      const r = rows.find((c) => c[0] === model && c[1] === th && c.length === 4);
      return r ? [r[2], r[3]] : undefined;
    };
    const statusRows = doc
      .split('\n')
      .map(cells)
      .filter((c) => /^(k-NN|MLP)$/.test(c[0] ?? '') && /^0\.\d\d$/.test(c[1] ?? ''));
    expect(statusRows.length).toBeGreaterThan(0);
    for (const c of statusRows) {
      const model = c[0] === 'k-NN' ? 'knn' : 'mlp';
      const th = String(Number(c[1])); // 0.60 -> 0.6
      expect([c[2], c[3]], `${c[0]} ${c[1]}`).toEqual(fromResults(model, th));
    }
  });

  it('says that calibrate.py is a separate table with its own definition', () => {
    expect(doc).toMatch(/`ml\/calibrate\.py` is a separate table with its own definition/);
    expect(doc).toMatch(/single source of truth/);
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
