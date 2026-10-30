// The sentence server and the app together, in a browser:
//  - the real server (fake language model) answers over WebSocket and the app shows the "language model" sentence
//  - "try another" asks again and changes the wording
//  - no server / a server that is down: the offline sentence stays, with no error for the person
//  - a hostile server that adds facts: the app refuses its sentence
//  - the study mode ignores the server
// Usage: npm run build && npm run e2e:server
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import net from 'node:net';
import { WebSocketServer } from 'ws';

const root = resolve(import.meta.dirname, '../..');
const previewPort = 4182;
const base = `http://localhost:${previewPort}/`;
const env = {
  ...process.env,
  SENTENCE_PROVIDER: 'fake',
  WS_PORT: '8791',
  TCP_PORT: '8792',
  ALLOWED_ORIGINS: base.slice(0, -1),
};
const preview = spawn('npx', ['vite', 'preview', '--port', String(previewPort), '--strictPort'], {
  cwd: root,
  stdio: 'ignore',
});
const server = spawn('node', ['server/index.ts'], { cwd: root, env, stdio: 'ignore' });
// a server that lies: it always adds a fact
const evil = new WebSocketServer({ port: 8793 });
evil.on('connection', (ws) =>
  ws.on('message', (d) => {
    const r = JSON.parse(d.toString());
    ws.send(
      JSON.stringify({
        id: r.id,
        ok: true,
        type: 'suggest',
        sentence: 'I need a doctor for my headache, call Sarah at 5 pm.',
        source: 'llm',
      }),
    );
  }),
);
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(base)).ok && (await fetch('http://127.0.0.1:8791/health')).ok) break;
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
// a Bluetooth scanner's message over the plain TCP door is acknowledged; one with a device address is refused
const tcpLines = (payload, n) =>
  new Promise((resolve, reject) => {
    const out = [];
    const sock = net.createConnection(8792, '127.0.0.1');
    let buf = '';
    sock.setEncoding('utf8');
    sock.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        out.push(JSON.parse(buf.slice(0, i)));
        buf = buf.slice(i + 1);
      }
      if (out.length === n) {
        sock.end();
        resolve(out);
      }
    });
    sock.on('error', reject);
    sock.write(payload);
  });
{
  const pres = {
    id: 'p1',
    type: 'presence',
    userId: 'youssef',
    place: 'Clinic',
    rssi: -58,
    demo: true,
  };
  const [ok, bad] = await tcpLines(
    JSON.stringify(pres) +
      '\n' +
      JSON.stringify({ ...pres, id: 'p2', address: 'AA:BB:CC:DD:EE:01' }) +
      '\n',
    2,
  );
  check('presence over TCP is acknowledged', ok.ok === true && ok.type === 'presence');
  check(
    'a presence with a device address is refused',
    bad.ok === false && bad.error === 'bad_request' && !JSON.stringify(bad).includes('AA:BB'),
  );
}
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    [
      '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
      '/opt/pw-browsers/chromium/chrome-linux/chrome',
    ].find(existsSync),
});
const source = (page) => page.getByTestId('sentence-source').textContent();
const sentence = (page) => page.locator('[data-screen="11"] [data-source]').textContent();
async function open(query, wait = 1500) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}?dev=1&vision=off${query}#11`);
  await page.waitForSelector('[data-screen="11"]');
  await page.waitForTimeout(wait);
  return { ctx, page, errors };
}
try {
  {
    const { ctx, page, errors } = await open('&server=ws://127.0.0.1:8791');
    check(
      'the offline sentence is shown first and the server one replaces it',
      /language model/.test(await source(page)),
      await sentence(page),
    );
    check(
      'the server sentence keeps the chosen words',
      /doctor/i.test(await sentence(page)) && /hello/i.test(await sentence(page)),
    );
    const first = await sentence(page);
    await page.getByRole('button', { name: 'Thumbs down' }).click();
    await page.waitForTimeout(1500);
    const second = await sentence(page);
    check(
      '"try another" asks again and the wording changes',
      second !== first && /language model/.test(await source(page)),
      `${first} -> ${second}`,
    );
    check('no page errors', errors.length === 0, errors.join(' ; ').slice(0, 200));
    await ctx.close();
  }
  {
    const { ctx, page } = await open('', 800);
    check(
      'with no server configured the offline rules write the sentence',
      /simple rules/.test(await source(page)),
    );
    await ctx.close();
  }
  {
    const { ctx, page, errors } = await open('&server=ws://127.0.0.1:1', 1500);
    check(
      'a server that is down changes nothing for the person',
      /simple rules/.test(await source(page)) && errors.length === 0,
      errors.join(' ; '),
    );
    await ctx.close();
  }
  {
    const { ctx, page } = await open('&server=ws://127.0.0.1:8793', 1500);
    check(
      'a server that adds facts is refused: the offline sentence stays',
      /simple rules/.test(await source(page)) && !/headache|Sarah/.test(await sentence(page)),
      await sentence(page),
    );
    await ctx.close();
  }
  {
    const { ctx, page } = await open('&server=ws://evil.example:8791', 1500);
    check(
      'a server address that is not this computer is ignored',
      /simple rules/.test(await source(page)),
    );
    await ctx.close();
  }
  {
    const { ctx, page } = await open('&study=1&server=ws://127.0.0.1:8791', 1500);
    check('the comparison study never uses the server', /simple rules/.test(await source(page)));
    await ctx.close();
  }
} finally {
  await browser.close();
  preview.kill();
  server.kill();
  evil.close();
}
console.log(failed ? `\n${failed} check(s) FAILED` : '\nall server checks passed');
process.exit(failed ? 1 : 0);
