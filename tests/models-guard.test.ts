import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * A model trained on generated test data must never be shared or shipped as if it were real.
 * To try the pipeline locally with such a model run the tests with ALLOW_SYNTHETIC_MODEL=1.
 */
describe('models in public/models', () => {
  const dir = 'public/models';
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
  it.each(files.length ? files : ['(none)'])('%s is not trained on synthetic data', (f) => {
    if (f === '(none)' || process.env.ALLOW_SYNTHETIC_MODEL === '1') return;
    const m = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
    expect(
      m.meta?.synthetic,
      `${f} was trained on generated data: delete it, or set ALLOW_SYNTHETIC_MODEL=1 for a local pipeline test`,
    ).not.toBe(true);
    expect(['signscribe-model', 'signscribe-cards']).toContain(m.format);
  });
});
