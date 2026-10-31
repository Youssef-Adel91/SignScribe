import { createActor, getNextSnapshot } from 'xstate';
import type { SnapshotFrom } from 'xstate';
import { describe, expect, it, vi } from 'vitest';

// an ArSL alphabet that DOES list control classes (the real arsl.json lists none)
vi.mock('../src/config/alphabet', async (orig) => {
  const real = await orig<typeof import('../src/config/alphabet')>();
  const withControls = real.parseAlphabet(
    {
      id: 'arsl',
      script: 'arabic',
      static: ['ain', 'bb', 'space', 'del', 'fin'],
      display: { ain: 'ع', bb: 'ب' },
      controls: { space: 'space', del: 'delete', fin: 'finish' },
    },
    'arsl',
  );
  return { ...real, alphabetOfSetting: () => withControls };
});

import { signScribeMachine, type Ev } from '../src/state/machine';
import { PATH_TO_SCREEN } from '../src/state/paths';

type Snap = SnapshotFrom<typeof signScribeMachine>;
const send = (snap: Snap, ...events: Ev[]): Snap =>
  events.reduce((s, e) => getNextSnapshot(signScribeMachine, s, e), snap);
const L = (letter: string): Ev[] => [
  { type: 'LETTER_CANDIDATE', candidate: { letter, confidence: 0.9, alternatives: [] } },
  { type: 'LETTER_CONFIRMED', letter },
];
const spelling = (): Snap => {
  const a = createActor(signScribeMachine);
  a.start();
  return send(
    a.getSnapshot(),
    ...PATH_TO_SCREEN[3],
    { type: 'CHOOSE_ALPHABET', alphabet: 'arabic' },
    { type: 'YES' },
    { type: 'YES' },
    { type: 'YES' },
    { type: 'YES' },
  );
};

describe('control classes listed in the alphabet file', () => {
  it('a Space class ends the word like the open-palm gesture', () => {
    const s = send(spelling(), ...L('ain'), ...L('bb'), ...L('space'));
    expect(s.context.words).toEqual(['عب']);
    expect(s.context.word).toBe('');
  });
  it('a Delete class takes back the last letter like the fist gesture', () => {
    const s = send(spelling(), ...L('ain'), ...L('bb'), ...L('del'));
    expect(s.context.word).toBe('ع');
  });
  it('a Finish class goes to the sentence review like thumbs up', () => {
    const s = send(spelling(), ...L('ain'), ...L('fin'));
    expect(s.value).toBe('review');
    expect(s.context.words).toEqual(['ع']);
  });
  it('a control class is never written into the word', () => {
    const s = send(spelling(), ...L('ain'), ...L('del'), ...L('space'));
    expect(s.context.word).not.toContain('space');
    expect(s.context.word).not.toContain('del');
  });
  it('ordinary letters still work next to them', () => {
    expect(send(spelling(), ...L('bb')).context.word).toBe('ب');
  });
});
