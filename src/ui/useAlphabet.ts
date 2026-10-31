import { alphabetOfSetting, glyphOf, type Glyph } from '../config/alphabet';
import { useCtx } from '../state/MachineProvider';

/**
 * The alphabet the person chose, for screens: how to show a class id (`glyph`) and whether sentences read right to left.
 * Only text is right to left; the screen layout (chrome) stays left to right.
 */
export function useAlphabet() {
  const setting = useCtx().alphabet;
  const cfg = alphabetOfSetting(setting);
  return {
    cfg,
    rtl: cfg.script === 'arabic',
    glyph: (classId: string): Glyph => glyphOf(cfg, classId),
  };
}

/** attributes for a line of sentence text: right to left and Arabic only while ArSL is active */
export const textDir = (rtl: boolean): { dir?: 'rtl'; lang?: 'ar' } =>
  rtl ? { dir: 'rtl', lang: 'ar' } : {};
