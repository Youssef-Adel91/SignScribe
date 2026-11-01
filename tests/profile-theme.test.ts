import { createActor, getNextSnapshot } from 'xstate';
import type { SnapshotFrom } from 'xstate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  DEFAULT_SETTINGS,
  screenOf,
  signScribeMachine,
  themeOf,
  type Ev,
} from '../src/state/machine';
import { PATH_TO_SCREEN } from '../src/state/paths';
import { loadSettings } from '../src/state/settings';
import { loadProfile, saveProfile } from '../src/state/profiles';
import { parseContextPush, parseRequest } from '../src/nlp/protocol';
import { MachineProvider, useSend } from '../src/state/MachineProvider';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/* The added Phase II rule: different content for a different user profile.
   male -> blue and green pages, female -> pink pages, not set -> the standard teal pages. */

type Snap = SnapshotFrom<typeof signScribeMachine>;
const start = (): Snap => {
  const a = createActor(signScribeMachine);
  a.start();
  return a.getSnapshot();
};
const send = (s: Snap, ...e: Ev[]): Snap =>
  e.reduce((x, ev) => getNextSnapshot(signScribeMachine, x, ev), s);
const at = (n: number) => send(start(), ...PATH_TO_SCREEN[n]);

describe('profile -> page colours', () => {
  it('maps each profile to one theme', () => {
    expect(themeOf('male')).toBe('blue');
    expect(themeOf('female')).toBe('pink');
    expect(themeOf('unset')).toBe('standard');
    expect(DEFAULT_SETTINGS.gender).toBe('unset');
  });

  it('is chosen on screen 03 by point-and-hold (a CHOOSE_GENDER event), and only there or by Bluetooth', () => {
    let s = at(3);
    expect(screenOf(s.value, s.context)).toBe(3);
    s = send(s, { type: 'CHOOSE_GENDER', gender: 'female' });
    expect(s.context.gender).toBe('female');
    s = send(s, { type: 'CHOOSE_GENDER', gender: 'male' });
    expect(s.context.gender).toBe('male');
    // a later screen ignores it (the choice belongs to the preferences step)
    const later = send(at(6), { type: 'CHOOSE_GENDER', gender: 'female' });
    expect(later.context.gender).toBe('unset');
  });

  it('a person recognised by Bluetooth for the first time gets the profile from the device list', () => {
    const s = send(at(4), {
      type: 'CONTEXT_DETECTED',
      userId: 'sara',
      place: 'Clinic',
      demo: true,
      profile: null,
      gender: 'female',
    });
    expect(s.context.gender).toBe('female');
    expect(s.context.place).toBe('Clinic');
  });

  it("a person's saved profile wins over the device list (they may have changed it on screen 03)", () => {
    const s = send(at(4), {
      type: 'CONTEXT_DETECTED',
      userId: 'sara',
      place: 'Clinic',
      demo: false,
      profile: { ...DEFAULT_SETTINGS, gender: 'male' },
      gender: 'female',
    });
    expect(s.context.gender).toBe('male');
  });

  it('"ignore" puts the colours back as they were', () => {
    let s = send(at(4), {
      type: 'CONTEXT_DETECTED',
      userId: 'sara',
      place: 'Clinic',
      demo: true,
      profile: null,
      gender: 'female',
    });
    s = send(s, { type: 'CONTEXT_IGNORE' });
    expect(s.context.gender).toBe('unset');
  });

  it('once the message has started a detection does not repaint the pages', () => {
    const s = send(at(7), {
      type: 'CONTEXT_DETECTED',
      userId: 'sara',
      place: 'Clinic',
      demo: true,
      profile: null,
      gender: 'female',
    });
    expect(s.context.gender).toBe('unset');
  });
});

describe('the theme reaches the page and is saved', () => {
  let root: Root | null = null;
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
  });
  afterEach(() => act(() => root?.unmount()));
  const mount = () => {
    let sendIt: (e: Ev) => void = () => {};
    function Grab() {
      sendIt = useSend();
      return null;
    }
    root = createRoot(document.createElement('div'));
    act(() => root!.render(createElement(MachineProvider, null, createElement(Grab))));
    return (e: Ev) => act(() => sendIt(e));
  };

  it('sets data-theme on <html> and stores the choice', () => {
    const go = mount();
    expect(document.documentElement.dataset.theme).toBe('standard');
    for (const e of PATH_TO_SCREEN[3]) go(e);
    go({ type: 'CHOOSE_GENDER', gender: 'female' });
    expect(document.documentElement.dataset.theme).toBe('pink');
    expect(loadSettings().gender).toBe('female');
    go({ type: 'CHOOSE_GENDER', gender: 'male' });
    expect(document.documentElement.dataset.theme).toBe('blue');
  });

  it("a person's profile keeps the choice", () => {
    saveProfile('sara', { ...DEFAULT_SETTINGS, gender: 'female' });
    expect(loadProfile('sara')?.gender).toBe('female');
  });

  it('an unknown stored value falls back to "not set"', () => {
    localStorage.setItem('signscribe.settings.v2', JSON.stringify({ gender: 'robot' }));
    expect(loadSettings().gender).toBe('unset');
  });
});

describe('the profile over the wire (scanner -> server -> app)', () => {
  const presence = (over: Record<string, unknown>) =>
    JSON.stringify({
      id: 'p1',
      type: 'presence',
      userId: 'sara',
      place: 'Clinic',
      rssi: -60,
      demo: true,
      ...over,
    });

  it('the server accepts male, female or nothing, and only with a user', () => {
    for (const g of ['male', 'female']) {
      const p = parseRequest(presence({ gender: g }));
      expect(p.ok && p.msg.type === 'presence' && p.msg.gender).toBe(g);
    }
    const none = parseRequest(presence({}));
    expect(none.ok && none.msg.type === 'presence' && none.msg.gender).toBeNull();
    const bad = parseRequest(presence({ gender: 'robot' }));
    expect(bad.ok).toBe(false);
    const noUser = parseRequest(presence({ userId: null, gender: 'female' }));
    expect(noUser.ok).toBe(false);
  });

  it('the app keeps a known profile and drops anything else', () => {
    const push = (o: Record<string, unknown>) =>
      parseContextPush(
        JSON.stringify({ type: 'context', userId: 'sara', place: null, demo: false, ...o }),
      );
    expect(push({ gender: 'female' })?.gender).toBe('female');
    expect(push({ gender: 'robot' })?.gender).toBeNull();
    expect(push({})?.gender).toBeNull();
    expect(push({ userId: null, place: 'Shop', gender: 'female' })?.gender).toBeNull();
  });
});
