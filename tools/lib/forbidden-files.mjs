// Files that must never be committed. Used by tools/check-staged.mjs (the pre-commit hook) and by tests/forbidden-files.test.ts.
//
//  - public/models/*-knn.json : a k-NN model STORES real landmark samples of real people (letters-arsl-knn.json holds thousands).
//    It is a copy of the data in another shape. The small neural-network JSON (letters-mlp.json) holds weights only and is allowed.
//  - ml/data/** : imported pictures' landmarks and takes; datasets/** : the datasets themselves.
// Paths use forward slashes (git prints them that way on every system).
const RULES = [
  {
    test: (p) => /^public\/models\/[^/]*-knn\.json$/.test(p),
    why: 'a k-NN model stores real landmark samples (a copy of the data); keep it local, share the small MLP JSON instead',
  },
  {
    test: (p) => p.startsWith('ml/data/'),
    why: 'ml/data/ holds imported takes / landmarks: data is never committed',
  },
  {
    test: (p) => p.startsWith('datasets/'),
    why: 'datasets/ holds the datasets themselves: never committed',
  },
];

/** @returns {{ file: string, why: string }[]} */
export function forbidden(files) {
  const out = [];
  for (const raw of files) {
    const file = raw.replace(/\\/g, '/').replace(/^\.\//, '');
    const rule = RULES.find((r) => r.test(file));
    if (rule) out.push({ file, why: rule.why });
  }
  return out;
}
