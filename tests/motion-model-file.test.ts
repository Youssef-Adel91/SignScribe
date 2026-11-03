import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DollarRecognizer, parseDollarModel } from '../src/recognition/dollarP';

// The committed motion model (J, Z from the DollarPy templates) must load, and each of its own paths must be read back as itself.
// This proves the file format, not accuracy on a person: nothing here was measured on a camera.
describe('public/models/motion-dollar.json', () => {
  const model = parseDollarModel(JSON.parse(readFileSync('public/models/motion-dollar.json', 'utf8')));
  const rec = new DollarRecognizer(model);
  it('has J and Z, not synthetic, not claiming an evaluation', () => {
    expect(model.templates.map((t) => t.label).sort()).toEqual(['J', 'Z']);
    expect(model.meta.synthetic).toBe(false);
    expect(model.meta.evaluation).toBeNull();
  });
  for (const t of model.templates)
    it(`reads its own ${t.label} path back as ${t.label}`, () => {
      const g = rec.recognize(t.points.map(([x, y]) => ({ x, y })));
      expect(g?.letter).toBe(t.label);
    });
});
