// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JavaScript module of the tools folder
import { forbidden } from '../tools/lib/forbidden-files.mjs';

const git = (cwd: string, ...args: string[]) =>
  spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], {
    cwd,
    encoding: 'utf8',
  });
const names = (files: string[]): string[] => forbidden(files).map((f: { file: string }) => f.file);

describe('files that must never be committed', () => {
  it('any public/models k-NN json (it stores real landmark samples) is forbidden', () => {
    expect(
      names([
        'public/models/letters-arsl-knn.json',
        'public/models/letters-knn.json',
        'public/models/letters-fr-knn.json',
      ]),
    ).toHaveLength(3);
  });
  it('the small MLP json, the motion model and the cards model are allowed', () => {
    expect(
      names([
        'public/models/letters-arsl-mlp.json',
        'public/models/letters-mlp.json',
        'public/models/motion-dollar.json',
        'public/models/cards.onnx',
        'tests/fixtures/arsl/letters-arsl-knn.json', // generated test fixture, not a model of anything
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
    expect(names(r.stdout.split('\n').filter(Boolean))).toEqual([]);
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
