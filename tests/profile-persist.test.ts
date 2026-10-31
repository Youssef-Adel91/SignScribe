import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MachineProvider, useCtx, useSend } from '../src/state/MachineProvider';
import { loadProfile, saveProfile } from '../src/state/profiles';
import { saveSettings } from '../src/state/settings';
import { DEFAULT_SETTINGS, type Ctx, type Ev, type Settings } from '../src/state/machine';
import { PATH_TO_SCREEN } from '../src/state/paths';

/**
 * What the Persist effect in MachineProvider writes, and where, while a Bluetooth-detected person comes and goes.
 * The real provider, the real machine and the real localStorage (jsdom); only the camera is absent.
 */
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let send: (e: Ev) => void = () => {};
let ctx: Ctx;
function Probe() {
  send = useSend();
  ctx = useCtx();
  return null;
}
let root: Root;
let host: HTMLElement;

const SETTINGS_KEY = 'signscribe.settings.v2';
const globalSettings = (): Record<string, unknown> =>
  JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
const rawProfile = (id: string): Record<string, unknown> | null => {
  const raw = localStorage.getItem(`signscribe.profile.v1.${id}`);
  return raw ? JSON.parse(raw) : null;
};
const mount = () => {
  host = document.createElement('div');
  root = createRoot(host);
  act(() => root.render(createElement(MachineProvider, null, createElement(Probe))));
};
const go = (...events: Ev[]) => act(() => events.forEach((e) => send(e)));
const detect = (userId: string, profile: Settings | null = loadProfile(userId)) =>
  go({ type: 'CONTEXT_DETECTED', userId, place: null, demo: false, profile });
const toComfort = () => go({ type: 'WAKE' }, { type: 'CHECKS_PASSED' }, { type: 'YES' });

const ana: Settings = {
  ...DEFAULT_SETTINGS,
  hand: 'left',
  textSize: 'large',
  voice: true,
  feedback: true,
};
const bea: Settings = {
  ...DEFAULT_SETTINGS,
  hand: 'right',
  textSize: 'xlarge',
  contrast: 'high',
  voice: false,
  feedback: false,
};

beforeEach(() => {
  localStorage.clear();
  saveSettings(DEFAULT_SETTINGS); // what a browser that has been used before holds
});
afterEach(() => {
  act(() => root.unmount());
});

describe('1. where voice and feedback are saved', () => {
  it("with a person set they go into that person's profile and NOT into the global settings", () => {
    mount();
    const before = { ...globalSettings() };
    expect(before).toMatchObject({ voice: true, feedback: true });
    toComfort();
    detect('ana', null);
    go({ type: 'CHOOSE_OUTPUT', voice: false, feedback: false });
    expect(rawProfile('ana')).toMatchObject({ voice: false, feedback: false });
    expect(globalSettings()).toMatchObject({ voice: true, feedback: true }); // untouched
    go({ type: 'CHOOSE_OUTPUT', voice: false, feedback: true });
    expect(rawProfile('ana')).toMatchObject({ voice: false, feedback: true });
    expect(globalSettings()).toMatchObject({ voice: true, feedback: true });
  });
  it('with no person they go into the global settings', () => {
    mount();
    toComfort();
    go({ type: 'CHOOSE_OUTPUT', voice: false, feedback: true });
    expect(globalSettings()).toMatchObject({ voice: false, feedback: true });
    go({ type: 'CHOOSE_OUTPUT', voice: false, feedback: false });
    expect(globalSettings()).toMatchObject({ voice: false, feedback: false });
    expect(localStorage.length).toBe(1); // no profile was created
  });
  it('after the person is gone a change goes to the global settings again, and the profile keeps what it had', () => {
    mount();
    toComfort();
    detect('ana', null);
    go({ type: 'CHOOSE_OUTPUT', voice: false, feedback: false });
    go({ type: 'CONTEXT_CLEARED' });
    go({ type: 'CHOOSE_OUTPUT', voice: true, feedback: false });
    expect(globalSettings()).toMatchObject({ voice: true, feedback: false });
    expect(rawProfile('ana')).toMatchObject({ voice: false, feedback: false });
  });
  it('the sound setting is applied on the spot (the flag the feedback module reads)', async () => {
    const { isFeedbackEnabled } = await import('../src/output/feedback');
    mount();
    toComfort();
    go({ type: 'CHOOSE_OUTPUT', voice: false, feedback: false });
    expect(isFeedbackEnabled()).toBe(false);
    go({ type: 'CHOOSE_OUTPUT', voice: false, feedback: true });
    expect(isFeedbackEnabled()).toBe(true);
  });
});

