// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { readFileSync, copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JavaScript module of the tools folder
import { MAX_FIXTURE_VECTORS, forbidden } from '../tools/lib/forbidden-files.mjs';

const git = (cwd: string, ...args: string[]) =>
  spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], {
    cwd,
    encoding: 'utf8',
  });
const names = (files: string[], read?: (p: string) => string | null): string[] =>
  forbidden(files, read).map((f: { file: string }) => f.file);
const knn = (over: { synthetic?: unknown; vectors?: number } = {}) =>
  JSON.stringify({
    type: 'knn',
    labels: ['A', 'B'],
    vectors: Array.from({ length: over.vectors ?? 64 }, () => [0.1, 0.2]),
    y: [],
    meta: 'synthetic' in over ? { synthetic: over.synthetic } : { synthetic: true },
  });

describe('the one k-NN file that may be committed: a small synthetic fixture under tests/fixtures/', () => {
  const fixture = 'tests/fixtures/arsl/letters-arsl-knn.json';
  it('is allowed when it says synthetic: true and has at most 200 vectors', () => {
    expect(names([fixture], () => knn())).toEqual([]);
    expect(names([fixture], () => knn({ vectors: MAX_FIXTURE_VECTORS }))).toEqual([]);
  });
  it('is rejected under tests/fixtures without the flag', () => {
    const r = forbidden([fixture], () => knn({ synthetic: undefined }));
    expect(r).toHaveLength(1);
    expect(r[0].why).toMatch(/synthetic/);
    expect(names([fixture], () => knn({ synthetic: false }))).toHaveLength(1);
    expect(names([fixture], () => knn({ synthetic: 'true' }))).toHaveLength(1); // a string is not the flag
    expect(names([fixture], () => JSON.stringify({ vectors: [] }))).toHaveLength(1); // no meta at all
  });
  it('is rejected in public/models, even small and flagged synthetic', () => {
    const r = forbidden(['public/models/letters-arsl-knn.json'], () => knn());
    expect(r).toHaveLength(1);
    expect(r[0].why).toMatch(/tests\/fixtures/);
  });
  it('is rejected anywhere else, even small and flagged synthetic', () => {
    for (const p of [
      'letters-knn.json',
      'ml/reports/letters-arsl-knn.json',
      'tests/letters-knn.json',
      'docs/x-knn.json',
    ])
      expect(names([p], () => knn())).toHaveLength(1);
  });
  it('is rejected with more than 200 vectors', () => {
    const r = forbidden([fixture], () => knn({ vectors: MAX_FIXTURE_VECTORS + 1 }));
    expect(r).toHaveLength(1);
    expect(r[0].why).toMatch(/at most 200/);
  });
  it('is rejected when it cannot be read, is not JSON, or has no vector list', () => {
    expect(names([fixture], () => null)).toHaveLength(1);
    expect(names([fixture])).toHaveLength(1);
    expect(names([fixture], () => '{nope')).toHaveLength(1);
    expect(names([fixture], () => JSON.stringify({ meta: { synthetic: true } }))).toHaveLength(1);
  });
  it('the rule is the same for Windows paths', () => {
    expect(names(['tests\\fixtures\\arsl\\letters-arsl-knn.json'], () => knn())).toEqual([]);
    expect(names(['public\\models\\letters-arsl-knn.json'], () => knn())).toHaveLength(1);
  });
  it('the JSON file in this repository is such a fixture', () => {
    const r = git(process.cwd(), 'ls-files', 'tests/fixtures');
    if (r.status !== 0) return;
    const files = r.stdout.split('\n').filter((f: string) => f.endsWith('-knn.json'));
    for (const f of files) expect(names([f], (p) => readFileSync(p, 'utf8'))).toEqual([]);
  });
});

