// Files that must never be committed. Used by tools/check-staged.mjs (the pre-commit hook, `npm run check:staged`) and by
// tests/forbidden-files.test.ts (which fails when a forbidden file is tracked).
//
//  - Any `*-knn.json`, in any folder: a k-NN model STORES real landmark samples of real people (letters-arsl-knn.json holds thousands).
//    It is a copy of the data in another shape. The ONE exception is a generated test fixture: the file is under tests/fixtures/,
//    its own JSON says `"meta": {"synthetic": true}` and it has at most MAX_FIXTURE_VECTORS vectors. Everything else is rejected,
//    public/models/ included, also with the flag. The small neural-network JSON (letters-mlp.json) holds weights only and is allowed.
//  - ml/data/** : imported pictures' landmarks and takes; datasets/** : the datasets themselves.
// Paths use forward slashes (git prints them that way on every system).
export const MAX_FIXTURE_VECTORS = 200;

const isKnn = (p) => /-knn\.json$/.test(p);

/** why a k-NN file is refused, or '' when it is an allowed synthetic fixture. `read(path)` gives the file's text, or null. */
function knnProblem(file, read) {
  if (!file.startsWith('tests/fixtures/'))
    return 'a k-NN model stores real landmark samples (a copy of the data); keep it local, share the small MLP JSON instead. Only a synthetic fixture under tests/fixtures/ may be committed';
  const text = read ? read(file) : null;
  if (text === null || text === undefined)
    return 'this k-NN file could not be read to check that it is a synthetic fixture';
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return 'this k-NN file is not valid JSON, so it cannot be shown to be a synthetic fixture';
  }
  if (json?.meta?.synthetic !== true)
    return 'a k-NN file under tests/fixtures/ must say "synthetic": true in its meta (generated hands only); this one does not';
  const n = Array.isArray(json.vectors) ? json.vectors.length : Infinity;
  if (!(n <= MAX_FIXTURE_VECTORS))
    return `a synthetic k-NN fixture may hold at most ${MAX_FIXTURE_VECTORS} vectors; this one has ${Number.isFinite(n) ? n : 'no vector list'}`;
  return '';
}

const RULES = [
  {
    test: (p) => p.startsWith('ml/data/'),
    why: 'ml/data/ holds imported takes / landmarks: data is never committed',
  },
  {
    test: (p) => p.startsWith('datasets/'),
    why: 'datasets/ holds the datasets themselves: never committed',
  },
];

/**
 * @param {string[]} files   paths as git prints them
 * @param {(path: string) => string | null} [read]   text of a file (for a k-NN file: its content in the index), null if unreadable
 * @returns {{ file: string, why: string }[]}
 */
export function forbidden(files, read) {
  const out = [];
  for (const raw of files) {
    const file = raw.replace(/\\/g, '/').replace(/^\.\//, '');
    if (isKnn(file)) {
      const why = knnProblem(file, read);
      if (why) out.push({ file, why });
      continue;
    }
    const rule = RULES.find((r) => r.test(file));
    if (rule) out.push({ file, why: rule.why });
  }
  return out;
}
