// End-to-end check of the comparison study (?study=1): participant 0 does the camera block (task A1 through
// the real gesture flow with synthetic hands, A2 and A3 given up), the survey, the keyboard block, the survey
// and the comparison; then the exported CSV is checked. Synthetic hands prove the logic, not real tracking.
// Usage: npm run build && npm run e2e:study
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const port = 4178;
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
let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
};
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    [
      '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
      '/opt/pw-browsers/chromium/chrome-linux/chrome',
    ].find(existsSync),
});
try {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
    acceptDownloads: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}?dev=1&study=1&vision=mock`);
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
  const pointAtTile = async (screenNo, text) => {
    await page.waitForSelector(`[data-screen="${screenNo}"] [data-dwell]`);
    const c = await page.evaluate((t) => {
      const el = [...document.querySelectorAll('[data-screen] li')].find(
        (e) => e.dataset.dwell && e.textContent.includes(t) && e.getClientRects().length,
      );
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, text);
    const h = await page.evaluate(([x, y]) => window.__signscribe.pointAt(x, y), [c.x, c.y]);
    await play([h], 1500);
    await play([], 400);
  };
  const panel = page.locator('[data-testid="study-panel"]');
  const clickPanel = (name) => panel.getByRole('button', { name }).click();

  await panel.locator('input[type=number]').fill('0');
  await clickPanel('Start session');
  await page.waitForSelector('form');
  check(
    'the background questions and consent come first',
    /Before we start/.test(await page.textContent('form')),
  );
  const startBtn = page.getByRole('button', { name: /left|Tick the consent|Start$/ });
  check(
    'Start is disabled until everything is answered and the consent is ticked',
    await startBtn.isDisabled(),
  );
  const pg = await page.locator('form fieldset').count();
  for (let i = 0; i < pg; i++)
    await page.locator('form fieldset').nth(i).locator('input[type=radio]').first().check();
  check(
    '...still disabled without the consent tick',
    await page.getByRole('button', { name: 'Tick the consent line' }).isDisabled(),
  );
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  check(
    'participant 0 starts with the camera block',
    /Camera hand signs/.test(await panel.textContent()),
  );

  // ---- camera task A1: the real flow, no mouse on the app
  await clickPanel('Start task');
  check('camera trial starts at the context screen (04)', await waitScreen(4));
  await play([{ pose: 'thumbsUp' }], 900);
  check('04 -> 05', await waitScreen(5));
  await play([], 500);
  await pointAtTile(5, 'Show a picture card');
  await play([{ pose: 'thumbsUp' }], 900);
  check('05 -> 10', await waitScreen(10));
  await play([], 500);
  await pointAtTile(10, 'Doctor');
  await pointAtTile(10, 'Help');
  await play([{ pose: 'thumbsUp', cx: 0.8, cy: 0.5 }], 900);
  check('10 -> 11', await waitScreen(11));
  await play([], 500);
  await play([{ pose: 'thumbsDown' }], 900); // one rejection: "try another"
  await play([], 500);
  await play([{ pose: 'thumbsUp' }], 900);
  await play([], 600);
  await page.waitForFunction(
    () =>
      /task 2 of 3/.test(document.querySelector('[data-testid="study-panel"]')?.textContent ?? ''),
    null,
    { timeout: 4000 },
  );
  check('reaching screen 12 ends the camera trial; task 2 is ready', true);

  // ---- tasks 2 and 3: a restart must not end the trial by itself (stale screen 12), then give up
  await clickPanel('Start task');
  check(
    'second camera trial restarts at 04, not ended by the old share screen',
    await waitScreen(4),
  );
  check('...and is still running', /Time:/.test(await panel.textContent()));
  await clickPanel('Participant gave up');
  await clickPanel('Start task');
  await waitScreen(4);
  await clickPanel('Participant gave up');

  // ---- survey 1 (camera)
  await page.waitForSelector('form');
  check(
    'survey appears after the camera block',
    /Camera hand signs/.test(await page.textContent('form')),
  );
  const submit = page.getByRole('button', { name: /question.*left|Send answers/ });
  check('submit is disabled until every question is answered', await submit.isDisabled());
  const groups = await page.locator('form fieldset').count();
  for (let i = 0; i < groups; i++)
    await page.locator('form fieldset').nth(i).locator('input[type=radio]').nth(2).check();
  await page.getByRole('button', { name: 'Send answers' }).click();

  // ---- keyboard block, set B (participant 0)
  check('keyboard block follows', /Keyboard and mouse/.test(await panel.textContent()));
  await clickPanel('Start task');
  await page.waitForSelector('[data-testid="keyboard-task"]');
  await page.getByLabel('Clinic').check();
  await page.getByRole('textbox').fill('medicinx');
  await page.getByRole('textbox').press('Backspace');
  await page.getByRole('textbox').fill('medicine water');
  await page.getByRole('button', { name: 'Show sentence' }).click();
  await page.getByRole('button', { name: 'Try another' }).click();
  await page.getByRole('button', { name: 'Use this sentence' }).click();
  await clickPanel('Participant gave up').catch(() => {});
  // tasks 2 and 3 of the keyboard block
  for (let k = 0; k < 2; k++) {
    await clickPanel('Start task');
    await page.waitForSelector('[data-testid="keyboard-task"]');
    await clickPanel('Participant gave up');
  }
  await page.waitForSelector('form');
  const groups2 = await page.locator('form fieldset').count();
  for (let i = 0; i < groups2; i++)
    await page.locator('form fieldset').nth(i).locator('input[type=radio]').nth(3).check();
  await page.getByRole('button', { name: 'Send answers' }).click();

  // ---- comparison
  await page.waitForSelector('form');
  const cmp = await page.locator('form fieldset').count();
  check(
    'comparison has 3 questions, each with a neutral middle',
    cmp === 3 && (await page.getByLabel('No difference').count()) === 3,
  );
  for (let i = 0; i < cmp; i++)
    await page.locator('form fieldset').nth(i).getByLabel('No difference').check();
  await page.getByRole('button', { name: 'Send answers' }).click();
  await page.waitForFunction(() =>
    /Session finished/.test(
      document.querySelector('[data-testid="study-panel"]')?.textContent ?? '',
    ),
  );

  // ---- export and inspect
  const [dl] = await Promise.all([page.waitForEvent('download'), clickPanel('Trials CSV')]);
  const csv = (await (await import('node:fs/promises')).readFile(await dl.path(), 'utf8'))
    .trim()
    .split('\n');
  check('trials CSV: header + 6 trials', csv.length === 7, `${csv.length} lines`);
  const rows = csv.slice(1).map((l) => l.split(','));
  const col = (n) => csv[0].split(',').indexOf(n);
  check(
    'camera trial A1: succeeded with 1 rejection (thumbs down on 11)',
    rows[0][col('mode')] === 'camera' &&
      rows[0][col('success')] === 'true' &&
      rows[0][col('rejections')] === '1',
    rows[0].join(' | '),
  );
  check(
    'camera trials 2 and 3 are logged as gave up',
    rows[1][col('ended_by')] === 'gaveup' && rows[2][col('ended_by')] === 'gaveup',
  );
  check(
    'keyboard trial B1: 1 backspace, 1 "try another", success',
    rows[3][col('mode')] === 'keyboard' &&
      rows[3][col('corrections')] === '1' &&
      rows[3][col('rejections')] === '1' &&
      rows[3][col('success')] === 'true',
    rows[3].join(' | '),
  );
  check('no page errors', errors.length === 0, errors.join(' ; ').slice(0, 200));
  await ctx.close();
} finally {
  await browser.close();
  server.kill();
}
console.log(failed ? `\n${failed} check(s) FAILED` : '\nall study checks passed');
process.exit(failed ? 1 : 0);
