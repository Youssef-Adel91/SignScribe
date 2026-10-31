import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createActor, getNextSnapshot } from 'xstate';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Machine } from '../src/state/MachineProvider';
import { signScribeMachine, type Ev } from '../src/state/machine';
import { PATH_TO_SCREEN } from '../src/state/paths';
import S12Share from '../src/screens/S12Share';
import S14Comfort from '../src/screens/S14Comfort';
import { READ_ALOUD_ENGLISH_ONLY } from '../src/ui/readAloudNote';

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

describe('read-aloud is English only, and the screens say so', () => {
  beforeAll(() => void vi.spyOn(console, 'error').mockImplementation(() => {}));
  const render = (snapshot: unknown, screen: () => ReturnType<typeof createElement>) =>
    renderToStaticMarkup(
      createElement(Machine.Provider, { options: { snapshot: snapshot as never } }, screen()),
    );
  it('the share screen names the limit instead of "Reading aloud" with Arabic', () => {
    const out = render(shareSnapshot('arabic'), () => createElement(S12Share));
    expect(out).toContain(READ_ALOUD_ENGLISH_ONLY);
    expect(out).toContain('Read-aloud: English only');
    expect(out).not.toContain('Reading aloud');
  });
  it('and keeps saying "Reading aloud" with English', () => {
    const out = render(shareSnapshot('english'), () => createElement(S12Share));
    expect(out).toContain('Reading aloud');
    expect(out).not.toContain(READ_ALOUD_ENGLISH_ONLY);
  });
  const comfort = (alphabet: 'english' | 'arabic') => {
    const a = createActor(signScribeMachine, { input: { alphabet } });
    a.start();
    let s = a.getSnapshot();
    for (const e of PATH_TO_SCREEN[14]) s = getNextSnapshot(signScribeMachine, s, e);
    return s;
  };
  it('the voice setting (14) carries the note only while Arabic is chosen', () => {
    const ar = render(comfort('arabic'), () => createElement(S14Comfort));
    expect(ar).toContain('data-testid="read-aloud-note"');
    expect(ar).toContain(READ_ALOUD_ENGLISH_ONLY);
    expect(render(comfort('english'), () => createElement(S14Comfort))).not.toContain(
      'read-aloud-note',
    );
  });
});
