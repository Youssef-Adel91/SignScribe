// Refuses a commit that contains a file from tools/lib/forbidden-files.mjs. Run by the git pre-commit hook (npm run hooks:install),
// or by hand: node tools/check-staged.mjs        (--tracked also checks every file already in the repository)
import { spawnSync } from 'node:child_process';
import { forbidden } from './lib/forbidden-files.mjs';

const tracked = process.argv.includes('--tracked');
const r = spawnSync(
  'git',
  tracked ? ['ls-files'] : ['diff', '--cached', '--name-only', '--diff-filter=ACMR'],
  {
    encoding: 'utf8',
  },
);
if (r.error || r.status !== 0) {
  console.error(`check-staged: could not ask git (${r.error ? r.error.message : r.stderr.trim()})`);
  process.exit(2);
}
// a k-NN file is judged by what is in the index (what would be committed / is committed), not by the file on disk
const readIndex = (path) => {
  const g = spawnSync('git', ['show', `:${path}`], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return g.status === 0 ? g.stdout : null;
};
const bad = forbidden(r.stdout.split('\n').filter(Boolean), readIndex);
if (bad.length) {
  console.error(`\nCommit refused: ${bad.length} file(s) must not be committed.\n`);
  for (const b of bad) console.error(`  ${b.file}\n    ${b.why}`);
  console.error(
    '\nTake them out of the commit:  git restore --staged <file>   (they stay on your disk, .gitignore keeps them out)\n',
  );
  process.exit(1);
}
