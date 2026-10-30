import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createActor, getNextSnapshot } from 'xstate';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Machine } from '../src/state/MachineProvider';
import { signScribeMachine, type Ev } from '../src/state/machine';
import { PATH_TO_SCREEN } from '../src/state/paths';
import S12Share from '../src/screens/S12Share';

/** the machine at screen 12 with a finished sentence, for the given alphabet setting */
function shareSnapshot(alphabet: 'english' | 'arabic') {
  const a = createActor(signScribeMachine, { input: { alphabet } });
  a.start();
  const to: Ev[] = [...PATH_TO_SCREEN[3], { type: 'YES' }, { type: 'YES' }, { type: 'YES' }];
  let s = a.getSnapshot();
  for (const e of [
    ...to,
    { type: 'CHOOSE_METHOD', method: 'card' },
    { type: 'YES' },
    { type: 'CARD_ADDED', word: alphabet === 'arabic' ? 'طبيب' : 'DOCTOR' },
    { type: 'YES' },
    { type: 'YES' },
  ] as Ev[])
    s = getNextSnapshot(signScribeMachine, s, e);
  return s;
}

describe('the sentence line on the share screen', () => {
  // react warns that layout effects do nothing when rendering to a string; that is expected here
  beforeAll(() => void vi.spyOn(console, 'error').mockImplementation(() => {}));
  const html = (alphabet: 'english' | 'arabic') =>
    renderToStaticMarkup(
      createElement(
        Machine.Provider,
        { options: { snapshot: shareSnapshot(alphabet) as never } },
        createElement(S12Share),
      ),
    );
  it('reads right to left with ArSL, and only the sentence does', () => {
    const out = html('arabic');
    expect(out).toContain('طبيب');
    const sentence = out.match(/<p[^>]*dir="rtl"[^>]*>/g) ?? [];
    expect(sentence).toHaveLength(1);
    expect(out).toContain('lang="ar"');
    expect(out).not.toMatch(/<main[^>]*dir="rtl"/);
  });
  it('stays left to right with ASL', () => {
    expect(html('english')).not.toContain('dir="rtl"');
  });
});
