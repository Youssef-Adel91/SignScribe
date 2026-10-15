// Checks that none of the 13 screens scrolls or overflows at 1280x720, 1440x900 and 1920x1080 (with and without live vision).
// Usage: npm run build && npm run layout
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const server = spawn('npx', ['vite', 'preview', '--port', '4177', '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
});
await new Promise((r) => setTimeout(r, 2500));
const b = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    [
      '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
      '/opt/pw-browsers/chromium/chrome-linux/chrome',
    ].find(existsSync),
});
let bad = 0;
for (const mode of ['off', 'mock'])
  for (const [w, h] of [
    [1280, 720],
    [1440, 900],
    [1920, 1080],
  ])
    for (let n = 1; n <= 13; n++) {
      const ctx = await b.newContext({ viewport: { width: w, height: h } });
      const p = await ctx.newPage();
      await p.goto(`http://localhost:4177/?dev=1&vision=${mode}#${n}`);
      await p.waitForSelector(`[data-screen="${n}"]`);
      await p.waitForTimeout(150);
      const r = await p.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        sh: document.documentElement.scrollHeight,
        bw: document.body.scrollWidth,
        bh: document.body.scrollHeight,
        iw: innerWidth,
        ih: innerHeight,
      }));
      const main = await p.evaluate(() => {
        const m = document.querySelector('main');
        return m
          ? { sh: m.scrollHeight, ch: m.clientHeight, sw: m.scrollWidth, cw: m.clientWidth }
          : null;
      });
      if (
        r.sw > r.iw ||
        r.sh > r.ih ||
        (main && (main.sh > main.ch + 1 || main.sw > main.cw + 1))
      ) {
        bad++;
        console.log(
          'OVERFLOW',
          mode,
          w + 'x' + h,
          'screen',
          n,
          JSON.stringify(r),
          JSON.stringify(main),
        );
      }
      await ctx.close();
    }
console.log('screens checked:', 2 * 3 * 13, 'overflowing:', bad);
await b.close();
server.kill();
