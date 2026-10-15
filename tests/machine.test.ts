import { createActor, getNextSnapshot } from 'xstate';
import type { SnapshotFrom } from 'xstate';
import { describe, expect, it } from 'vitest';
import { signScribeMachine, screenOf, type Ev } from '../src/state/machine';
import { PATH_TO_SCREEN } from '../src/state/paths';

type Snap = SnapshotFrom<typeof signScribeMachine>;

function start(): Snap {
  const a = createActor(signScribeMachine);
  a.start();
  return a.getSnapshot();
}
function send(snap: Snap, ...events: Ev[]): Snap {
  return events.reduce((s, e) => getNextSnapshot(signScribeMachine, s, e), snap);
}
const screen = (s: Snap) => screenOf(s.value, s.context);
const at = (n: number) => send(start(), ...PATH_TO_SCREEN[n]);
const L = (letter: string): Ev[] => [
  { type: 'LETTER_CANDIDATE', candidate: { letter, confidence: 0.9, alternatives: [] } },
  { type: 'LETTER_CONFIRMED', letter },
];

describe('paths reach the screens they claim', () => {
  for (let n = 1; n <= 13; n++) {
    it(`screen ${n}`, () => expect(screen(at(n))).toBe(n));
  }
});

describe('forward flow', () => {
  it('01 -> 02 on WAKE', () => expect(screen(send(start(), { type: 'WAKE' }))).toBe(2));
  it('02 -> 03 on CHECKS_PASSED', () => expect(screen(at(3))).toBe(3));
  it('03 -> 04 on YES', () => expect(screen(send(at(3), { type: 'YES' }))).toBe(4));
  it('04 -> 05 on YES', () => expect(screen(send(at(4), { type: 'YES' }))).toBe(5));
  it('05 -> 06 on YES with spell', () => expect(screen(send(at(5), { type: 'YES' }))).toBe(6));
  it('05 -> 10 on YES with cards', () =>
    expect(screen(send(at(5), { type: 'CHOOSE_METHOD', method: 'card' }, { type: 'YES' }))).toBe(10));
  it('06 -> 07 when a letter candidate appears', () => expect(screen(at(7))).toBe(7));
  it('07 -> 06 when a letter is confirmed', () => {
    const s = send(at(7), { type: 'LETTER_CONFIRMED', letter: 'L' });
    expect(screen(s)).toBe(6);
    expect(s.context.word).toBe('HEL');
  });
  it('11 -> 12 on YES', () => expect(screen(at(12))).toBe(12));
  it('12 -> 05 on NEW_SENTENCE and clears the message', () => {
    const s = send(at(12), { type: 'NEW_SENTENCE' });
    expect(screen(s)).toBe(5);
    expect(s.context.words).toEqual([]);
  });
  it('12 -> 01 on FINISH and clears the session but keeps settings', () => {
    const s = send(at(12), { type: 'FINISH' });
    expect(screen(s)).toBe(1);
    expect(s.context.words).toEqual([]);
    expect(s.context.place).toBe('Clinic');
  });
  it('12 -> 11 on EDIT', () => expect(screen(send(at(12), { type: 'EDIT' }))).toBe(11));
});

describe('thumbs down (NO) goes back / cancels', () => {
  it('02 -> 01', () => expect(screen(send(at(2), { type: 'NO' }))).toBe(1));
  it('03 -> 02', () => expect(screen(send(at(3), { type: 'NO' }))).toBe(2));
  it('04 -> 03', () => expect(screen(send(at(4), { type: 'NO' }))).toBe(3));
  it('05 -> 04', () => expect(screen(send(at(5), { type: 'NO' }))).toBe(4));
  it('06 -> 05', () => expect(screen(send(at(6), { type: 'NO' }))).toBe(5));
  it('07 cancels the candidate, back to 06', () => {
    const s = send(at(7), { type: 'NO' });
    expect(screen(s)).toBe(6);
    expect(s.context.candidate).toBeNull();
    expect(s.context.word).toBe('HE');
  });
  it('10 -> 05', () => expect(screen(send(at(10), { type: 'NO' }))).toBe(5));
  it('11 "try another" stays on 11 with new wording', () => {
    const before = at(11);
    const after = send(before, { type: 'NO' });
    expect(screen(after)).toBe(11);
    expect(after.context.sentence).not.toBe(before.context.sentence);
    expect(after.context.words).toEqual(before.context.words);
  });
  it('12 -> 11', () => expect(screen(send(at(12), { type: 'NO' }))).toBe(11));
});

