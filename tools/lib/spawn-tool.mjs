// Starting child processes the same way on every system. Used by tools/verify-all.mjs (through run-step.mjs), the e2e launchers,
// tools/demo-all.mjs and tools/compare.
//
// On Windows `npm` and `npx` are `npm.cmd` / `npx.cmd`: spawning them by name without a shell fails with ENOENT, and newer Node refuses to
// spawn a .cmd file without one (EINVAL). So THOSE (the bare names in CMD_TOOLS) go through the shell, as one properly quoted command line.
// Real programs (node, python, git: .exe files) are started directly, so a path with spaces needs no quoting and no shell. On Linux and
// macOS nothing changes: the command and arguments are passed through untouched.
import { spawn as nodeSpawn, spawnSync as nodeSpawnSync } from 'node:child_process';

const CMD_TOOLS = new Set(['npm', 'npx', 'pnpm', 'yarn']);

/** is this a Windows .cmd tool that must go through the shell? (a bare name only; a path is never treated as one) */
export const isCmdTool = (cmd, platform = process.platform) =>
  platform === 'win32' && CMD_TOOLS.has(String(cmd).toLowerCase());

/** one argument for a cmd.exe command line: left alone when it is plain, else in double quotes (inner quotes escaped) */
export function quoteWinArg(arg) {
  const s = String(arg);
  if (/[\r\n\0]/.test(s)) throw new Error('an argument may not contain a line break');
  if (s !== '' && /^[A-Za-z0-9_@+=:,./\\-]+$/.test(s)) return s;
  return `"${s.replace(/"/g, '\\"')}"`;
}

/** what to pass to child_process.spawn: {cmd, args, opts}. Unchanged unless `cmd` is a Windows .cmd tool. */
export function prepare(cmd, args = [], opts = {}, platform = process.platform) {
  if (!isCmdTool(cmd, platform)) return { cmd, args, opts };
  return {
    cmd: [cmd, ...args].map(quoteWinArg).join(' '),
    args: [],
    opts: { ...opts, shell: true },
  };
}

export function spawnTool(cmd, args = [], opts = {}, env = {}) {
  const p = prepare(cmd, args, opts, env.platform);
  return (env.spawn ?? nodeSpawn)(p.cmd, p.args, p.opts);
}

export function spawnToolSync(cmd, args = [], opts = {}, env = {}) {
  const p = prepare(cmd, args, opts, env.platform);
  return (env.spawnSync ?? nodeSpawnSync)(p.cmd, p.args, p.opts);
}

/**
 * Stop a child. On Windows a process started through the shell is a cmd.exe with the real program under it: child.kill() would stop only
 * the shell and leave the server running, so the whole tree is stopped with taskkill. Elsewhere child.kill(). Safe to call with nothing.
 */
export function stopTool(child, env = {}) {
  if (!child) return;
  const platform = env.platform ?? process.platform;
  if (platform === 'win32' && child.pid) {
    (env.spawnSync ?? nodeSpawnSync)('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
    });
    return;
  }
  child.kill();
}
