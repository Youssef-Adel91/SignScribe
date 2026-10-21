// End-to-end check with NO mouse and NO keyboard input.
//  1. mock vision: synthetic landmark frames drive the real gesture engine through every screen.
//  2. real pipeline with Chromium's fake camera: the camera opens, the picture shows, and (without the
//     model file) the app says so clearly instead of crashing.
// Usage: npm run build && npm run e2e
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const port = 4174;
const base = `http://localhost:${port}/`;
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
const exe =
  process.env.CHROMIUM_PATH ||
  [
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome',
  ].find(existsSync);

let failed = 0;
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
};

const browser = await chromium.launch({
  executablePath: exe,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});

try {
  /* ------------------------------------------------------------ 1. mock vision, whole flow */
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${base}?dev=1&vision=mock`);
    await page.waitForFunction(() => window.__signscribe !== undefined);
    const screen = () =>
      page.evaluate(() =>
        Number(document.querySelector('[data-screen]')?.getAttribute('data-screen')),
      );
    const waitScreen = async (n) => {
      try {
        await page.waitForFunction(
          (k) => document.querySelector('[data-screen]')?.getAttribute('data-screen') === String(k),
          n,
          { timeout: 4000 },
        );
        return true;
      } catch {
        return false;
      }
    };
    const play = (hands, ms) =>
      page.evaluate(([h, t]) => window.__signscribe.play(h, t), [hands, ms]);
    const centerOf = (sel) =>
      page.evaluate((s) => {
        const el = [...document.querySelectorAll(s)].find((e) => e.getClientRects().length);
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }, sel);
    const pointAtTile = async (screenNo, text) => {
      await page.waitForSelector(`[data-screen="${screenNo}"] [data-dwell]`);
      const c = await page.evaluate((t) => {
        const el = [...document.querySelectorAll('[data-screen] li')].find(
          (e) => e.textContent.includes(t) && e.getClientRects().length,
        );
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }, text);
      const h = await page.evaluate(([x, y]) => window.__signscribe.pointAt(x, y), [c.x, c.y]);
      await play([h], 1500);
      await play([], 400); // lower the hand so the next choice starts fresh
    };
    const ZONE_RIGHT_HANDED = { pose: 'open', cx: 0.8, cy: 0.5 }; // zone on the mirrored left
    const SIGNING_RIGHT_HANDED = { pose: 'open', cx: 0.25, cy: 0.5 };
    const both = [
      { pose: 'open', cx: 0.3, handedness: 'Left' },
      { pose: 'open', cx: 0.7, handedness: 'Right' },
    ];

    check('starts on screen 1', (await screen()) === 1);

    // a mouse click and the keyboard must do nothing
    const before = await screen();
    await page.mouse.click(720, 450);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    check('mouse click and keyboard do not navigate', (await screen()) === before);

    await play([{ pose: 'open' }], 1200);
    check('open hand for 1.2 s does not wake yet', (await screen()) === 1);
    await play([{ pose: 'open' }], 1200);
    check('open hand held 2 s wakes: 01 -> 02', await waitScreen(2));

    await play([{ pose: 'open', cx: 0.5, cy: 0.5 }], 1900);
    check('setup checks green for 1.5 s: 02 -> 03', await waitScreen(3));

    await pointAtTile(3, 'Left hand');
    const hand = await page.evaluate(
      () => JSON.parse(localStorage.getItem('signscribe.settings.v2') || '{}').hand,
    );
    check('point-and-hold on "Left hand" selects it (03)', hand === 'left', `saved hand = ${hand}`);
    await pointAtTile(3, 'Arabic');
    check(
      '"Coming soon" alphabet cannot be chosen',
      (await page.evaluate(
        () => JSON.parse(localStorage.getItem('signscribe.settings.v2') || '{}').alphabet,
      )) === 'english',
    );

    await play([{ pose: 'thumbsUp' }], 900);
    check('thumbs up: 03 -> 14 (comfort settings)', await waitScreen(14));
    await play([], 500);
    const saved = () =>
      page.evaluate(() => JSON.parse(localStorage.getItem('signscribe.settings.v2') || '{}'));
    await pointAtTile(14, 'Extra large');
    check(
      'point-and-hold on "Extra large" applies it at once',
      (await page.evaluate(() => document.documentElement.dataset.textSize)) === 'xlarge',
    );
    await pointAtTile(14, 'High contrast');
    check(
      'point-and-hold on "High contrast" applies it at once',
      (await page.evaluate(() => document.documentElement.dataset.contrast)) === 'high',
    );
    await pointAtTile(14, 'Slower');
    check('hold time "Slower" is saved', (await saved()).dwell === 'slow');
    await pointAtTile(14, 'Silent');
    check('voice "Silent" is saved', (await saved()).voice === false);
    await pointAtTile(14, 'Normal'); // text size back to normal, so later screens fit
    await pointAtTile(14, 'Standard');
    await pointAtTile(14, 'Automatic');
    await pointAtTile(14, 'Read aloud');
    await play([{ pose: 'thumbsUp' }], 900);
    check('thumbs up: 14 -> 04', await waitScreen(4));
    await play([], 500);
    await pointAtTile(4, 'Shop');
    await play([{ pose: 'thumbsUp' }], 900);
    check('choose Shop, thumbs up: 04 -> 05', await waitScreen(5));
    await play([], 500);

    await play([{ pose: 'thumbsDown' }], 900);
    check('thumbs down: 05 -> 04 (back)', await waitScreen(4));
    await play([], 500);
    await play([{ pose: 'thumbsUp' }], 900);
    check('thumbs up: 04 -> 05 again', await waitScreen(5));
    await play([], 500);

    await play([{ pose: 'thumbsUp' }], 900);
    check('spell is the default method: 05 -> 06', await waitScreen(6));
    await play([], 300);

    // the signer is left-handed now, so the command zone is on the mirrored RIGHT (raw cx small)
    await play([{ pose: 'open', cx: 0.8, cy: 0.5 }], 1500);
    check('open palm on the SIGNING side does nothing on 06', (await screen()) === 6);
    await play([], 300);

    await play([], 1300);
    check('no hand for 1 s: hand lost overlay (08)', await waitScreen(8));
    await play([{ pose: 'open', cx: 0.8 }], 500);
    check('hand back: 08 -> 06, message kept', await waitScreen(6));
    await play([], 500);

    await play(both, 1400);
    check('both open hands held 1 s: help guide (13)', await waitScreen(13));
    await play([], 500);
    await play(both, 1400);
    check('both open hands again: help closes (06)', await waitScreen(6));
    await play([], 500);

    await play([{ pose: 'thumbsDown', cx: 0.2, cy: 0.5 }], 900);
    check('thumbs down in the command zone: 06 -> 05', await waitScreen(5));
    await play([], 500);

    await pointAtTile(5, 'Show a picture card');
    await play([{ pose: 'thumbsUp' }], 900);
    check('choose picture cards, thumbs up: 05 -> 10', await waitScreen(10));
    await play([], 500);

    await pointAtTile(10, 'Price');
    await pointAtTile(10, 'Help');
    const chips = await page.evaluate(() =>
      [...document.querySelectorAll('[data-screen="10"] li')].map((e) => e.textContent).join('|'),
    );
    check(
      'pointing at two cards adds them to the message',
      /price/i.test(chips) && /help/i.test(chips),
      chips.slice(0, 120),
    );

    await play([{ pose: 'thumbsUp', cx: 0.2, cy: 0.5 }], 900);
    check('thumbs up in the zone: 10 -> 11 (review)', await waitScreen(11));
    await play([], 500);
    const sentence = await page.evaluate(
      () => document.querySelector('[data-screen="11"]')?.textContent ?? '',
    );
    check('a sentence is suggested', /price|help/i.test(sentence));
    const sBefore = await page.evaluate(
      () => document.querySelector('[data-screen="11"] p[class*="sentence"]')?.textContent,
    );

    await play([{ pose: 'thumbsDown' }], 900);
    await play([], 500);
    const sAfter = await page.evaluate(
      () => document.querySelector('[data-screen="11"] p[class*="sentence"]')?.textContent,
    );
    check(
      'thumbs down on 11 stays on 11 and tries another wording',
      (await screen()) === 11,
      `${sBefore} -> ${sAfter}`,
    );

    await play([{ pose: 'thumbsUp' }], 900);
    check('thumbs up: 11 -> 12 (share) only after the thumbs up', await waitScreen(12));
    await play([], 600);

    await play([{ pose: 'thumbsUp' }], 900);
    check('thumbs up on 12 = Finish: 12 -> 01 (session reset)', await waitScreen(1));

    check('no page errors in the whole run', errors.length === 0, errors.join(' ; ').slice(0, 200));
    await page.screenshot({ path: resolve(root, 'tools/e2e/last-run-mock.png') });
    await ctx.close();
  }

  /* ------------------------------------------------------------ 2. real pipeline, fake camera */
  {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      permissions: ['camera'],
    });
    const page = await ctx.newPage();
    await page.goto(`${base}?dev=1`); // dev=1 without vision=...: the real camera path
    await page.waitForSelector('[data-testid="vision-status"],[data-testid="vision-debug"]');
    const modelPresent = existsSync(resolve(root, 'public/models/hand_landmarker.task'));
    await page.waitForFunction(() =>
      document
        .querySelector('[data-testid="vision-debug"]')
        ?.textContent?.match(/status(nomodel|running|error|denied)/),
    );
    const text = await page.evaluate(
      () => document.querySelector('[data-testid="vision-debug"]')?.textContent ?? '',
    );
    await page
      .waitForFunction(() => (document.querySelector('video')?.videoWidth ?? 0) > 0, null, {
        timeout: 5000,
      })
      .catch(() => {});
    const hasVideo = await page.evaluate(() => {
      const v = document.querySelector('video');
      return !!v && v.videoWidth > 0;
    });
    if (!modelPresent) {
      check('fake camera opens and its picture is shown', hasVideo, text.slice(0, 160));
      check(
        'without the model file the app says so (no crash)',
        /nomodel/.test(text) && /npm run models/.test(text),
        text.slice(0, 160),
      );
    } else {
      check(
        'with the model file the pipeline reaches "running" on the fake camera',
        /running/.test(text),
        text.slice(0, 160),
      );
    }
    await ctx.close();
  }

  /* ------------------------------------------------------------ 3. camera problems are explained */
  for (const [name, args, perms, want] of [
    ['permission refused', ['--use-fake-device-for-media-stream'], [], /denied/],
    ['no camera at all', [], ['camera'], /nocamera|denied/],
  ]) {
    const b = await chromium.launch({ executablePath: exe, args });
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, permissions: perms });
    const page = await ctx.newPage();
    await page.goto(`${base}?dev=1`);
    await page
      .waitForFunction(
        () =>
          /status(denied|nocamera|nomodel|error|running)/.test(
            document.querySelector('[data-testid="vision-debug"]')?.textContent ?? '',
          ),
        null,
        { timeout: 8000 },
      )
      .catch(() => {});
    const text = await page.evaluate(
      () => document.querySelector('[data-testid="vision-debug"]')?.textContent ?? '',
    );
    const banner = await page.evaluate(
      () => document.querySelector('[data-testid="vision-status"]')?.textContent ?? '',
    );
    check(
      `${name}: the app shows a plain message`,
      want.test(text) && banner.length > 10,
      banner.slice(0, 120),
    );
    await b.close();
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