describe('spelling', () => {
  it('SPACE finishes a known word and stays on 06', () => {
    const s = send(at(6), ...L('H'), ...L('E'), ...L('L'), ...L('P'), { type: 'SPACE' });
    expect(screen(s)).toBe(6);
    expect(s.context.words).toEqual(['HELP']);
    expect(s.context.word).toBe('');
  });
  it('SPACE on an unknown word with no close match keeps it (names are allowed)', () => {
    const s = send(at(6), ...L('Z'), ...L('Q'), ...L('X'), ...L('W'), { type: 'SPACE' });
    expect(screen(s)).toBe(6);
    expect(s.context.words).toEqual(['ZQXW']);
  });
  it('SPACE on a misspelt word goes to 09 with the closest match', () => {
    const s = at(9);
    expect(s.context.suggestion).toEqual({ original: 'HELO', match: 'HELLO' });
  });
  it('SPACE with an empty word does nothing', () =>
    expect(screen(send(at(6), { type: 'SPACE' }))).toBe(6));
  it('DELETE removes the last letter', () => {
    const s = send(at(6), ...L('H'), ...L('E'), { type: 'DELETE' });
    expect(s.context.word).toBe('H');
  });
  it('DELETE with an empty word takes back the last finished word', () => {
    const s = send(at(6), ...L('H'), ...L('I'), { type: 'SPACE' }, { type: 'DELETE' });
    expect(s.context.words).toEqual([]);
  });
  it('YES (Done) with a known word goes to review', () => {
    const s = send(at(6), ...L('H'), ...L('E'), ...L('L'), ...L('P'), { type: 'YES' });
    expect(screen(s)).toBe(11);
    expect(s.context.words).toEqual(['HELP']);
  });
  it('YES with an empty message does nothing', () => expect(screen(send(at(6), { type: 'YES' }))).toBe(6));
});

describe('09 word suggestion', () => {
  it('WORD_ACCEPT replaces the word and returns to 06', () => {
    const s = send(at(9), { type: 'WORD_ACCEPT' });
    expect(screen(s)).toBe(6);
    expect(s.context.words).toEqual(['HELLO']);
  });
  it('YES accepts', () => expect(send(at(9), { type: 'YES' }).context.words).toEqual(['HELLO']));
  it('WORD_REJECT keeps the original', () => {
    const s = send(at(9), { type: 'WORD_REJECT' });
    expect(s.context.words).toEqual(['HELO']);
    expect(screen(s)).toBe(6);
  });
  it('NO keeps the original', () => expect(send(at(9), { type: 'NO' }).context.words).toEqual(['HELO']));
  it('DELETE puts the word back and drops a letter', () => {
    const s = send(at(9), { type: 'DELETE' });
    expect(screen(s)).toBe(6);
    expect(s.context.word).toBe('HEL');
  });
  it('after Done (not Space) the resolved word continues to review', () => {
    const s = send(at(6), ...L('H'), ...L('E'), ...L('L'), ...L('O'), { type: 'YES' });
    expect(screen(s)).toBe(9);
    expect(screen(send(s, { type: 'YES' }))).toBe(11);
    expect(send(s, { type: 'YES' }).context.words).toEqual(['HELLO']);
  });
});

describe('10 picture cards', () => {
  it('CARD_CANDIDATE shows a pending card, CARD_ADDED makes it a word', () => {
    const s = at(10);
    expect(s.context.cardCandidate?.word).toBe('DOCTOR');
    const t = send(s, { type: 'CARD_ADDED', word: 'DOCTOR' });
    expect(t.context.words).toEqual(['I', 'NEED', 'DOCTOR']);
    expect(t.context.cardCandidate).toBeNull();
  });
  it('CARD_LOST (a card that passes through) adds nothing', () => {
    const s = send(at(10), { type: 'CARD_LOST' });
    expect(s.context.words).toEqual(['I', 'NEED']);
    expect(s.context.cardCandidate).toBeNull();
  });
  it('YES with no words does nothing', () => {
    const s = send(at(5), { type: 'CHOOSE_METHOD', method: 'card' }, { type: 'YES' }, { type: 'YES' });
    expect(screen(s)).toBe(10);
  });
});

describe('11 review', () => {
  it('builds "Hello, I need a doctor."', () => expect(at(11).context.sentence).toBe('Hello, I need a doctor.'));
  it('DELETE drops the last word and rewrites the sentence', () => {
    const s = send(at(11), { type: 'DELETE' });
    expect(s.context.words).toEqual(['HELLO', 'I', 'NEED']);
    expect(screen(s)).toBe(11);
  });
  it('can add more by choosing a method', () => {
    const s = send(at(11), { type: 'CHOOSE_METHOD', method: 'card' });
    expect(screen(s)).toBe(10);
    expect(s.context.words).toHaveLength(4);
  });
});

