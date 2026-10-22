// Automated accessibility audit (axe-core, WCAG 2.0/2.1 A + AA rules) of every screen in every display setting,
// plus the forms of the study mode (survey, keyboard task) and the collection page.
// Automated rules find about a third of real problems: this does NOT replace a test with a screen reader.
// Usage: npm run build && npm run axe [-- --verbose]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const verbose = process.argv.includes('--verbose');
const port = 4183;
const base = `http://localhost:${port}/`;
const axeSource = readFileSync(resolve(root, 'node_modules/axe-core/axe.min.js'), 'utf8');
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
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    [
      '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
      '/opt/pw-browsers/chromium/chrome-linux/chrome',
    ].find(existsSync),
});
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];
const found = new Map(); // rule -> {impact, help, nodes: Set}
let pages = 0;

async function audit(label, url, settings = {}, prepare) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  await page.addInitScript(
    (s) => localStorage.setItem('signscribe.settings.v2', JSON.stringify(s)),
    settings,
  );
  await page.goto(url);
  await page.waitForTimeout(400);
  if (prepare) await prepare(page);
  await page.addScriptTag({ content: axeSource });
  const res = await page.evaluate(
    (tags) => window.axe.run(document, { runOnly: { type: 'tag', values: tags } }),
    TAGS,
  );
  pages++;
  for (const v of res.violations) {
    const e = found.get(v.id) ?? { impact: v.impact, help: v.help, where: new Map() };
    const list = e.where.get(label) ?? [];
    for (const n of v.nodes)
      list.push(
        n.target.join(' ') +
          (verbose ? `\n      ${n.failureSummary?.split('\n').slice(1).join(' ')}` : ''),
      );
    e.where.set(label, list);
    found.set(v.id, e);
  }
  await ctx.close();
}

const DISPLAYS = {
  normal: {},
  'large text': { textSize: 'large' },
  'high contrast': { contrast: 'high', textSize: 'large' },
};
for (const [name, s] of Object.entries(DISPLAYS)) {
  for (let n = 1; n <= 14; n++)
    await audit(`screen ${n} (${name})`, `${base}?dev=1&vision=off#${n}`, s);
}
for (let n = 1; n <= 14; n++)
  await audit(`screen ${n} (live, mock camera)`, `${base}?dev=1&vision=mock#${n}`);
// study mode: survey and keyboard task are filled in by people with mouse and keyboard
async function fillProfile(p) {
  await p.waitForSelector('form');
  const n = await p.locator('form fieldset').count();
  for (let i = 0; i < n; i++)
    await p.locator('form fieldset').nth(i).locator('input[type=radio]').first().check();
  await p.getByRole('checkbox').check();
  await p.getByRole('button', { name: 'Start', exact: true }).click();
}
await audit('study: profile form', `${base}?study=1&vision=off`, {}, async (p) => {
  await p.locator('input[type=number]').fill('1');
  await p.getByRole('button', { name: 'Start session' }).click();
  await p.waitForSelector('form');
});
await audit('study console (setup)', `${base}?study=1&vision=off`);
await audit('study: keyboard task', `${base}?study=1&vision=off`, {}, async (p) => {
  await p.locator('input[type=number]').fill('1');
  await p.getByRole('button', { name: 'Start session' }).click();
  await fillProfile(p);
  await p.getByRole('button', { name: 'Start task' }).click();
  await p.waitForSelector('[data-testid="keyboard-task"]');
});
await audit('study: survey', `${base}?study=1&vision=off`, {}, async (p) => {
  await p.locator('input[type=number]').fill('1');
  await p.getByRole('button', { name: 'Start session' }).click();
  await fillProfile(p);
  for (let i = 0; i < 3; i++) {
    await p.getByRole('button', { name: 'Start task' }).click();
    await p.getByRole('button', { name: 'Participant gave up' }).click();
  }
  await p.waitForSelector('form');
});
await audit('collection page', `${base}?collect=1&vision=mock&dev=1`);
await audit('card sheet', `${base}?cards=print&vision=off&dev=1`);

await browser.close();
server.kill();

const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
const rules = [...found.entries()].sort((a, b) => order[a[1].impact] - order[b[1].impact]);
console.log(`audited ${pages} pages/states`);
if (!rules.length) console.log('no violations');
for (const [id, e] of rules) {
  console.log(`\n[${e.impact}] ${id}: ${e.help}`);
  for (const [label, nodes] of e.where)
    console.log(`  - ${label}: ${nodes.length} node(s), e.g. ${nodes[0]}`);
}
const bad = rules.filter(([, e]) => e.impact === 'critical' || e.impact === 'serious').length;
console.log(`\nrules violated: ${rules.length} (critical/serious: ${bad})`);
process.exit(bad ? 1 : 0);
