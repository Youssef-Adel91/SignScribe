import { createActor, getNextSnapshot } from 'xstate';
import type { SnapshotFrom } from 'xstate';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, signScribeMachine, screenOf, type Ev } from '../src/state/machine';
import { PATH_TO_SCREEN } from '../src/state/paths';
import { loadProfile, saveProfile } from '../src/state/profiles';
import { ContextFeed } from '../src/nlp/contextFeed';
import { parseContextPush } from '../src/nlp/protocol';

type Snap = SnapshotFrom<typeof signScribeMachine>;
const start = (): Snap => {
  const a = createActor(signScribeMachine);
  a.start();
  return a.getSnapshot();
};
const send = (s: Snap, ...e: Ev[]): Snap =>
  e.reduce((x, ev) => getNextSnapshot(signScribeMachine, x, ev), s);
const at = (n: number) => send(start(), ...PATH_TO_SCREEN[n]);
const screen = (s: Snap) => screenOf(s.value, s.context);

const detect = (over: Partial<Extract<Ev, { type: 'CONTEXT_DETECTED' }>> = {}): Ev => ({
  type: 'CONTEXT_DETECTED',
  userId: 'youssef',
  place: 'Shop',
  demo: false,
  profile: null,
  ...over,
});
const big = { ...DEFAULT_SETTINGS, hand: 'left', textSize: 'xlarge', dwell: 'slow' } as const;

describe('Bluetooth context in the state machine', () => {
  it("loads the detected place and that person's saved settings before the message starts", () => {
    for (const n of [1, 2, 3, 4, 5, 14]) {
      const s = send(at(n), detect({ profile: big }));
      expect(s.context.place, `screen ${n}`).toBe('Shop');
      expect(s.context.textSize).toBe('xlarge');
      expect(s.context.hand).toBe('left');
      expect(s.context.detected).toEqual({ userId: 'youssef', place: 'Shop', demo: false });
      expect(screen(s)).toBe(n); // the screen itself does not change: the person still confirms
    }
  });
  it('a person with no saved profile keeps the current settings; a place-only detection changes only the place', () => {
    const s = send(at(4), detect({ userId: null, place: 'Work' }));
    expect(s.context.place).toBe('Work');
    expect(s.context.textSize).toBe(DEFAULT_SETTINGS.textSize);
    const t = send(at(4), detect({ place: null, profile: big }));
    expect(t.context.place).toBe('Clinic');
    expect(t.context.dwell).toBe('slow');
  });
  it('never changes the place or settings once the message has started, but still shows who is there', () => {
    for (const n of [6, 7, 9, 10, 11, 12]) {
      const s = send(at(n), detect({ profile: big }));
      expect(s.context.place, `screen ${n}`).toBe('Clinic');
      expect(s.context.textSize).toBe('normal');
      expect(s.context.detected?.userId).toBe('youssef');
    }
  });
  it('the person choosing a place wins over Bluetooth, for the rest of the session', () => {
    let s = send(at(4), { type: 'CHOOSE_CONTEXT', place: 'Home' });
    s = send(s, detect());
    expect(s.context.place).toBe('Home');
    expect(s.context.detected?.place).toBe('Shop'); // still shown
  });
  it('"ignore" puts the place and settings back and does not apply the same detection again', () => {
    let s = send(at(3), detect({ profile: big }));
    s = send(s, { type: 'CONTEXT_IGNORE' });
    expect(s.context.place).toBe('Clinic');
    expect(s.context.textSize).toBe('normal');
    expect(s.context.hand).toBe(DEFAULT_SETTINGS.hand);
    expect(s.context.detected).toBeNull();
    expect(s.context.detectedIgnored).toBe('youssef|Shop');
    s = send(s, detect({ profile: big })); // the scanner repeats the same thing
    expect(s.context.place).toBe('Clinic');
    expect(s.context.detected).toBeNull();
    s = send(s, detect({ userId: 'sara', place: 'Work', profile: null })); // something different
    expect(s.context.place).toBe('Work');
    expect(s.context.detected?.userId).toBe('sara');
  });
  it('"ignore" keeps a place the person chose themselves', () => {
    let s = send(at(4), detect());
    s = send(s, { type: 'CHOOSE_CONTEXT', place: 'Home' }, { type: 'CONTEXT_IGNORE' });
    expect(s.context.place).toBe('Home');
  });
  it('nothing detected leaves what was loaded and removes the label', () => {
    let s = send(at(3), detect({ profile: big }));
    s = send(s, { type: 'CONTEXT_CLEARED' });
    expect(s.context.detected).toBeNull();
    expect(s.context.place).toBe('Shop');
    expect(send(start(), { type: 'CONTEXT_CLEARED' }).context).toMatchObject({ detected: null });
    // an ignored detection is forgotten when nothing is detected any more: the person coming back is applied again
    const ign = send(
      at(3),
      detect({ profile: big }),
      { type: 'CONTEXT_IGNORE' },
      { type: 'CONTEXT_CLEARED' },
    );
    expect(ign.context.detectedIgnored).toBeNull();
    expect(send(ign, detect()).context.detected?.userId).toBe('youssef');
  });
  it('finishing a sentence forgets "ignore" and the place choice, so the next person starts fresh', () => {
    let s = send(at(12), { type: 'CONTEXT_IGNORE' });
    s = send(
      at(4),
      detect(),
      { type: 'CONTEXT_IGNORE' },
      { type: 'CHOOSE_CONTEXT', place: 'Home' },
    );
    expect(s.context.detectedIgnored).not.toBeNull();
    const done = send(at(12), detect(), { type: 'CONTEXT_IGNORE' }, { type: 'FINISH' });
    expect(done.context.detectedIgnored).toBeNull();
    expect(done.context.placeChosen).toBe(false);
  });
  it('without Bluetooth nothing changes', () => {
    const s = start();
    expect(s.context.detected).toBeNull();
    expect(s.context.detectedIgnored).toBeNull();
  });
});

