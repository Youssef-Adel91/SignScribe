// Starts everything for the Phase II demo with one command: sentence server, Bluetooth scanner, DollarPy client and the web app.
//
//   npm run demo                  FAKE mode (default): a SIMULATED Bluetooth device and SIMULATED hand paths. No hardware.
//   npm run demo -- --real        your real Bluetooth adapter (tools/bluetooth/devices.json) and your webcam
//   npm run demo -- --check       start everything in FAKE mode, wait until the whole chain works, print a table, stop
//
// Options: --fake-device youssef:Clinic   --letters "J Z"   --python /path/to/python   --no-web
// Walkthrough and what to say for each grading row: tools/demo-all.md
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { WebSocket } from 'ws';

const root = resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);
const REAL = has('--real');
const CHECK = has('--check');
if (REAL && CHECK) {
  console.error(
    '--check needs the FAKE mode: it cannot know what a real adapter or webcam will do.',
  );
  process.exit(2);
}
const python =
  val('--python') ||
  process.env.PYTHON ||
  (existsSync(resolve(root, '.venv/bin/python')) ? resolve(root, '.venv/bin/python') : 'python3');
const device = val('--fake-device', 'youssef:Clinic');
const letters = val('--letters', 'J Z').split(/\s+/).filter(Boolean);
const WS = 8787;
const TCP = 8788;
const WEB = 5173;
const webUrl = `http://localhost:${WEB}/?server=ws://localhost:${WS}`;

const need = (mod) => spawnSync(python, ['-c', `import ${mod}`], { stdio: 'ignore' }).status === 0;
const missing = [];
if (!need('dollarpy')) missing.push('dollarpy (pip install -r tools/dollarpy/requirements.txt)');
if (REAL && !need('bleak')) missing.push('bleak (pip install -r tools/bluetooth/requirements.txt)');
if (REAL && !need('cv2')) missing.push('opencv (pip install -r tools/dollarpy/requirements.txt)');
if (missing.length) {
  console.error(
    `Missing for ${python}:\n  - ${missing.join('\n  - ')}\nOr pass --python /path/to/a/venv/python.`,
  );
  process.exit(2);
}

const children = [];
const color = { server: 36, scanner: 33, dollarpy: 35, web: 32, demo: 31 };
function say(name, line) {
  console.log(`\x1b[${color[name] ?? 0}m[${name}]\x1b[0m ${line}`);
}
function run(name, cmd, cmdArgs, env = {}) {
  const p = spawn(cmd, cmdArgs, {
    cwd: root,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const pipe = (s) => {
    let buf = '';
    s.setEncoding('utf8');
    s.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        say(name, buf.slice(0, i));
        buf = buf.slice(i + 1);
      }
    });
  };
  pipe(p.stdout);
  pipe(p.stderr);
  p.on('exit', (c) => say(name, `stopped (${c})`));
  children.push(p);
  return p;
}
const stopAll = () => children.forEach((c) => c.kill());
process.on('SIGINT', () => {
  stopAll();
  process.exit(0);
});

const waitFor = async (what, fn, ms = 40000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      if (await fn()) return true;
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  say('demo', `gave up waiting for: ${what}`);
  return false;
};

console.log(
  REAL
    ? '\nREAL mode: your Bluetooth adapter and your webcam. Needs tools/bluetooth/devices.json (copy devices.example.json).'
    : '\n*** FAKE mode: a SIMULATED Bluetooth device and SIMULATED hand paths. No hardware is used and nothing here proves the hardware works. ***',
);

run('server', 'node', ['server/index.ts'], {
  SENTENCE_PROVIDER: process.env.ANTHROPIC_API_KEY ? '' : 'offline',
  WS_PORT: String(WS),
  TCP_PORT: String(TCP),
});
if (!has('--no-web')) run('web', 'npx', ['vite', '--port', String(WEB), '--strictPort']);
const ok = await waitFor(
  'the server',
  async () => (await fetch(`http://127.0.0.1:${WS}/health`)).ok,
);
if (!ok) {
  stopAll();
  process.exit(1);
}
if (!has('--no-web'))
  await waitFor('the web app', async () => (await fetch(`http://localhost:${WEB}/`)).ok);

// the app's side, for --check: an app listening on the WebSocket sees what the other programs send
const heard = { context: null, letter: null };
let listener = null;
if (CHECK) {
  listener = new WebSocket(`ws://127.0.0.1:${WS}`, { origin: `http://localhost:${WEB}` });
  listener.on('message', (d) => {
    const m = JSON.parse(d.toString());
    if (m.type === 'context' && m.userId) heard.context = m;
    if (m.type === 'letter') heard.letter = m;
  });
  await new Promise((r) => listener.on('open', r));
}

if (REAL) run('scanner', python, ['tools/bluetooth/scan.py', '-v', '--port', String(TCP)]);
else run('scanner', python, ['tools/bluetooth/scan.py', '--fake', device, '--port', String(TCP)]);

const classify = () =>
  REAL
    ? run('dollarpy', python, ['tools/dollarpy/classify_live.py', '--port', String(TCP)])
    : run('dollarpy', python, [
        'tools/dollarpy/classify_live.py',
        '--simulate',
        ...letters,
        '--synthetic-templates',
        '--port',
        String(TCP),
      ]);

if (CHECK) {
  const [user, place] = device.split(':');
  const gotContext = await waitFor(
    'the simulated device to reach the app',
    () => heard.context !== null,
    30000,
  );
  classify();
  const gotLetter = await waitFor(
    'the simulated letter to reach the app',
    () => heard.letter !== null,
    30000,
  );
  const rows = [
    ['server up (WebSocket + TCP)', true],
    [
      'scanner (FAKE) -> server -> app: who and where',
      gotContext &&
        heard.context.userId === user &&
        heard.context.place === place &&
        heard.context.demo === true,
    ],
    [
      'dollarpy client (SIMULATED) -> server -> app: a letter',
      gotLetter && heard.letter.demo === true && letters.includes(heard.letter.letter),
    ],
  ];
  console.log('\n' + rows.map(([n, r]) => `${r ? 'PASS' : 'FAIL'}  ${n}`).join('\n'));
  listener.close();
  stopAll();
  const bad = rows.filter((r) => !r[1]).length;
  console.log(
    bad
      ? `\n${bad} check(s) FAILED`
      : '\nthe demo chain works (FAKE mode: no hardware was involved)',
  );
  setTimeout(() => process.exit(bad ? 1 : 0), 300);
} else {
  say('demo', `open ${webUrl}  (add &dev=1 for the developer panels)`);
  say(
    'demo',
    'on the spelling screen a recognised letter appears as a card: point and hold to add it. Ctrl+C stops everything.',
  );
  setTimeout(classify, 6000);
  // the simulation ends after two letters: run it again now and then so the audience can catch it on the spelling screen
  if (!REAL) setInterval(classify, 30000);
}
