import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getAlphabet } from '../src/config/alphabet';
import { loadLetters } from '../src/recognition/models';

/**
 * tests/fixtures/arsl/*.json are written by ml/tests/make_arsl_fixtures.py, which runs ml/export_arsl.py (the documented commands)
 * on GENERATED hands. They are not a model of anything; they prove the browser reads exactly what the exporters write.
 */
const read = (name: string) => JSON.parse(readFileSync(`tests/fixtures/arsl/${name}`, 'utf8'));
const mlp = read('letters-arsl-mlp.json');
const knn = read('letters-arsl-knn.json');
const arsl = getAlphabet('arsl');

const json = (b: unknown) =>
  new Response(JSON.stringify(b), { headers: { 'content-type': 'application/json' } });
const serve = (files: Record<string, unknown>) =>
  (async (url: string) => {
    const hit = Object.entries(files).find(([name]) => url.endsWith(name));
    return hit ? json(hit[1]) : new Response('', { status: 404 });
  }) as typeof fetch;

describe('the two ArSL model files, as the Python exporters write them', () => {
  it('list the same classes in the same order, all from the alphabet file', () => {
    expect(mlp.labels).toEqual(knn.labels);
    expect(mlp.labels).toEqual([...arsl.static].sort());
    expect(mlp.labels.every((l: string) => arsl.static.includes(l))).toBe(true);
  });
  it('are accepted by the loader, the network first', async () => {
    const r = await loadLetters(
      serve({ 'letters-arsl-mlp.json': mlp, 'letters-arsl-knn.json': knn }),
      'arsl',
    );
    expect(r.status).toBe('ready');
    expect(r.recognizer?.id).toBe('mlp');
    expect(r.synthetic).toBe(true); // generated hands: the app says so
  });
  it('the k-NN file alone is accepted too (the fallback)', async () => {
    const r = await loadLetters(serve({ 'letters-arsl-knn.json': knn }), 'arsl');
    expect(r.status).toBe('ready');
    expect(r.recognizer?.id).toBe('knn');
  });
  it('the network file alone is accepted too', async () => {
    const r = await loadLetters(serve({ 'letters-arsl-mlp.json': mlp }), 'arsl');
    expect(r.recognizer?.id).toBe('mlp');
  });
  it('are rejected when the app is set to ASL (a mismatched alphabet), even under the ASL names', async () => {
    const asNamedForAsl = serve({ 'letters-mlp.json': mlp, 'letters-knn.json': knn });
    const r = await loadLetters(asNamedForAsl, 'asl');
    expect(r.status).toBe('error');
    expect(r.message).toMatch(/another alphabet/);
  });
  it('are not read at all by the ASL loader under their own names', async () => {
    const r = await loadLetters(
      serve({ 'letters-arsl-mlp.json': mlp, 'letters-arsl-knn.json': knn }),
      'asl',
    );
    expect(r.status).toBe('missing');
  });
  it('an ASL-lettered model under the ArSL names is rejected', async () => {
    const asl = { ...knn, labels: ['A', 'B'].concat(knn.labels.slice(2)) };
    const r = await loadLetters(serve({ 'letters-arsl-knn.json': asl }), 'arsl');
    expect(r.status).toBe('error');
  });
});
