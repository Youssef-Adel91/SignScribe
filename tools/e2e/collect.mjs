// Collection mode and Wizard-of-Oz in a browser, with synthetic hands (no camera).
// Usage: npm run build && npm run e2e:collect
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const port = 4179;
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
  /* ---- collection mode */
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      acceptDownloads: true,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${base}?dev=1&vision=mock&collect=1`);
    await page.waitForFunction(() => window.__signscribe !== undefined);
    const play = (hands, ms) =>
      page.evaluate(([h, t]) => window.__signscribe.play(h, t), [hands, ms]);
    const panel = page.getByTestId('collect-panel');
    const rec = panel.getByRole('button', { name: /^Record/ });
    check('Record is disabled until signer and session are filled in', await rec.isDisabled());
    await panel.getByPlaceholder('s01').fill('s01');
    await panel.getByPlaceholder('lamp-60cm').fill('lamp-60cm');
    await panel.getByRole('radio', { name: /^Letter B,/ }).check();
    check('Record becomes available', await rec.isEnabled());
    const noneButtons = panel.getByRole('button', { name: /^None take:/ });
    check('four kinds of "none" take can be recorded', (await noneButtons.count()) === 4);
    check(
      'they are enabled with signer and session filled in',
      await noneButtons.first().isEnabled(),
    );
    await rec.click();
    await play([{ pose: 'fist', cx: 0.5, cy: 0.5, size: 0.2 }], 3300);
    check(
      'countdown then recording',
      /Recording B/.test(await page.getByTestId('collect-status').textContent()),
    );
    await play([{ pose: 'fist', cx: 0.5, cy: 0.5, size: 0.2 }], 1800);
    await page.waitForFunction(() =>
      /Saved: B/.test(document.querySelector('[data-testid="collect-status"]')?.textContent ?? ''),
    );
    check('a good static take is saved', true);

    // a bad take: hand cut off by the picture edge must not be saved
    await panel.getByRole('radio', { name: /^Letter C,/ }).check();
    await rec.click();
    await play([{ pose: 'fist', cx: 0.97, cy: 0.5, size: 0.2 }], 5200);
    await page.waitForFunction(() =>
      /Not saved/.test(document.querySelector('[data-testid="collect-status"]')?.textContent ?? ''),
    );
    check(
      'a take with the hand cut off is refused, with a reason',
      /outside the picture/.test(await page.getByTestId('collect-status').textContent()),
    );

    // J is recorded as a moving take
    await panel.getByRole('radio', { name: /^Letter J,/ }).check();
    await rec.click();
    await play([{ pose: 'point', cx: 0.5, cy: 0.5, size: 0.2 }], 3300);
    await play([{ pose: 'point', cx: 0.5, cy: 0.5, size: 0.2 }], 2600);
    await page.waitForFunction(() =>
      /Saved: J/.test(document.querySelector('[data-testid="collect-status"]')?.textContent ?? ''),
    );
    check('a moving take (J) is saved', true);

    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      panel.getByRole('button', { name: 'Export JSONL' }).click(),
    ]);
    const lines = readFileSync(await dl.path(), 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    check(
      'export has the 2 saved takes in the documented format',
      lines.length === 2 && lines[0].v === 1 && lines[0].frames[0].lm.length === 21,
      lines.map((t) => `${t.label}/${t.kind}/${t.frames.length}`).join(' '),
    );
    check(
      'takes carry signer, session, hand and video size',
      lines.every(
        (t) =>
          t.signer === 's01' &&
          t.session === 'lamp-60cm' &&
          t.hand === 'right' &&
          t.width === 1280 &&
          t.height === 720,
      ),
    );
    check(
      'no pictures are stored (only landmark numbers)',
      !JSON.stringify(lines).includes('data:image'),
    );
    await panel.getByRole('button', { name: 'Undo last take' }).click();
    await page.waitForFunction(() =>
      /Removed the last take/.test(
        document.querySelector('[data-testid="collect-status"]')?.textContent ?? '',
      ),
    );
    check('undo removes the last take', true);

    // guided run: letter prompt, countdown, automatic advance to the next letter that still has a gap
    await panel.getByLabel('Takes per letter').fill('1');
    check(
      'gaps are listed and colour is not the only signal',
      /Still needed \(target 1 per letter\): A 1, C 1/.test(
        await page.getByTestId('gaps').textContent(),
      ),
      await page.getByTestId('gaps').textContent(),
    );
    await panel.getByRole('button', { name: 'Start guided run' }).click();
    check(
      'guided run shows the letter to sign first',
      /^A\s*take 1 of 1/.test((await page.getByTestId('guided-prompt').textContent()).trim()),
      await page.getByTestId('guided-prompt').textContent(),
    );
    await play([{ pose: 'fist', cx: 0.5, cy: 0.5, size: 0.2 }], 5400);
    await page.waitForFunction(() =>
      /^C\s*take 1 of 1/.test(
        (document.querySelector('[data-testid="guided-prompt"]')?.textContent ?? '').trim(),
      ),
    );
    check('after A is saved the run moves on to C by itself (B already has a take)', true);
    await panel.getByRole('button', { name: 'Stop', exact: true }).click();
    check(
      'Stop ends the run and keeps the saved take',
      (await panel.getByRole('button', { name: 'Start guided run' }).isEnabled()) &&
        /Letter A, 1 of 1/.test(
          (await panel.getByRole('radio', { name: /^Letter A,/ }).getAttribute('aria-label')) ?? '',
        ),
    );
    check('no page errors', errors.length === 0, errors.join(' ; ').slice(0, 200));
    await ctx.close();
  }

  /* ---- controls (ArSL: space, done static; delete, cancel dynamic), with the person id */
  {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      acceptDownloads: true,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${base}?dev=1&vision=mock&collect=1&alphabet=arsl`);
    await page.waitForFunction(() => window.__signscribe !== undefined);
    const play = (hands, ms) =>
      page.evaluate(([h, t]) => window.__signscribe.play(h, t), [hands, ms]);
    const panel = page.getByTestId('collect-panel');
    const box = panel.getByTestId('control-takes');
    check('the Controls section is there for ArSL', await box.isVisible());
    const buttons = box.getByRole('button', { name: /^Control take:/ });
    check(
      'four controls: space, done (static), delete, cancel (dynamic)',
      (await buttons.count()) === 4,
    );
    const names = await buttons.allTextContents();
    check(
      'each says whether it is static or dynamic',
      names.some((n) => /space \(static\)/.test(n)) &&
        names.some((n) => /done \(static\)/.test(n)) &&
        names.some((n) => /delete \(dynamic\)/.test(n)) &&
        names.some((n) => /cancel \(dynamic\)/.test(n)),
      names.join(' | '),
    );
    check(
      'the letter list does not contain the controls',
      (await panel.getByRole('radio', { name: /ctl_/ }).count()) === 0,
    );
    await panel.getByPlaceholder('s01').fill('s07');
    await panel.getByPlaceholder('lamp-60cm').fill('desk');
    await box.getByRole('button', { name: /^Control take: space/ }).click();
    await play([{ pose: 'fist', cx: 0.5, cy: 0.5, size: 0.2 }], 5200);
    await page.waitForFunction(() =>
      /Saved: ctl_space/.test(
        document.querySelector('[data-testid="collect-status"]')?.textContent ?? '',
      ),
    );
    check('a static control take (space) is saved', true);
    const [dl] = await Promise.all([
      page.waitForEvent('download'),
      panel.getByRole('button', { name: 'Export JSONL' }).click(),
    ]);
    const lines = readFileSync(await dl.path(), 'utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    check(
      'the control take is labelled with the class, is static and carries the person id',
      lines.length === 1 &&
        lines[0].label === 'ctl_space' &&
        lines[0].kind === 'static' &&
        lines[0].person === 's07' &&
        lines[0].signer === 's07',
      JSON.stringify(lines.map((t) => [t.label, t.kind, t.person])),
    );
    check('no page errors', errors.length === 0, errors.join('; '));
    await ctx.close();
  }

  /* ---- Wizard of Oz */
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${base}?dev=1&vision=mock&woz=1#6`);
    await page.waitForSelector('[data-screen="6"]');
    const woz = page.getByTestId('woz-panel');
    for (const l of ['H', 'E', 'L', 'P'])
      await woz.getByRole('button', { name: l, exact: true }).click();
    const text = await page.evaluate(
      () => document.querySelector('[data-screen]')?.textContent ?? '',
    );
    check(
      'letters typed by the facilitator appear in the message',
      /HELP/.test(text),
      text.slice(0, 80),
    );
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
console.log(failed ? `\n${failed} check(s) FAILED` : '\nall collection checks passed');
process.exit(failed ? 1 : 0);
