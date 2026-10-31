// Bluetooth context end to end, with NO Bluetooth hardware: the real scanner script in FAKE mode -> TCP -> the real server
// -> WebSocket -> the real app in a browser. Checks that the place and the person's saved settings are loaded, shown,
// can be overridden by pointing, and that everything goes back when nothing is detected.
// Usage: npm run build && npm run e2e:context
import { chromium } from 'playwright';
import { spawnTool as spawn, stopTool } from '../lib/spawn-tool.mjs';
import { existsSync } from 'node:fs';
import { resolvePython, pythonEnv, waitUntil } from '../lib/python.mjs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const previewPort = 4184;
const wsPort = 8795;
const tcpPort = 8796;
const base = `http://localhost:${previewPort}/`;
const python = resolvePython(root);
const preview = spawn('npx', ['vite', 'preview', '--port', String(previewPort), '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
});
const server = spawn('node', ['server/index.ts'], {
  cwd: root,
  env: {
    ...process.env,
    SENTENCE_PROVIDER: 'offline',
    WS_PORT: String(wsPort),
    TCP_PORT: String(tcpPort),
    ALLOWED_ORIGINS: base.slice(0, -1),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOut = '';
server.stdout.on('data', (d) => (serverOut = (serverOut + d).slice(-4000)));
server.stderr.on('data', (d) => (serverOut = (serverOut + d).slice(-4000)));
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(base)).ok && (await fetch(`http://127.0.0.1:${wsPort}/health`)).ok) break;
  } catch {
    /* starting */
  }
  await new Promise((r) => setTimeout(r, 200));
}
let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
};
let scanner = null;
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    [
      '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
      '/opt/pw-browsers/chromium/chrome-linux/chrome',
    ].find(existsSync),
});
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  // youssef has saved settings from an earlier visit: large text, left hand
  await ctx.addInitScript(() => {
    if (!localStorage.getItem('signscribe.profile.v1.youssef'))
      localStorage.setItem(
        'signscribe.profile.v1.youssef',
        JSON.stringify({
          hand: 'left',
          alphabet: 'english',
          textSize: 'large',
          contrast: 'standard',
          dwell: 'slow',
          voice: false,
        }),
      );
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}?dev=1&vision=mock&server=ws://localhost:${wsPort}#4`);
  await page.waitForSelector('[data-screen="4"]');
  const chipText = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('header li')].map((l) => l.textContent.trim()).join(' | '),
    );
  const selectedPlace = () =>
    page.evaluate(() => {
      const li = [...document.querySelectorAll('[data-screen="4"] li')].find((l) =>
        /selected/.test(l.textContent),
      );
      return li ? li.textContent.match(/Clinic|Shop|Work|Home/)?.[0] : null;
    });
  const textSize = () => page.evaluate(() => document.documentElement.dataset.textSize);

  check(
    'with no scanner the app is exactly as before (no Bluetooth chip, Clinic, normal text)',
    !/Bluetooth/.test(await chipText()) &&
      (await selectedPlace()) === 'Clinic' &&
      (await textSize()) === 'normal',
    await chipText(),
  );

  scanner = spawn(
    python,
    [
      'tools/bluetooth/scan.py',
      '--fake',
      'youssef:Shop',
      '--fake-seconds',
      '8',
      '--port',
      String(tcpPort),
    ],
    {
      cwd: root,
      env: pythonEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  let scannerOut = '';
  scanner.stdout.on('data', (d) => (scannerOut += d));
  scanner.stderr.on('data', (d) => (scannerOut += d));
  await page.waitForFunction(
    () => /Bluetooth: youssef/.test(document.querySelector('header')?.textContent ?? ''),
    null,
    { timeout: 15000 },
  );
  check(
    'who and where are shown, and the device is labelled as a demo',
    /Bluetooth: youssef · Shop \(demo device\)/.test(await chipText()),
    await chipText(),
  );
  check(
    'the detected place is loaded (Shop is selected on "Where are you today?")',
    (await selectedPlace()) === 'Shop',
  );
  check("the person's saved settings are loaded (large text)", (await textSize()) === 'large');
  // the banner is printed (and flushed) when the scanner starts: wait for it, do not look at one fixed moment
  const sawBanner = await waitUntil(() => /FAKE BLE DEVICE/.test(scannerOut), 10000);
  check(
    'the scanner said it is FAKE',
    sawBanner,
    scannerOut.split('\n')[0] || '(no output at all)',
  );

  // override by pointing and holding on the visible "ignore" target (no mouse, no keyboard)
  const ignore = page.getByTestId('ignore-detected');
  check(
    'a visible way to override is on the screen and is a point-and-hold target',
    (await ignore.count()) === 1 && (await ignore.getAttribute('data-dwell')) === 'true',
  );
  const box = await ignore.boundingBox();
  const hand = await page.evaluate(
    ([x, y]) => window.__signscribe.pointAt(x, y),
    [box.x + box.width / 2, box.y + box.height / 2],
  );
  await page.evaluate(([h, t]) => window.__signscribe.play(h, t), [[hand], 2500]);
  await page.waitForFunction(
    () => /Bluetooth ignored/.test(document.querySelector('header')?.textContent ?? ''),
    null,
    { timeout: 5000 },
  );
  check(
    'pointing at "ignore" undoes the place and the settings',
    (await selectedPlace()) === 'Clinic' && (await textSize()) === 'normal',
  );

  // the scanner's fake device disappears after 8 s: the app goes back to normal with nothing to do
  await page.waitForFunction(
    () => !/Bluetooth/.test(document.querySelector('header')?.textContent ?? ''),
    null,
    { timeout: 25000 },
  );
  check(
    'when the device is gone the Bluetooth label goes too',
    !/Bluetooth/.test(await chipText()),
    await chipText(),
  );

  // a letter recognised by the dollarpy client (SIMULATED here) is offered on the spelling screen and added by pointing
  {
    const spell = await ctx.newPage();
    // log what the app really receives over the WebSocket, so a timeout below says what was missing
    const wsLog = [];
    spell.on('websocket', (ws) => {
      wsLog.push(`open ${ws.url()}`);
      ws.on('framereceived', (f) => wsLog.push(`recv ${String(f.payload).slice(0, 160)}`));
      ws.on('close', () => wsLog.push('closed'));
      ws.on('socketerror', (e) => wsLog.push(`error ${e}`));
    });
    await spell.goto(`${base}?dev=1&vision=mock&server=ws://localhost:${wsPort}#6`);
    await spell.waitForSelector('[data-screen="6"]');
    const client = spawn(
      python,
      [
        'tools/dollarpy/classify_live.py',
        '--simulate',
        'J',
        '--synthetic-templates',
        '--fast',
        '--port',
        String(tcpPort),
      ],
      {
        cwd: root,
        env: pythonEnv(),
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let clientOut = '';
    client.stdout.on('data', (d) => (clientOut += d));
    client.stderr.on('data', (d) => (clientOut += d));
    try {
      await spell.waitForSelector('[data-testid="remote-letter"]', { timeout: 15000 });
    } catch (e) {
      console.log('\nremote-letter did NOT appear within 15 s. What was seen:');
      console.log(
        `  app WebSocket frames (${wsLog.length}):\n    ${wsLog.join('\n    ') || '(none: the page never opened a WebSocket)'}`,
      );
      console.log(
        `  python client output:\n    ${clientOut.trim().split('\n').join('\n    ') || '(nothing)'}`,
      );
      console.log(
        `  server output:\n    ${(serverOut || '(not captured)').trim().split('\n').join('\n    ')}`,
      );
      throw e;
    }
    const offer = await spell.getByTestId('remote-letter').textContent();
    check(
      'the recognised letter is offered, labelled as simulated',
      /dollarpy: J \(simulated\)/.test(offer),
      offer,
    );
    check(
      'the python client said it is simulated',
      /SIMULATED INPUT/.test(clientOut) && /recognised J/.test(clientOut),
    );
    const before = await spell.locator('[data-screen="6"]').textContent();
    const b = await spell.getByTestId('remote-letter').boundingBox();
    const h = await spell.evaluate(
      ([x, y]) => window.__signscribe.pointAt(x, y),
      [b.x + b.width / 2, b.y + b.height / 2],
    );
    await spell.evaluate(([hs, t]) => window.__signscribe.play(hs, t), [[h], 2500]);
    await spell.waitForFunction(
      () => !document.querySelector('[data-testid="remote-letter"]'),
      null,
      { timeout: 5000 },
    );
    const after = await spell.locator('[data-screen="6"]').textContent();
    check(
      'pointing and holding adds the letter to the message, once',
      !/J/.test(before.replace(/dollarpy: J/g, '')) && /J/.test(after),
      after.slice(0, 120),
    );
    stopTool(client);
    await spell.close();
  }

  // the server going away changes nothing for the person
  stopTool(server);
  await page.waitForTimeout(500);
  check(
    'the page still works with the server gone',
    (await page.locator('[data-screen="4"]').count()) === 1,
  );
  check('no page errors', errors.length === 0, errors.join(' ; ').slice(0, 200));
  await ctx.close();
} finally {
  stopTool(scanner);
  await browser.close();
  stopTool(server);
  stopTool(preview);
}
console.log(failed ? `\n${failed} check(s) FAILED` : '\nall context checks passed');
process.exit(failed ? 1 : 0);