describe('files that must never be committed', () => {
  it('a k-NN json in public/models (it stores real landmark samples) is forbidden, also with the synthetic flag', () => {
    expect(
      names(
        [
          'public/models/letters-arsl-knn.json',
          'public/models/letters-knn.json',
          'public/models/letters-fr-knn.json',
        ],
        () => knn(),
      ),
    ).toHaveLength(3);
  });
  it('the small MLP json, the motion model and the cards model are allowed', () => {
    expect(
      names([
        'public/models/letters-arsl-mlp.json',
        'public/models/letters-mlp.json',
        'public/models/motion-dollar.json',
        'public/models/cards.onnx',
      ]),
    ).toEqual([]);
  });
  it('anything under ml/data/ or datasets/ is forbidden, also with Windows slashes', () => {
    expect(
      names(['ml/data/arsl21l.jsonl', 'ml\\data\\x.csv', 'datasets/ArSL21L/a.jpg']),
    ).toHaveLength(3);
  });
  it('ordinary files are fine, also ml/ code and ml/tests data', () => {
    expect(
      names(['ml/export_arsl.py', 'ml/tests/golden_mlp.json', 'src/a.ts', 'ml/database.py']),
    ).toEqual([]);
  });
  it('says why', () => {
    expect(forbidden(['public/models/a-knn.json'])[0].why).toMatch(/real landmark samples/);
  });
});

describe('this repository', () => {
  it('has no forbidden file committed', () => {
    const r = git(process.cwd(), 'ls-files');
    if (r.status !== 0) return; // not a git checkout (a zip): nothing to look at
    const index = (p: string) => {
      const g = git(process.cwd(), 'show', `:${p}`);
      return g.status === 0 ? g.stdout : null;
    };
    expect(names(r.stdout.split('\n').filter(Boolean), index)).toEqual([]);
  });
  it('ignores a k-NN model but not the MLP one (.gitignore)', () => {
    const ignored = (p: string) => git(process.cwd(), 'check-ignore', '-q', p).status === 0;
    expect(ignored('public/models/letters-arsl-knn.json')).toBe(true);
    expect(ignored('public/models/letters-knn.json')).toBe(true);
    expect(ignored('public/models/letters-arsl-mlp.json')).toBe(false);
    expect(ignored('ml/data/arsl21l.jsonl')).toBe(true);
  });
});

