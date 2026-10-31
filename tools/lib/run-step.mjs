// Runs one command for tools/verify-all.mjs and always tells the truth about how it ended.
//
// On Windows `npm` is `npm.cmd`: spawnSync('npm', ...) without a shell fails at once with ENOENT. Only npm is started through the
// shell there (its arguments are fixed words from verify-all, no user input); Python and node are started directly, so a path with
// spaces still works. On Linux and macOS nothing changes: no shell.
import { spawnSync } from 'node:child_process';

export const needsShell = (cmd, platform = process.platform) =>
  platform === 'win32' && cmd === 'npm';

/**
 * @returns {{ ok: boolean, seconds: number, why: string }} why = '' on success, else the real reason (the spawn error, the signal
 * or the exit code). A command that could not even start is a failure, never a silent pass or a silent 0 s.
 */
export function runStep(cmd, args, opts = {}, env = {}) {
  const { spawn = spawnSync, platform = process.platform, now = Date.now } = env;
  const t0 = now();
  const r = spawn(cmd, args, {
    stdio: 'inherit',
    ...opts,
    ...(needsShell(cmd, platform) ? { shell: true } : {}),
  });
  const seconds = (now() - t0) / 1000;
  if (r.error) {
    const code = r.error.code ? `${r.error.code}: ` : '';
    return { ok: false, seconds, why: `could not start "${cmd}": ${code}${r.error.message}` };
  }
  if (r.signal) return { ok: false, seconds, why: `"${cmd}" was stopped by ${r.signal}` };
  if (r.status !== 0) return { ok: false, seconds, why: `exit code ${r.status}` };
  return { ok: true, seconds, why: '' };
}

/** can the tools be started at all? Prints nothing; returns the first reason a command could not start, or ''. */
export function probe(cmd, args, env = {}) {
  const { spawn = spawnSync, platform = process.platform } = env;
  const r = spawn(cmd, args, {
    stdio: 'ignore',
    ...(needsShell(cmd, platform) ? { shell: true } : {}),
  });
  if (r.error) return `${r.error.code ? `${r.error.code}: ` : ''}${r.error.message}`;
  return r.status === 0 ? '' : `exit code ${r.status}`;
}
