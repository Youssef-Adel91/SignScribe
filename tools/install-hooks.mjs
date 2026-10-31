// Installs the git pre-commit hook that runs tools/check-staged.mjs.   npm run hooks:install
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const dir = spawnSync('git', ['rev-parse', '--git-path', 'hooks'], {
  encoding: 'utf8',
}).stdout.trim();
if (!dir) {
  console.error('not a git repository');
  process.exit(1);
}
const hook = resolve(dir, 'pre-commit');
const MARK = '# signscribe: refuse forbidden files';
const line = `${MARK}\nnode tools/check-staged.mjs || exit 1\n`;
mkdirSync(resolve(dir), { recursive: true });
const old = existsSync(hook) ? readFileSync(hook, 'utf8') : '';
if (old.includes(MARK)) {
  console.log(`already installed: ${hook}`);
} else {
  writeFileSync(hook, old ? `${old.replace(/\n*$/, '\n')}${line}` : `#!/bin/sh\n${line}`);
  chmodSync(hook, 0o755);
  console.log(`installed: ${hook}`);
}