describe('the pre-commit check, in a scratch repository', () => {
  const scratch = () => {
    const dir = mkdtempSync(join(tmpdir(), 'precommit-'));
    git(dir, 'init', '-q');
    mkdirSync(join(dir, 'tools/lib'), { recursive: true });
    for (const f of ['check-staged.mjs', 'install-hooks.mjs', 'lib/forbidden-files.mjs'])
      copyFileSync(join(process.cwd(), 'tools', f), join(dir, 'tools', f));
    return dir;
  };
  const put = (dir: string, rel: string) => {
    mkdirSync(join(dir, rel, '..'), { recursive: true });
    writeFileSync(join(dir, rel), '{}');
    git(dir, 'add', '-f', rel);
  };
  const run = (dir: string) =>
    spawnSync(process.execPath, ['tools/check-staged.mjs'], { cwd: dir, encoding: 'utf8' });

  it('fails when a k-NN model is staged and names the file', () => {
    const dir = scratch();
    put(dir, 'public/models/letters-arsl-knn.json');
    const r = run(dir);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('public/models/letters-arsl-knn.json');
    expect(r.stderr).toMatch(/Commit refused/);
  });
  it('fails when a file under ml/data/ is staged', () => {
    const dir = scratch();
    put(dir, 'ml/data/arsl21l.jsonl');
    expect(run(dir).status).toBe(1);
  });
  it('passes with only allowed files staged', () => {
    const dir = scratch();
    put(dir, 'public/models/letters-arsl-mlp.json');
    put(dir, 'src/a.ts');
    expect(run(dir).status).toBe(0);
  });
  const putText = (dir: string, rel: string, text: string) => {
    mkdirSync(join(dir, rel, '..'), { recursive: true });
    writeFileSync(join(dir, rel), text);
    git(dir, 'add', '-f', rel);
  };
  it('the real script allows a synthetic fixture with at most 200 vectors under tests/fixtures', () => {
    const dir = scratch();
    putText(dir, 'tests/fixtures/arsl/letters-arsl-knn.json', knn());
    expect(run(dir).status).toBe(0);
  });
  it('the real script refuses a fixture without the flag, and one with 201 vectors', () => {
    const noFlag = scratch();
    putText(noFlag, 'tests/fixtures/arsl/letters-arsl-knn.json', knn({ synthetic: undefined }));
    const r = run(noFlag);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/synthetic/);
    const big = scratch();
    putText(
      big,
      'tests/fixtures/arsl/letters-arsl-knn.json',
      knn({ vectors: MAX_FIXTURE_VECTORS + 1 }),
    );
    const b = run(big);
    expect(b.status).toBe(1);
    expect(b.stderr).toMatch(/at most 200/);
  });
  it('the real script refuses a k-NN file in public/models, also small and flagged synthetic', () => {
    const dir = scratch();
    putText(dir, 'public/models/letters-arsl-knn.json', knn());
    const r = run(dir);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('public/models/letters-arsl-knn.json');
  });
  it('it judges the STAGED content: a clean file on disk does not hide a bad staged one', () => {
    const dir = scratch();
    putText(dir, 'tests/fixtures/a/x-knn.json', knn({ vectors: 500 }));
    writeFileSync(join(dir, 'tests/fixtures/a/x-knn.json'), knn()); // changed on disk, not staged
    expect(run(dir).status).toBe(1);
  });
  it('--tracked checks what is already committed', () => {
    const dir = scratch();
    putText(dir, 'public/models/letters-knn.json', knn());
    git(dir, 'commit', '--no-verify', '-m', 'bad on purpose');
    const r = spawnSync(process.execPath, ['tools/check-staged.mjs', '--tracked'], {
      cwd: dir,
      encoding: 'utf8',
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('public/models/letters-knn.json');
  });
  it('as the git hook it lets the synthetic fixture commit and stops the same file without the flag', () => {
    const dir = scratch();
    spawnSync(process.execPath, ['tools/install-hooks.mjs'], { cwd: dir });
    putText(dir, 'tests/fixtures/arsl/letters-arsl-knn.json', knn());
    expect(git(dir, 'commit', '-m', 'fixture').status).toBe(0);
    putText(dir, 'tests/fixtures/arsl/other-knn.json', knn({ synthetic: undefined }));
    const bad = git(dir, 'commit', '-m', 'no flag');
    expect(bad.status).not.toBe(0);
    expect(`${bad.stdout}${bad.stderr}`).toMatch(/Commit refused/);
  });
  it('as a git hook it stops the commit, and lets a clean one through', () => {
    const dir = scratch();
    const inst = spawnSync(process.execPath, ['tools/install-hooks.mjs'], {
      cwd: dir,
      encoding: 'utf8',
    });
    expect(inst.status).toBe(0);
    put(dir, 'public/models/letters-knn.json');
    const bad = git(dir, 'commit', '-m', 'x');
    expect(bad.status).not.toBe(0);
    expect(`${bad.stdout}${bad.stderr}`).toMatch(/Commit refused/);
    git(dir, 'rm', '-q', '--cached', 'public/models/letters-knn.json');
    put(dir, 'src/a.ts');
    expect(git(dir, 'commit', '-m', 'ok').status).toBe(0);
  });
  it('installing twice does not add the line twice', () => {
    const dir = scratch();
    spawnSync(process.execPath, ['tools/install-hooks.mjs'], { cwd: dir });
    const again = spawnSync(process.execPath, ['tools/install-hooks.mjs'], {
      cwd: dir,
      encoding: 'utf8',
    });
    expect(again.stdout).toMatch(/already installed/);
  });
});
