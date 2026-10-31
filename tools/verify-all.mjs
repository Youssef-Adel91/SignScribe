// Runs every automatic check in the repo one after the other and prints one table.
//   npm run models   (once)    npm run verify
// Python checks need pytest: set PYTHON=/path/to/python (a venv with ml/requirements.txt), or they are skipped.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { probe, runStep } from './lib/run-step.mjs';

const root = resolve(import.meta.dirname, '..');
const venvPython = resolve(
  root,
  process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python',
);
const python =
  process.env.PYTHON ||
  (existsSync(venvPython) ? venvPython : process.platform === 'win32' ? 'python' : 'python3');
const hasPytest = spawnSync(python, ['-c', 'import pytest'], { stdio: 'ignore' }).status === 0;
const hasModels =
  existsSync(resolve(root, 'public/models/hand_landmarker.task')) &&
  existsSync(resolve(root, 'public/models/ort/ort-wasm-simd-threaded.wasm'));

const steps = [
  { name: 'typecheck + lint + unit tests + build', cmd: ['npm', ['run', 'check']] },
  { name: 'gesture flow, no mouse / keyboard (e2e)', cmd: ['npm', ['run', 'e2e']] },
  { name: 'screens do not overflow (layout)', cmd: ['npm', ['run', 'layout']] },
  { name: 'accessibility rules (axe)', cmd: ['npm', ['run', 'axe']] },
  { name: 'comparison study session', cmd: ['npm', ['run', 'e2e:study']] },
  { name: 'data collection + Wizard of Oz', cmd: ['npm', ['run', 'e2e:collect']] },
  {
    name: 'picture cards incl. ONNX Runtime',
    cmd: ['npm', ['run', 'e2e:cards']],
    skip: hasModels ? null : 'run `npm run models` first',
  },
  { name: 'sentence server + app', cmd: ['npm', ['run', 'e2e:server']] },
  {
    name: 'Python tools (ml/)',
    cmd: [python, ['-m', 'pytest', '-q'], { cwd: resolve(root, 'ml') }],
    skip: hasPytest ? null : 'pytest not found: pip install -r ml/requirements.txt, set PYTHON=…',
  },
  {
    name: 'Python tools (tools/bluetooth)',
    cmd: [python, ['-m', 'pytest', '-q', 'tools/bluetooth']],
    skip: hasPytest ? null : 'pytest not found: pip install -r tools/bluetooth/requirements.txt',
  },
];

// npm must be startable (on Windows it is npm.cmd). If it is not, say why once, before 8 steps fail.
const npmProblem = probe('npm', ['--version']);
if (npmProblem)
  console.error(
    `\nWARNING: npm could not be started (${npmProblem}). Every npm step below will FAIL with this reason.`,
  );

const rows = [];
for (const s of steps) {
  if (s.skip) {
    rows.push([s.name, 'SKIP', s.skip]);
    console.log(`\n=== SKIP ${s.name}: ${s.skip}`);
    continue;
  }
  console.log(`\n=== ${s.name}`);
  const [cmd, args, opts] = s.cmd;
  const r = runStep(cmd, args, { cwd: root, ...opts });
  if (!r.ok) console.error(`FAILED ${s.name}: ${r.why}`);
  rows.push([
    s.name,
    r.ok ? 'PASS' : 'FAIL',
    r.ok ? `${r.seconds.toFixed(0)} s` : `${r.seconds.toFixed(0)} s  ${r.why}`,
  ]);
}
console.log('\n' + '-'.repeat(72));
for (const [n, st, note] of rows) console.log(`${st.padEnd(5)} ${n.padEnd(46)} ${note}`);
const failed = rows.filter((r) => r[1] === 'FAIL').length;
console.log(
  failed ? `\n${failed} step(s) FAILED` : '\nall steps passed (skipped steps are listed above)',
);
console.log(
  'This proves the logic with synthetic hands and test models. It says nothing about real hands, real cards or the live language model: see docs/WHATS_LEFT.md.',
);
process.exit(failed ? 1 : 0);