describe('safety: nothing reaches 12 without YES on 11', () => {
  it('sentenceConfirmed is false everywhere except 12', () => {
    expect(at(11).context.sentenceConfirmed).toBe(false);
    expect(at(12).context.sentenceConfirmed).toBe(true);
  });
  it('NO / DELETE / HELP / HAND_LOST on 11 never reach 12', () => {
    const base = at(11);
    for (const e of [{ type: 'NO' }, { type: 'DELETE' }, { type: 'HELP_TOGGLE' }, { type: 'HAND_LOST' }, { type: 'FINISH' }, { type: 'EDIT' }] as Ev[]) {
      expect(screen(send(base, e))).not.toBe(12);
    }
  });
  it('FINISH / EDIT / NEW_SENTENCE do nothing outside 12', () => {
    for (const n of [1, 5, 6, 10, 11]) {
      for (const type of ['FINISH', 'EDIT', 'NEW_SENTENCE'] as const) {
        expect(screen(send(at(n), { type }))).toBe(n);
      }
    }
  });
});

describe('03 preferences', () => {
  it('stores hand, display; English alphabet only', () => {
    let s = at(3);
    s = send(s, { type: 'CHOOSE_HAND', hand: 'left' }, { type: 'CHOOSE_DISPLAY', display: 'contrast' });
    expect(s.context.hand).toBe('left');
    expect(s.context.display).toBe('contrast');
    s = send(s, { type: 'CHOOSE_ALPHABET', alphabet: 'arabic' });
    expect(s.context.alphabet).toBe('english'); // "Coming soon" is not selectable
  });
  it('04 and 05 store place and method', () => {
    expect(send(at(4), { type: 'CHOOSE_CONTEXT', place: 'Shop' }).context.place).toBe('Shop');
    expect(send(at(5), { type: 'CHOOSE_METHOD', method: 'card' }).context.method).toBe('card');
  });
});

describe('08 hand lost overlay', () => {
  const eligible = [6, 7, 9, 10];
  for (const n of eligible) {
    it(`appears over ${n} and keeps the message`, () => {
      const base = at(n);
      const lost = send(base, { type: 'HAND_LOST' });
      expect(screen(lost)).toBe(8);
      expect(lost.context.word).toBe(base.context.word);
      expect(lost.context.words).toEqual(base.context.words);
      const back = send(lost, { type: 'HAND_BACK' });
      expect(screen(back)).toBe(n);
      expect(back.value).toEqual(base.value);
      expect(back.context.word).toBe(base.context.word);
      expect(back.context.candidate).toEqual(base.context.candidate);
    });
  }
  it('ignores input while the hand is lost (message stays safe)', () => {
    const lost = at(8);
    for (const e of [{ type: 'DELETE' }, { type: 'SPACE' }, { type: 'YES' }, { type: 'NO' }] as Ev[]) {
      const s = send(lost, e);
      expect(screen(s)).toBe(8);
      expect(s.context.word).toBe(lost.context.word);
    }
  });
  it('does not appear on screens that do not need a hand tracked for input', () => {
    for (const n of [1, 2, 3, 4, 5, 11, 12]) expect(screen(send(at(n), { type: 'HAND_LOST' }))).toBe(n);
  });
  it('HAND_BACK without a lost hand does nothing', () => expect(screen(send(at(6), { type: 'HAND_BACK' }))).toBe(6));
});

describe('13 help overlay', () => {
  for (let n = 1; n <= 12; n++) {
    it(`opens over ${n} and closes back to it (HELP_TOGGLE and NO)`, () => {
      const base = at(n);
      const open = send(base, { type: 'HELP_TOGGLE' });
      expect(screen(open)).toBe(13);
      const closed = send(open, { type: 'HELP_TOGGLE' });
      expect(screen(closed)).toBe(n);
      expect(closed.context).toEqual(base.context);
      expect(screen(send(open, { type: 'NO' }))).toBe(n);
    });
  }
  it('ignores other input while open', () => {
    const open = send(at(6), { type: 'HELP_TOGGLE' });
    expect(screen(send(open, { type: 'YES' }))).toBe(13);
    expect(screen(send(open, { type: 'SPACE' }))).toBe(13);
  });
  it('returns to the hand-lost screen if the hand was lost before help', () => {
    const s = send(at(8), { type: 'HELP_TOGGLE' });
    expect(screen(s)).toBe(13);
    expect(screen(send(s, { type: 'HELP_TOGGLE' }))).toBe(8);
  });
  it('remembers a hand lost / back while help is open', () => {
    const lostBehind = send(at(6), { type: 'HELP_TOGGLE' }, { type: 'HAND_LOST' }, { type: 'HELP_TOGGLE' });
    expect(screen(lostBehind)).toBe(8);
    const backBehind = send(at(8), { type: 'HELP_TOGGLE' }, { type: 'HAND_BACK' }, { type: 'HELP_TOGGLE' });
    expect(screen(backBehind)).toBe(6);
  });
});

