import { describe, expect, it } from 'vitest';
import { classifyCameraError, type CameraProblem } from '../src/vision/camera';
import { STRINGS } from '../src/output/strings';

const dom = (name: string) => new DOMException('x', name);

// one row per error name the browsers use: [name, kind, problem]
const CASES: [string, string, CameraProblem][] = [
  ['NotAllowedError', 'denied', 'denied'],
  ['SecurityError', 'denied', 'denied'],
  ['PermissionDeniedError', 'denied', 'denied'],
  ['NotFoundError', 'nocamera', 'nocamera'],
  ['DevicesNotFoundError', 'nocamera', 'nocamera'],
  ['OverconstrainedError', 'nocamera', 'nocamera'],
  ['AbortError', 'nocamera', 'nocamera'],
  ['NotReadableError', 'nocamera', 'inuse'],
  ['NotSupportedError', 'error', 'unsupported'],
  ['TypeError', 'error', 'unsupported'],
  ['SomethingNewError', 'error', 'unknown'],
];

describe('camera errors become one plain, specific message each', () => {
  for (const [name, kind, problem] of CASES) {
    it(`${name} -> ${problem}, with text in English and Arabic`, () => {
      const e = classifyCameraError(dom(name));
      expect(e.kind).toBe(kind);
      expect(e.problem).toBe(problem);
      expect(e.message.length).toBeGreaterThan(20);
      for (const lang of ['en', 'ar'] as const) {
        expect(STRINGS[lang].cameraProblem[problem].trim().length).toBeGreaterThan(20);
      }
    });
  }

  it('NotSupportedError says where to open the app, and never the raw name', () => {
    const e = classifyCameraError(dom('NotSupportedError'));
    expect(e.message).toMatch(/localhost or https/);
    expect(e.message).not.toMatch(/NotSupportedError/);
    expect(STRINGS.ar.cameraProblem.unsupported).toMatch(/localhost/);
  });

  it('a non-error value is "unknown", not a crash', () => {
    expect(classifyCameraError(undefined).problem).toBe('unknown');
    expect(classifyCameraError('boom').problem).toBe('unknown');
  });

  it('every problem has both languages and they differ', () => {
    for (const k of Object.keys(STRINGS.en.cameraProblem) as CameraProblem[]) {
      expect(STRINGS.ar.cameraProblem[k]).not.toBe(STRINGS.en.cameraProblem[k]);
    }
  });
});
