// Runs every automatic check in the repo one after the other and prints one table.
//   npm run models   (once)    npm run verify
// Python checks need pytest: set PYTHON=/path/to/python (a venv with ml/requirements.txt), or they are skipped.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const python =
  process.env.PYTHON ||
  (existsSync(resolve(root, '.venv/bin/python')) ? resolve(root, '.venv/bin/python') : 'python3');
const hasPytest = spawnSync(python, ['-c', 'import pytest'], { stdio: 'ignore' }).status === 0;
const hasDollarpy = spawnSync(python, ['-c', 'import dollarpy'], { stdio: 'ignore' }).status === 0;
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
    name: 'Bluetooth context, scanner (FAKE) to app',
    cmd: ['npm', ['run', 'e2e:context'], { env: { ...process.env, PYTHON: python } }],
  },
  {
    name: 'demo-all in FAKE mode (server, scanner, dollarpy, web)',
    cmd: ['npm', ['run', 'demo', '--', '--check', '--python', python]],
    skip: hasDollarpy ? null : 'needs dollarpy: pip install -r tools/dollarpy/requirements.txt',
  },
  {
    name: 'Python tools (tools/dollarpy)',
    cmd: [python, ['-m', 'pytest', '-q', 'tools/dollarpy']],
    skip:
      hasPytest && hasDollarpy
        ? null
        : 'needs pytest and dollarpy: pip install -r tools/dollarpy/requirements.txt',
  },
  {
    name: 'Python tools (tools/bluetooth)',
    cmd: [python, ['-m', 'pytest', '-q', 'tools/bluetooth']],
    skip: hasPytest ? null : 'pytest not found: pip install -r tools/bluetooth/requirements.txt',
  },
];

const rows = [];
for (const s of steps) {
  if (s.skip) {
    rows.push([s.name, 'SKIP', s.skip]);
    console.log(`\n=== SKIP ${s.name}: ${s.skip}`);
    continue;
  }
  console.log(`\n=== ${s.name}`);
  const t0 = Date.now();
  const [cmd, args, opts] = s.cmd;
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', ...opts });
  rows.push([
    s.name,
    r.status === 0 ? 'PASS' : 'FAIL',
    `${((Date.now() - t0) / 1000).toFixed(0)} s`,
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
