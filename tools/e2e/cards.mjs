// Picture cards in a browser.
//  1. mock detections (no ONNX): tracker + hold-to-add + machine, with the rules (hold, no repeat, foreign card)
//  2. the REAL path in Chromium (fake camera): onnxruntime-web runs tests/fixtures/const-yolo.onnx, a test
//     fixture that always answers "Doctor card in the middle" - proves loading, preprocessing, decoding,
//     tracking and adding work together. It says nothing about how well a trained detector will do.
// Usage: npm run models && npm run build && npm run e2e:cards
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const port = 4180;
const base = `http://localhost:${port}/`;
const modelsDir = resolve(root, 'dist/models');
const fixture = resolve(root, 'tests/fixtures');
mkdirSync(modelsDir, { recursive: true });
const placed = [];
const place = (src, name) => {
  copyFileSync(src, resolve(modelsDir, name));
  placed.push(resolve(modelsDir, name));
};
const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
});
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(base)).ok) break;
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
const exe =
  process.env.CHROMIUM_PATH ||
  [
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome',
  ].find(existsSync);
const browser = await chromium.launch({
  executablePath: exe,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
// words already in the message (the ghost chip is a candidate that is not added yet)
const count = (page, word) =>
  page.evaluate(
    (w) =>
      [
        ...document.querySelectorAll('[data-screen="10"] [class*="msg"] li:not([class*="ghost"])'),
      ].filter((e) => new RegExp(w, 'i').test(e.textContent)).length,
    word,
  );
try {
  /* ---------- 1. mock detections */
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${base}?dev=1&vision=mock#10`);
    await page.waitForFunction(() => window.__signscribe !== undefined);
    await page.waitForSelector('[data-screen="10"]');
    // a hand holds the card, so the screen never thinks the hand is lost
    const hand = [{ pose: 'fist', cx: 0.3, cy: 0.5, size: 0.2 }];
    const play = (ms) => page.evaluate(([h, t]) => window.__signscribe.play(h, t), [hand, ms]);
    const setCards = (d) => page.evaluate((x) => window.__signscribe.setCards(x), d);
    const box = (classId, score = 0.9) => ({ x: 0.4, y: 0.3, w: 0.2, h: 0.35, classId, score });
    const before = await count(page, 'doctor');

    await setCards([box(0)]); // Doctor
    await play(600);
    check(
      'a candidate appears after the card has been seen for a moment',
      await page.getByTestId('card-box').isVisible(),
    );
    await play(1800);
    const afterHold = await count(page, 'doctor');
    check(
      'holding the card still adds it to the message',
      afterHold > before,
      `${before} -> ${afterHold}`,
    );
    await play(3000);
    check(
      'the same card staying in view is NOT added again',
      (await count(page, 'doctor')) === afterHold,
    );
    await setCards([]);
    await play(1500);
    await setCards([box(0)]);
    await play(3000);
    check(
      'after the card has left and comes back it can be added again',
      (await count(page, 'doctor')) > afterHold,
    );

    // a card that is only passing through
    await setCards([]);
    await play(1500);
    const n = await count(page, 'pain');
    await setCards([box(1)]); // Pain
    await play(500);
    await setCards([]);
    await play(1500);
    check(
      'a card shown for less than the hold time is not added',
      (await count(page, 'pain')) === n,
    );

    // a card of another place
    const price = (await page.evaluate(() => 6)) && 6; // class index of "Price" in src/data/contexts.json
    await setCards([box(price)]);
    await play(1200);
    check(
      'a card from another place is explained, not added',
      /not part of this place/.test((await page.getByTestId('card-notice').textContent()) ?? ''),
    );
    await setCards([]);
    check('no page errors', errors.length === 0, errors.join(' ; ').slice(0, 200));
    await ctx.close();
  }

  /* ---------- 2. the real ONNX path */
  if (
    !existsSync(resolve(root, 'public/models/hand_landmarker.task')) ||
    !existsSync(resolve(root, 'dist/models/ort/ort-wasm-simd-threaded.wasm'))
  ) {
    console.log('SKIP  real ONNX path: run `npm run models` and rebuild first');
  } else {
    place(resolve(fixture, 'const-yolo.onnx'), 'cards.onnx');
    place(resolve(fixture, 'const-yolo.cards.json'), 'cards.json');
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      permissions: ['camera'],
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${base}?dev=1#10`);
    await page.waitForSelector('[data-screen="10"]');
    try {
      await page.waitForFunction(
        () =>
          /generated test data/.test(
            document.querySelector('[data-testid="card-notice"]')?.textContent ?? '',
          ),
        null,
        { timeout: 30000 },
      );
      check('the ONNX model loads and is flagged as test data', true);
    } catch {
      check(
        'the ONNX model loads and is flagged as test data',
        false,
        (await page
          .getByTestId('card-notice')
          .textContent()
          .catch(() => 'no notice')) ?? '',
      );
    }
    try {
      await page.waitForFunction(
        () =>
          /doctor/i.test(
            [...document.querySelectorAll('[data-screen="10"] ul')]
              .map((u) => u.textContent)
              .join('|'),
          ) && document.querySelector('[data-testid="card-box"]'),
        null,
        { timeout: 30000 },
      );
      check('the detector sees the card, SORT confirms it and the card is drawn', true);
    } catch {
      check('the detector sees the card, SORT confirms it and the card is drawn', false);
    }
    await page
      .waitForFunction(
        () =>
          /doctor/i.test(
            document.querySelector('[data-screen="10"] [class*="msg"]')?.textContent ?? '',
          ),
        null,
        { timeout: 30000 },
      )
      .then(
        () => check('holding it adds "doctor" to the message, through the real ONNX path', true),
        () => check('holding it adds "doctor" to the message, through the real ONNX path', false),
      );
    check('no page errors', errors.length === 0, errors.join(' ; ').slice(0, 200));
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
  for (const f of placed) rmSync(f, { force: true });
}
console.log(failed ? `\n${failed} check(s) FAILED` : '\nall card checks passed');
process.exit(failed ? 1 : 0);