describe('saved settings per person', () => {
  beforeEach(() => localStorage.clear());
  it('round-trips, and a stranger or a bad id gets nothing', () => {
    expect(loadProfile('youssef')).toBeNull();
    saveProfile('youssef', big);
    expect(loadProfile('youssef')).toEqual(big);
    expect(loadProfile('sara')).toBeNull();
    saveProfile('../x', big);
    expect(loadProfile('../x')).toBeNull();
  });
  it('a corrupt entry is ignored', () => {
    localStorage.setItem('signscribe.profile.v1.u1', '{nope');
    expect(loadProfile('u1')).toBeNull();
  });
});

describe('parsing a pushed context message', () => {
  it('accepts a good one and ignores everything else', () => {
    const ok = JSON.stringify({ type: 'context', userId: 'youssef', place: 'Clinic', demo: true });
    expect(parseContextPush(ok)).toEqual({
      type: 'context',
      userId: 'youssef',
      place: 'Clinic',
      demo: true,
    });
    for (const bad of [
      '{nope',
      '[]',
      '{"type":"pong"}',
      JSON.stringify({ type: 'context', userId: 'a b', place: null }),
      JSON.stringify({ type: 'context', userId: null, place: 'Moon' }),
    ])
      expect(parseContextPush(bad)).toBeNull();
  });
});

class FakeWs {
  static all: FakeWs[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeWs.all.push(this);
  }
  close() {
    this.closed = true;
  }
}

describe('ContextFeed', () => {
  beforeEach(() => {
    FakeWs.all = [];
  });
  it('reports pushed contexts and "nothing" for an empty one', () => {
    const got: unknown[] = [];
    const feed = new ContextFeed('ws://x', (c) => got.push(c), FakeWs as never);
    const ws = FakeWs.all[0];
    ws.onmessage?.({
      data: JSON.stringify({ type: 'context', userId: 'u', place: null, demo: false }),
    });
    ws.onmessage?.({
      data: JSON.stringify({ type: 'context', userId: null, place: null, demo: false }),
    });
    ws.onmessage?.({ data: 'garbage' });
    expect(got).toEqual([{ type: 'context', userId: 'u', place: null, demo: false }, null]);
    feed.close();
    expect(ws.closed).toBe(true);
  });
  it('says "nothing" when the server goes away and reconnects with a growing pause', async () => {
    const got: unknown[] = [];
    const feed = new ContextFeed('ws://x', (c) => got.push(c), FakeWs as never, 10, 40);
    FakeWs.all[0].onclose?.();
    expect(got).toEqual([null]);
    await new Promise((r) => setTimeout(r, 25));
    expect(FakeWs.all).toHaveLength(2);
    FakeWs.all[1].onerror?.();
    await new Promise((r) => setTimeout(r, 15));
    expect(FakeWs.all).toHaveLength(2); // the second pause is 20 ms
    await new Promise((r) => setTimeout(r, 30));
    expect(FakeWs.all).toHaveLength(3);
    feed.close();
    FakeWs.all[2].onclose?.();
    await new Promise((r) => setTimeout(r, 60));
    expect(FakeWs.all).toHaveLength(3); // closed for good
  });
});