describe('2. a profile saved before the feedback setting existed', () => {
  const OLD = {
    hand: 'left',
    alphabet: 'english',
    textSize: 'large',
    contrast: 'high',
    dwell: 'slow',
    voice: false,
  };
  it('loads with the default feedback, keeps every other field and does not throw', () => {
    localStorage.setItem('signscribe.profile.v1.old', JSON.stringify(OLD));
    let p: Settings | null = null;
    expect(() => (p = loadProfile('old'))).not.toThrow();
    expect(p).toEqual({ ...OLD, feedback: DEFAULT_SETTINGS.feedback });
  });
  it('applied by a detection it changes the settings it has and leaves feedback at the default; the stored profile keeps its other fields', () => {
    localStorage.setItem('signscribe.profile.v1.old', JSON.stringify(OLD));
    mount();
    detect('old');
    expect(ctx).toMatchObject({
      hand: 'left',
      textSize: 'large',
      contrast: 'high',
      dwell: 'slow',
      voice: false,
      feedback: true,
    });
    expect(rawProfile('old')).toMatchObject(OLD); // not reset to the defaults
  });
  it('a broken or partial profile never throws and falls back field by field', () => {
    localStorage.setItem(
      'signscribe.profile.v1.half',
      JSON.stringify({ textSize: 'xlarge', voice: 'loud' }),
    );
    localStorage.setItem('signscribe.profile.v1.junk', '{nope');
    expect(loadProfile('half')).toEqual({ ...DEFAULT_SETTINGS, textSize: 'xlarge' });
    expect(loadProfile('junk')).toBeNull();
  });
});

describe('3. the person changes: nothing is written over a stored profile', () => {
  const storedAnaAndBea = () => {
    saveProfile('ana', ana);
    saveProfile('bea', bea);
  };
  it('before the message starts the stored profile is loaded and applied, and both stored profiles stay as they were', () => {
    storedAnaAndBea();
    mount();
    detect('ana');
    expect(ctx).toMatchObject({ hand: 'left', textSize: 'large', feedback: true });
    detect('bea');
    expect(ctx).toMatchObject({
      hand: 'right',
      textSize: 'xlarge',
      contrast: 'high',
      voice: false,
      feedback: false,
    });
    expect(rawProfile('ana')).toEqual(ana);
    expect(rawProfile('bea')).toEqual(bea);
  });
  it('after the message started a new person is only shown: their stored profile is NOT overwritten with the previous values', () => {
    storedAnaAndBea();
    mount();
    detect('ana');
    go(...PATH_TO_SCREEN[6]); // spelling: a detection is only noted from here on
    expect(ctx.detected?.userId).toBe('ana');
    detect('bea'); // bea arrives mid-message; their settings are not applied
    expect(ctx.detected?.userId).toBe('bea');
    expect(ctx).toMatchObject({ hand: 'left', textSize: 'large' }); // still ana's values on screen
    expect(rawProfile('bea')).toEqual(bea); // bea's stored profile is untouched
    expect(rawProfile('ana')).toEqual(ana);
  });
  it("a person who arrives mid-message with no stored profile gets no profile made from someone else's values", () => {
    saveProfile('ana', ana);
    mount();
    detect('ana');
    go(...PATH_TO_SCREEN[6]);
    detect('cleo', null);
    expect(rawProfile('cleo')).toBeNull();
  });
  it('when the person leaves, their settings are not copied into the global settings', () => {
    storedAnaAndBea();
    mount();
    const before = JSON.stringify(globalSettings());
    detect('bea');
    expect(ctx).toMatchObject({ voice: false, feedback: false });
    go({ type: 'CONTEXT_CLEARED' });
    expect(JSON.stringify(globalSettings())).toBe(before);
    expect(rawProfile('bea')).toEqual(bea);
  });
  it('a change made while a person is set still reaches their profile (the fix does not stop saving)', () => {
    storedAnaAndBea();
    mount();
    toComfort();
    detect('bea');
    go({ type: 'CHOOSE_TEXT_SIZE', textSize: 'normal' });
    expect(rawProfile('bea')).toMatchObject({ textSize: 'normal', voice: false, feedback: false });
    expect(rawProfile('ana')).toEqual(ana);
  });
  it('"ignore" brings the settings from before the detection back, feedback included', () => {
    mount();
    toComfort();
    expect(ctx.feedback).toBe(true);
    saveProfile('bea', bea);
    detect('bea');
    expect(ctx.feedback).toBe(false);
    go({ type: 'CONTEXT_IGNORE' });
    expect(ctx).toMatchObject({ voice: true, feedback: true, textSize: 'normal' });
  });
});
