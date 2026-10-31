// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JavaScript module of the tools folder
import { needsShell, probe, runStep } from '../tools/lib/run-step.mjs';

type Spawn = (
  cmd: string,
  args: string[],
  opts: Record<string, unknown>,
) => Record<string, unknown>;
const recorder = (result: Record<string, unknown>) => {
  const calls: { cmd: string; opts: Record<string, unknown> }[] = [];
  const spawn: Spawn = (cmd, _args, opts) => {
    calls.push({ cmd, opts });
    return result;
  };
  return { calls, spawn };
};

describe('verify-all starts its commands the right way on each system', () => {
  it('npm goes through the shell on Windows only (it is npm.cmd there)', () => {
    expect(needsShell('npm', 'win32')).toBe(true);
    expect(needsShell('npm', 'linux')).toBe(false);
    expect(needsShell('npm', 'darwin')).toBe(false);
  });
  it('Python and node are never started through the shell, also on Windows', () => {
    expect(needsShell('C:\\Program Files\\Python\\python.exe', 'win32')).toBe(false);
    expect(needsShell('node', 'win32')).toBe(false);
  });
  it('on Windows the npm call carries shell: true and nothing else changes', () => {
    const { calls, spawn } = recorder({ status: 0 });
    runStep('npm', ['run', 'check'], { cwd: 'x' }, { spawn, platform: 'win32' });
    expect(calls[0].opts).toMatchObject({ shell: true, cwd: 'x', stdio: 'inherit' });
  });
  it('on Linux the call has no shell option at all (unchanged behaviour)', () => {
    const { calls, spawn } = recorder({ status: 0 });
    runStep('npm', ['run', 'check'], { cwd: 'x' }, { spawn, platform: 'linux' });
    expect(calls[0].opts).toEqual({ stdio: 'inherit', cwd: 'x' });
  });
  it('the startup probe uses the same rule', () => {
    const { calls, spawn } = recorder({ status: 0 });
    expect(probe('npm', ['--version'], { spawn, platform: 'win32' })).toBe('');
    expect(calls[0].opts.shell).toBe(true);
  });
});

describe('a command that cannot start is a FAIL with the real reason, never a silent pass', () => {
  it('reports the spawn error (the Windows ENOENT) with its code and message', () => {
    const err = Object.assign(new Error('spawnSync npm ENOENT'), { code: 'ENOENT' });
    const { spawn } = recorder({ error: err, status: null });
    const r = runStep('npm', ['run', 'check'], {}, { spawn, platform: 'linux' });
    expect(r.ok).toBe(false);
    expect(r.why).toBe('could not start "npm": ENOENT: spawnSync npm ENOENT');
  });
  it('reports a signal and a non-zero exit code', () => {
    expect(
      runStep('x', [], {}, { spawn: () => ({ status: null, signal: 'SIGKILL' }) }).why,
    ).toMatch(/SIGKILL/);
    const r = runStep('x', [], {}, { spawn: () => ({ status: 3 }) });
    expect(r).toMatchObject({ ok: false, why: 'exit code 3' });
  });
  it('a clean exit is the only success', () => {
    expect(runStep('x', [], {}, { spawn: () => ({ status: 0 }) }).ok).toBe(true);
  });
  it('works for real: node that exits 0, node that exits 2, a program that does not exist', () => {
    const quiet = { stdio: 'ignore' };
    expect(runStep(process.execPath, ['-e', ''], quiet).ok).toBe(true);
    expect(runStep(process.execPath, ['-e', 'process.exit(2)'], quiet)).toMatchObject({
      ok: false,
      why: 'exit code 2',
    });
    const gone = runStep('no-such-program-xyz', [], quiet);
    expect(gone.ok).toBe(false);
    expect(gone.why).toMatch(/could not start "no-such-program-xyz": ENOENT/);
  });
});

describe('verify-all itself, with npm missing from the PATH (the Windows failure, made on Linux)', () => {
  it('prints the real error, marks every npm step FAIL and exits 1', () => {
    const bin = mkdtempSync(join(tmpdir(), 'only-node-'));
    symlinkSync(process.execPath, join(bin, 'node'));
    const r = spawnSync(process.execPath, ['tools/verify-all.mjs'], {
      encoding: 'utf8',
      env: { PATH: bin, PYTHON: join(bin, 'no-python') },
      timeout: 60_000,
    });
    const out = `${r.stdout}\n${r.stderr}`;
    expect(r.status).toBe(1);
    expect(out).toMatch(/WARNING: npm could not be started \(ENOENT/);
    expect(out).toMatch(
      /FAILED typecheck \+ lint \+ unit tests \+ build: could not start "npm": ENOENT/,
    );
    const fails = out.split('\n').filter((l) => /^FAIL /.test(l));
    expect(fails.length).toBeGreaterThanOrEqual(7);
    expect(fails.every((l) => l.includes('ENOENT'))).toBe(true);
    expect(out).not.toMatch(/^PASS .*typecheck/m);
  });
});
