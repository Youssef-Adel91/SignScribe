// Renders each of the 13 screens from the built app (vite preview) and puts it next to its Figma export.
// Usage: npm run build && npm run compare [-- --size 1440x900] [-- --only 3,7]
// Output: tools/compare/out/<size>/NN-name.png (app), NN-name.compare.png (design | app)
import { chromium } from 'playwright';
import { spawnTool as spawn, stopTool } from '../lib/spawn-tool.mjs';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const arg = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const [W, H] = arg('size', '1440x900').split('x').map(Number);
const only = arg('only', '') ? arg('only', '').split(',').map(Number) : null;
const root = resolve(import.meta.dirname, '../..');
const designDir = join(root, 'public/design');
const out = join(root, 'tools/compare/out', `${W}x${H}`);
mkdirSync(out, { recursive: true });
const designs = readdirSync(designDir)
  .filter((f) => /^\d\d-.*\.png$/.test(f))
  .sort();

const port = 4173;
const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
});
const url = `http://localhost:${port}/`;
for (let i = 0; i < 50; i++) {
  try {
    if ((await fetch(url)).ok) break;
  } catch {
    /* not up yet */
  }
  await new Promise((r) => setTimeout(r, 200));
}
const exe =
  process.env.CHROMIUM_PATH ||
  [
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome',
  ].find(existsSync);
const browser = await chromium.launch({ executablePath: exe });
try {
  for (let n = 1; n <= 13; n++) {
    if (only && !only.includes(n)) continue;
    const name = designs[n - 1].replace('.png', '');
    const ctx = await browser.newContext({
      viewport: { width: W, height: H },
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    await page.goto(`${url}?dev=1&vision=off#${n}`);
    await page.waitForSelector(`[data-screen="${n}"]`);
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({
      content:
        'aside[aria-label="Developer simulator"], button[class*="reopen"]{display:none!important}',
    });
    await page.waitForTimeout(150);
    const shot = join(out, `${name}.png`);
    await page.screenshot({ path: shot });
    const d = readFileSync(join(designDir, designs[n - 1])).toString('base64');
    const a = readFileSync(shot).toString('base64');
    const cmp = await ctx.newPage();
    await cmp.setViewportSize({ width: 2 * W + 30, height: H + 40 });
    await cmp.setContent(`<body style="margin:0;background:#888;display:flex;gap:30px;font:14px sans-serif;color:#fff">
      <div>DESIGN<br><img style="width:${W}px;height:${H}px;object-fit:contain" src="data:image/png;base64,${d}"></div>
      <div>APP<br><img style="width:${W}px;height:${H}px" src="data:image/png;base64,${a}"></div></body>`);
    await cmp.screenshot({ path: join(out, `${name}.compare.png`) });
    await ctx.close();
    console.log('rendered', name);
  }
} finally {
  await browser.close();
  stopTool(server);
}
