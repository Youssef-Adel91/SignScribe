// Which Python the tools use, decided in ONE place: PYTHON env, then the repo's .venv, then `python` on Windows / `python3` elsewhere.
// Used by tools/verify-all.mjs, tools/demo-all.mjs and the e2e launchers that start Python scripts.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/** the python command; `platform`, `env` and `exists` are parameters so a test can simulate Windows */
export function resolvePython(
  root,
  { platform = process.platform, env = process.env, exists = existsSync } = {},
) {
  if (env.PYTHON) return env.PYTHON;
  const venv = resolve(
    root,
    platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python',
  );
  if (exists(venv)) return venv;
  return platform === 'win32' ? 'python' : 'python3';
}

/** environment for a Python child whose output we read through a pipe: Python buffers stdout when it is not a terminal */
export const pythonEnv = (env = process.env) => ({
  ...env,
  PYTHONUNBUFFERED: '1',
  PYTHONIOENCODING: 'utf-8',
});

/** resolves true when `test()` becomes true within `ms`, else false (polls; no fixed sleeps) */
export async function waitUntil(test, ms, step = 50) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (test()) return true;
    await new Promise((r) => setTimeout(r, step));
  }
  return test();
}