describe('no dead ends', () => {
  const EVENTS: Ev[] = [
    { type: 'WAKE' }, { type: 'CHECKS_PASSED' },
    { type: 'CHOOSE_HAND', hand: 'left' }, { type: 'CHOOSE_ALPHABET', alphabet: 'english' },
    { type: 'CHOOSE_DISPLAY', display: 'large' }, { type: 'CHOOSE_CONTEXT', place: 'Shop' },
    { type: 'CHOOSE_METHOD', method: 'card' }, { type: 'CHOOSE_METHOD', method: 'spell' },
    { type: 'LETTER_CANDIDATE', candidate: { letter: 'H', confidence: 0.9, alternatives: [] } },
    { type: 'LETTER_CONFIRMED', letter: 'H' }, { type: 'LETTER_CONFIRMED', letter: 'E' },
    { type: 'LETTER_CONFIRMED', letter: 'O' }, { type: 'LETTER_CONFIRMED', letter: 'L' }, { type: 'CANDIDATE_LOST' },
    { type: 'SPACE' }, { type: 'DELETE' }, { type: 'WORD_ACCEPT' }, { type: 'WORD_REJECT' },
    { type: 'CARD_CANDIDATE', candidate: { word: 'DOCTOR', confidence: 0.9, trackId: 1 } },
    { type: 'CARD_LOST' }, { type: 'CARD_ADDED', word: 'DOCTOR' }, { type: 'CARD_ADDED', word: 'HELP' },
    { type: 'YES' }, { type: 'NO' }, { type: 'HAND_LOST' }, { type: 'HAND_BACK' },
    { type: 'HELP_TOGGLE' }, { type: 'FINISH' }, { type: 'NEW_SENTENCE' }, { type: 'EDIT' },
  ];
  const key = (s: Snap) => {
    const c = s.context;
    return JSON.stringify([s.value, c.overlay, c.overlayBefore, c.method, c.word.length > 0, Math.min(c.words.length, 2),
      !!c.candidate, !!c.cardCandidate, !!c.suggestion, c.afterWord, c.sentenceConfirmed]);
  };
  const place = (s: Snap) => JSON.stringify([s.value, s.context.overlay]);

  // explore the abstract state graph reachable from the start
  const nodes = new Map<string, Snap>();
  const edges = new Map<string, Set<string>>();
  // seed with the representative state of every screen (all reachable from start, see the path tests)
  const queue: Snap[] = [start(), ...Array.from({ length: 13 }, (_, i) => at(i + 1))];
  for (const q of queue) nodes.set(key(q), q);
  while (queue.length) {
    const s = queue.shift()!;
    const k = key(s);
    const out = new Set<string>();
    for (const e of EVENTS) {
      const n = send(s, e);
      const nk = key(n);
      out.add(nk);
      if (!nodes.has(nk) && nodes.size < 4000) {
        nodes.set(nk, n);
        queue.push(n);
      }
    }
    edges.set(k, out);
  }

  it('explores a meaningful number of abstract states', () => expect(nodes.size).toBeGreaterThan(40));
  it('from every state some event leads to a different screen', () => {
    const stuck = [...nodes.values()].filter((s) => !EVENTS.some((e) => place(send(s, e)) !== place(s)));
    expect(stuck.map((s) => place(s))).toEqual([]);
  });
  it('from every state the welcome screen is reachable again', () => {
    const welcomeKeys = new Set([...nodes].filter(([, s]) => screen(s) === 1).map(([k]) => k));
    const canReach = new Set(welcomeKeys);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [k, outs] of edges) {
        if (!canReach.has(k) && [...outs].some((o) => canReach.has(o))) {
          canReach.add(k);
          changed = true;
        }
      }
    }
    const trapped = [...nodes.keys()].filter((k) => !canReach.has(k));
    expect(trapped).toEqual([]);
  });
  it('screen 12 is only ever entered from 11 with YES', () => {
    for (const s of nodes.values()) {
      const under = (x: Snap) => screenOf(x.value, { overlay: 'none' }); // ignore overlays
      if (under(s) === 12) continue;
      for (const e of EVENTS) {
        const n = send(s, e);
        if (under(n) === 12) expect([under(s), s.context.overlay, e.type]).toEqual([11, 'none', 'YES']);
      }
    }
  });
});
