// Runs one command for tools/verify-all.mjs and always tells the truth about how it ended.
//
// How a command is started (npm / npx through the shell on Windows only, programs directly, Linux untouched) lives in spawn-tool.mjs,
// the same code the e2e launchers use.
import { spawnSync } from 'node:child_process';
import { isCmdTool, prepare } from './spawn-tool.mjs';

/** kept for the tests that name it: is this command started through the shell (a Windows .cmd tool)? */
export const needsShell = isCmdTool;

/**
 * @returns {{ ok: boolean, seconds: number, why: string }} why = '' on success, else the real reason (the spawn error, the signal
 * or the exit code). A command that could not even start is a failure, never a silent pass or a silent 0 s.
 */
export function runStep(cmd, args, opts = {}, env = {}) {
  const { spawn = spawnSync, platform = process.platform, now = Date.now } = env;
  const t0 = now();
  const p = prepare(cmd, args, { stdio: 'inherit', ...opts }, platform);
  const r = spawn(p.cmd, p.args, p.opts);
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
  const p = prepare(cmd, args, { stdio: 'ignore' }, platform);
  const r = spawn(p.cmd, p.args, p.opts);
  if (r.error) return `${r.error.code ? `${r.error.code}: ` : ''}${r.error.message}`;
  return r.status === 0 ? '' : `exit code ${r.status}`;
}
