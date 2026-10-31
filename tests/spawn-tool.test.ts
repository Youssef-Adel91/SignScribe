// @vitest-environment node
import {
  readFileSync,
  readdirSync,
  statSync,
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error plain JavaScript module of the tools folder
import { linkPath } from '../tools/lib/link-path.mjs';
// @ts-expect-error plain JavaScript module of the tools folder
import { runStep } from '../tools/lib/run-step.mjs';
import {
  isCmdTool,
  prepare,
  quoteWinArg,
  spawnTool,
  spawnToolSync,
  stopTool,
  // @ts-expect-error plain JavaScript module of the tools folder
} from '../tools/lib/spawn-tool.mjs';

describe('which commands are Windows .cmd tools (the win32 branch of the resolver)', () => {
  it('npm and npx by their bare name, in any case', () => {
    for (const c of ['npm', 'npx', 'NPX', 'pnpm', 'yarn']) expect(isCmdTool(c, 'win32')).toBe(true);
  });
  it('real programs are not: node, python, git, and any path (even to npm.cmd)', () => {
    for (const c of [
      'node',
      'python',
      'python3',
      'git',
      'taskkill',
      'C:\\Program Files\\nodejs\\npm.cmd',
      'C:\\Python 3\\python.exe',
    ])
      expect(isCmdTool(c, 'win32')).toBe(false);
  });
  it('nothing is a .cmd tool on Linux or macOS', () => {
    for (const p of ['linux', 'darwin'])
      for (const c of ['npm', 'npx']) expect(isCmdTool(c, p)).toBe(false);
  });
});

describe('quoting for the Windows command line', () => {
  it('plain arguments stay as they are', () => {
    for (const a of [
      'vite',
      'preview',
      '--port',
      '4177',
      '--strictPort',
      'tools/e2e/flow.mjs',
      'a=b',
    ])
      expect(quoteWinArg(a)).toBe(a);
  });
  it('spaces and special characters are put in double quotes, inner quotes escaped, empty becomes ""', () => {
    expect(quoteWinArg('C:\\My Files\\a.json')).toBe('"C:\\My Files\\a.json"');
    expect(quoteWinArg('say "hi"')).toBe('"say \\"hi\\""');
    expect(quoteWinArg('a&b')).toBe('"a&b"');
    expect(quoteWinArg('')).toBe('""');
  });
  it('a line break is refused', () => {
    expect(() => quoteWinArg('a\nb')).toThrow(/line break/);
  });
});

describe('prepare(): what is passed to spawn', () => {
  it('win32: npx runs through the shell as one quoted command line, options kept', () => {
    const opts = { cwd: 'C:\\repo with space', stdio: 'ignore' };
    const p = prepare('npx', ['vite', 'preview', '--port', '4177', '--strictPort'], opts, 'win32');
    expect(p.cmd).toBe('npx vite preview --port 4177 --strictPort');
    expect(p.args).toEqual([]);
    expect(p.opts).toEqual({ ...opts, shell: true });
  });
  it('win32: an argument with spaces is quoted inside that line', () => {
    const p = prepare('npm', ['run', 'e2e', '--', '--file', 'C:\\My Files\\a.json'], {}, 'win32');
    expect(p.cmd).toBe('npm run e2e -- --file "C:\\My Files\\a.json"');
  });
  it('win32: node, python and a path with spaces are started directly, with no shell and no quoting', () => {
    for (const c of ['node', 'python', 'C:\\Program Files\\Python313\\python.exe']) {
      const opts = { cwd: 'x' };
      const p = prepare(c, ['-c', 'print(1)'], opts, 'win32');
      expect(p.cmd).toBe(c);
      expect(p.args).toEqual(['-c', 'print(1)']);
      expect(p.opts).toBe(opts); // the very same object: untouched
      expect(p.opts).not.toHaveProperty('shell');
    }
  });
  it('linux and macOS: everything is passed through untouched, also npx', () => {
    for (const platform of ['linux', 'darwin']) {
      const opts = { cwd: 'x' };
      const args = ['vite', 'preview'];
      const p = prepare('npx', args, opts, platform);
      expect(p.cmd).toBe('npx');
      expect(p.args).toBe(args);
      expect(p.opts).toBe(opts);
    }
  });
  it('spawnTool and spawnToolSync hand exactly that to the real spawn', () => {
    const spawn = vi.fn(() => ({}));
    spawnTool('npx', ['vite'], { cwd: 'c' }, { platform: 'win32', spawn });
    expect(spawn).toHaveBeenCalledWith('npx vite', [], { cwd: 'c', shell: true });
    const sync = vi.fn(() => ({ status: 0 }));
    spawnToolSync('npx', ['vite'], {}, { platform: 'linux', spawnSync: sync });
    expect(sync).toHaveBeenCalledWith('npx', ['vite'], {});
  });
  it('the verify runner uses the same resolver (win32: "npm run check" through the shell)', () => {
    const calls: unknown[][] = [];
    const spawn = (...a: unknown[]) => (calls.push(a), { status: 0 });
    runStep('npm', ['run', 'check'], { cwd: 'x' }, { spawn, platform: 'win32' });
    expect(calls[0]).toEqual(['npm run check', [], { stdio: 'inherit', cwd: 'x', shell: true }]);
    calls.length = 0;
    runStep('npm', ['run', 'check'], { cwd: 'x' }, { spawn, platform: 'linux' });
    expect(calls[0]).toEqual(['npm', ['run', 'check'], { stdio: 'inherit', cwd: 'x' }]);
  });
});

describe('stopping a child', () => {
  it('win32: the whole tree is stopped with taskkill (a shell child hides the real server)', () => {
    const spawnSync = vi.fn(() => ({}));
    const kill = vi.fn();
    stopTool({ pid: 4242, kill }, { platform: 'win32', spawnSync });
    expect(spawnSync).toHaveBeenCalledWith('taskkill', ['/pid', '4242', '/t', '/f'], {
      stdio: 'ignore',
    });
    expect(kill).not.toHaveBeenCalled();
  });
  it('linux: child.kill(); and nothing to stop is fine', () => {
    const kill = vi.fn();
    stopTool({ pid: 1, kill }, { platform: 'linux' });
    expect(kill).toHaveBeenCalledOnce();
    expect(() => stopTool(undefined)).not.toThrow();
    expect(() => stopTool(null)).not.toThrow();
  });
});

describe('every launcher goes through the resolver', () => {
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap((n) => {
      const p = join(d, n);
      return statSync(p).isDirectory() ? walk(p) : [p.replace(/\\/g, '/')];
    });
  const files = [...walk('tools'), 'tools/verify-all.mjs'].filter((f) => /\.mjs$/.test(f));
  // these start only real programs on purpose (git, python, node) or are the resolver itself
  const allowedRaw = new Set([
    'tools/lib/spawn-tool.mjs',
    'tools/lib/run-step.mjs', // imports spawnSync only as the default of an injectable argument; every call goes through prepare()
    'tools/check-staged.mjs',
    'tools/install-hooks.mjs',
    'tools/verify-all.mjs', // python probes only; every step goes through run-step.mjs
  ]);
  it('no launcher imports child_process directly, so none can spawn npx / npm by name without the resolver', () => {
    const bad = files.filter(
      (f) => !allowedRaw.has(f) && /from 'node:child_process'/.test(readFileSync(f, 'utf8')),
    );
    expect(bad).toEqual([]);
  });
  it('the files that are allowed to spawn directly start git, python or node, never npm / npx', () => {
    expect(readFileSync('tools/lib/run-step.mjs', 'utf8')).toMatch(/prepare\(/);
    for (const f of allowedRaw) {
      if (f === 'tools/lib/spawn-tool.mjs') continue;
      expect(readFileSync(f, 'utf8')).not.toMatch(/spawn(Sync)?\(\s*'(npm|npx)'/);
    }
  });
  it('every e2e launcher stops its servers with stopTool (child.kill() leaves the server running on Windows)', () => {
    for (const f of files.filter(
      (x) => x.startsWith('tools/e2e/') || x === 'tools/compare/screens.mjs',
    )) {
      const text = readFileSync(f, 'utf8');
      if (!/spawn\(/.test(text)) continue;
      expect(text, f).toMatch(/stopTool/);
      expect(text, f).not.toMatch(/\.kill\(\)/);
    }
  });
});

describe('linking a path in a test (symlink / junction / copy)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'link-'));
  const file = join(dir, 'f.txt');
  const sub = join(dir, 'd');
  mkdirSync(sub);
  writeFileSync(file, 'x');
  writeFileSync(join(sub, 'in.txt'), 'y');
  it('linux: a plain symlink call, no type', () => {
    const symlink = vi.fn();
    expect(linkPath(file, join(dir, 'a'), { platform: 'linux', symlink })).toBe('symlink');
    expect(symlink).toHaveBeenCalledWith(file, join(dir, 'a'));
  });
  it('win32: a directory is linked as a junction (no administrator needed)', () => {
    const symlink = vi.fn();
    expect(linkPath(sub, join(dir, 'b'), { platform: 'win32', symlink })).toBe('junction');
    expect(symlink).toHaveBeenCalledWith(sub, join(dir, 'b'), 'junction');
  });
  it('win32: a file is linked as a file symlink', () => {
    const symlink = vi.fn();
    expect(linkPath(file, join(dir, 'c'), { platform: 'win32', symlink })).toBe('symlink');
    expect(symlink).toHaveBeenCalledWith(file, join(dir, 'c'), 'file');
  });
  it('EPERM on the junction falls back to a copy of the directory', () => {
    const symlink = () => {
      throw Object.assign(new Error('operation not permitted'), { code: 'EPERM' });
    };
    const to = join(dir, 'copied-dir');
    expect(linkPath(sub, to, { platform: 'win32', symlink })).toBe('copy');
    expect(readFileSync(join(to, 'in.txt'), 'utf8')).toBe('y');
  });
  it('EPERM on a file symlink falls back to a copy of the file', () => {
    const symlink = () => {
      throw Object.assign(new Error('operation not permitted'), { code: 'EPERM' });
    };
    const to = join(dir, 'copied.txt');
    expect(linkPath(file, to, { platform: 'win32', symlink })).toBe('copy');
    expect(readFileSync(to, 'utf8')).toBe('x');
  });
  it('really works here (a real symlink, or the copy where that is refused)', () => {
    const to = join(dir, 'real');
    linkPath(file, to);
    expect(existsSync(to)).toBe(true);
    expect(readFileSync(to, 'utf8')).toBe('x');
  });
});

describe('python resolver (tools/lib/python.mjs)', () => {
  it('PYTHON wins, then the repo venv, then python on win32 / python3 elsewhere', async () => {
    const { resolvePython } = await import('../tools/lib/python.mjs');
    const none = () => false;
    const yes = () => true;
    expect(resolvePython('/r', { platform: 'win32', env: { PYTHON: 'X' }, exists: yes })).toBe('X');
    expect(resolvePython('/r', { platform: 'win32', env: {}, exists: none })).toBe('python');
    expect(resolvePython('/r', { platform: 'linux', env: {}, exists: none })).toBe('python3');
    expect(resolvePython('/r', { platform: 'darwin', env: {}, exists: none })).toBe('python3');
    expect(resolvePython('/r', { platform: 'win32', env: {}, exists: yes })).toMatch(
      /Scripts[\\/]python\.exe$/,
    );
    expect(resolvePython('/r', { platform: 'linux', env: {}, exists: yes })).toMatch(
      /bin[\\/]python$/,
    );
  });

  it('children read through a pipe get unbuffered output; waitUntil times out cleanly', async () => {
    const { pythonEnv, waitUntil } = await import('../tools/lib/python.mjs');
    expect(pythonEnv({ A: '1' })).toMatchObject({ A: '1', PYTHONUNBUFFERED: '1' });
    let n = 0;
    expect(await waitUntil(() => ++n > 3, 1000, 5)).toBe(true);
    expect(await waitUntil(() => false, 40, 5)).toBe(false);
  });

  it('no launcher hard-codes python3 any more', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const files = [
      ...readdirSync('tools/e2e').map((f) => `tools/e2e/${f}`),
      'tools/demo-all.mjs',
      'tools/verify-all.mjs',
    ].filter((f) => f.endsWith('.mjs'));
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(/\|\|\s*'python3'/);
  });
});
