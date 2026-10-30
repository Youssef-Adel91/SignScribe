import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createActor, getNextSnapshot } from 'xstate';
import type { SnapshotFrom } from 'xstate';
import { describe, expect, it } from 'vitest';
import {
  ALPHABET_OF_SETTING,
  alphabetOfSetting,
  dropLastGlyph,
  getAlphabet,
  glyphOf,
  hasUnconfirmed,
  parseAlphabet,
} from '../src/config/alphabet';
import { letterModelUrls, loadLetters } from '../src/recognition/models';
import { Message } from '../src/ui/Message';
import { textDir } from '../src/ui/useAlphabet';
import { signScribeMachine, type Ev } from '../src/state/machine';
import { PATH_TO_SCREEN } from '../src/state/paths';
import { loadSettings, saveSettings } from '../src/state/settings';
import { DEFAULT_SETTINGS } from '../src/state/machine';
import { offlineSentence } from '../src/nlp/sentence';
import { validateSentence } from '../src/nlp/validate';
import { parseRequest } from '../src/nlp/protocol';
import { emptyData, sessionCsv, trialsCsv, type TrialLog } from '../src/study/log';

const arsl = getAlphabet('arsl');
const asl = getAlphabet('asl');

type Snap = SnapshotFrom<typeof signScribeMachine>;
const send = (snap: Snap, ...events: Ev[]): Snap =>
  events.reduce((s, e) => getNextSnapshot(signScribeMachine, s, e), snap);
const start = (): Snap => {
  const a = createActor(signScribeMachine);
  a.start();
  return a.getSnapshot();
};
const L = (letter: string): Ev[] => [
  { type: 'LETTER_CANDIDATE', candidate: { letter, confidence: 0.9, alternatives: [] } },
  { type: 'LETTER_CONFIRMED', letter },
];
/** the machine on the spelling screen with the ArSL alphabet chosen */
const spellingArabic = (): Snap =>
  send(
    start(),
    ...PATH_TO_SCREEN[3],
    { type: 'CHOOSE_ALPHABET', alphabet: 'arabic' },
    ...([{ type: 'YES' }, { type: 'YES' }, { type: 'YES' }, { type: 'YES' }] as Ev[]),
  );

describe('1. the alphabet file decides what a class looks like', () => {
  it('a confirmed ArSL class shows its Arabic glyph', () => {
    expect(glyphOf(arsl, 'ain')).toEqual({ text: 'ع', confirmed: true });
    expect(glyphOf(arsl, 'zay')).toEqual({ text: 'ز', confirmed: true });
  });
  it('a class with no confirmed glyph shows the Latin id, marked, and is flagged unconfirmed', () => {
    for (const id of ['ta', 'taa', 'toot', 'ha', 'haa', 'ya', 'yaa', 'dha', 'dhad']) {
      const g = glyphOf(arsl, id);
      expect(g.confirmed).toBe(false);
      expect(g.text).toBe(`⟨${id}⟩`);
      expect(hasUnconfirmed(g.text)).toBe(true);
    }
  });
  it('every ArSL class is either a real glyph or a marked id; nothing is guessed', () => {
    for (const id of arsl.static) {
      const g = glyphOf(arsl, id);
      if (g.confirmed) expect(g.text).toBe(arsl.display[id]);
      else expect(g.text).toBe(`⟨${id}⟩`);
    }
  });
  it('a class listed in a todo question is unconfirmed even if the table has a glyph for it', () => {
    const a = parseAlphabet(
      {
        static: ['x', 'y'],
        display: { x: 'س', y: 'ص' },
        todo: [{ classes: ['x'], question: '?' }],
      },
      't',
    );
    expect(glyphOf(a, 'x').confirmed).toBe(false);
    expect(glyphOf(a, 'y')).toEqual({ text: 'ص', confirmed: true });
  });
  it('ASL keeps showing the letter itself, upper case, as before', () => {
    expect(glyphOf(asl, 'H')).toEqual({ text: 'H', confirmed: true });
    expect(glyphOf(asl, 'h').text).toBe('H');
  });
  it('the setting names map to the alphabet files', () => {
    expect(ALPHABET_OF_SETTING).toEqual({ english: 'asl', arabic: 'arsl' });
    expect(alphabetOfSetting('arabic').id).toBe('arsl');
    expect(alphabetOfSetting('english').id).toBe('asl');
    expect(alphabetOfSetting('more').id).toBe('asl');
  });
  it('dropping the last glyph removes a whole marked id and a two-character glyph', () => {
    expect(dropLastGlyph(arsl, 'ع⟨ta⟩')).toBe('ع');
    const two = parseAlphabet({ static: ['al', 'ain'], display: { al: 'ال', ain: 'ع' } }, 't');
    expect(dropLastGlyph(two, 'عال')).toBe('ع'); // ال is one letter of two characters
    expect(dropLastGlyph(arsl, 'عال')).toBe('عا'); // not confirmed in ArSL yet: ا and ل are separate letters
    expect(dropLastGlyph(arsl, 'عب')).toBe('ع');
    expect(dropLastGlyph(arsl, '')).toBe('');
    expect(dropLastGlyph(asl, 'HELLO')).toBe('HELL');
  });

  describe('the letter buffer in the machine', () => {
    it('writes the glyph of the class, not its first character', () => {
      const s = send(spellingArabic(), ...L('ain'), ...L('bb'));
      expect(s.context.alphabet).toBe('arabic');
      expect(s.context.word).toBe('عب');
    });
    it('writes an unconfirmed class as its marked Latin id', () => {
      const s = send(spellingArabic(), ...L('ain'), ...L('ta'));
      expect(s.context.word).toBe('ع⟨ta⟩');
    });
    it('Delete takes back a whole letter, also a marked one', () => {
      const s = send(spellingArabic(), ...L('ain'), ...L('ta'), { type: 'DELETE' });
      expect(s.context.word).toBe('ع');
    });
    it('English is unchanged: first letter, upper case', () => {
      const s = send(
        start(),
        ...PATH_TO_SCREEN[3],
        { type: 'YES' },
        { type: 'YES' },
        { type: 'YES' },
        { type: 'YES' },
        ...L('h'),
      );
      expect(s.context.word).toBe('H');
    });
    it('there is no English word suggestion for an Arabic word', () => {
      const s = send(spellingArabic(), ...L('ain'), { type: 'SPACE' });
      expect(s.value).not.toBe('wordSuggestion');
      expect(s.context.words).toEqual(['ع']);
    });
    it('Done with Arabic words gives a sentence of the words, nothing added', () => {
      const s = send(spellingArabic(), ...L('ain'), { type: 'SPACE' }, ...L('bb'), { type: 'YES' });
      expect(s.value).toBe('review');
      expect(s.context.sentence).toBe('ع ب');
    });
  });
});

describe('2. the alphabet setting and the model file', () => {
  it('is stored with the other settings and read back', () => {
    localStorage.clear();
    saveSettings({ ...DEFAULT_SETTINGS, alphabet: 'arabic' });
    expect(loadSettings().alphabet).toBe('arabic');
    localStorage.setItem('signscribe.settings.v2', JSON.stringify({ alphabet: 'more' }));
    expect(loadSettings().alphabet).toBe('english');
    localStorage.setItem('signscribe.settings.v2', JSON.stringify({ alphabet: 'klingon' }));
    expect(loadSettings().alphabet).toBe('english');
  });
  it('ASL keeps its original file names; every other alphabet has its own pair', () => {
    expect(letterModelUrls('asl').knn).toMatch(/models\/letters-knn\.json$/);
    expect(letterModelUrls('asl').mlp).toMatch(/models\/letters-mlp\.json$/);
    expect(letterModelUrls('arsl').knn).toMatch(/models\/letters-arsl-knn\.json$/);
    expect(letterModelUrls('arsl').mlp).toMatch(/models\/letters-arsl-mlp\.json$/);
  });

  const knn = (labels: string[]) => ({
    format: 'signscribe-model',
    version: 1,
    type: 'knn',
    features: 'hand60-v1',
    k: 1,
    labels,
    vectors: [Array(60).fill(0), Array(60).fill(1)],
    y: [0, 1],
    meta: { synthetic: false },
  });
  const json = (b: unknown) =>
    new Response(JSON.stringify(b), { headers: { 'content-type': 'application/json' } });
  const missing = () => new Response('', { status: 404 });
  const fakeFetch = (files: Record<string, unknown>) => {
    const asked: string[] = [];
    const f = (async (url: string) => {
      asked.push(url);
      const hit = Object.entries(files).find(([name]) => url.endsWith(name));
      return hit ? json(hit[1]) : missing();
    }) as typeof fetch;
    return { f, asked };
  };

  it('the ArSL loader reads the ArSL files and never the ASL ones', async () => {
    const { f, asked } = fakeFetch({ 'letters-arsl-knn.json': knn(['ain', 'bb']) });
    const r = await loadLetters(f, 'arsl');
    expect(r.status).toBe('ready');
    expect(asked.some((u) => u.endsWith('letters-arsl-mlp.json'))).toBe(true);
    expect(asked.every((u) => u.includes('arsl'))).toBe(true);
  });
  it('the ASL loader does not read an ArSL model that sits next to it', async () => {
    const { f, asked } = fakeFetch({ 'letters-arsl-knn.json': knn(['ain', 'bb']) });
    const r = await loadLetters(f, 'asl');
    expect(r.status).toBe('missing');
    expect(asked.every((u) => !u.includes('arsl'))).toBe(true);
  });
  it('a model with letters of another alphabet is refused with a plain message', async () => {
    const { f } = fakeFetch({ 'letters-arsl-knn.json': knn(['A', 'B']) });
    const r = await loadLetters(f, 'arsl');
    expect(r.status).toBe('error');
    expect(r.message).toMatch(/another alphabet/);
    const asl2 = fakeFetch({ 'letters-knn.json': knn(['ain', 'bb']) });
    expect((await loadLetters(asl2.f, 'asl')).status).toBe('error');
  });
});

describe('3. right to left text, chrome stays left to right', () => {
  it('textDir is set only for ArSL', () => {
    expect(textDir(true)).toEqual({ dir: 'rtl', lang: 'ar' });
    expect(textDir(false)).toEqual({});
  });
  it('the message line is rtl when asked, with the placeholder still ltr', () => {
    const on = renderToStaticMarkup(createElement(Message, { text: 'عب', rtl: true, caret: true }));
    expect(on).toContain('dir="rtl"');
    expect(on).toContain('lang="ar"');
    const off = renderToStaticMarkup(createElement(Message, { text: 'HELLO' }));
    expect(off).not.toContain('dir=');
    const empty = renderToStaticMarkup(
      createElement(Message, { text: '', rtl: true, placeholder: 'Your letters will appear here' }),
    );
    expect(empty).toContain('dir="ltr"');
  });
  it('an unconfirmed letter is drawn apart, with its marks', () => {
    const html = renderToStaticMarkup(createElement(Message, { text: 'ع⟨ta⟩', rtl: true }));
    expect(html).toContain('data-testid="unconfirmed-letter"');
    expect(html).toContain('⟨ta⟩');
  });
});

describe('4. control classes exist only when the alphabet file lists them', () => {
  it('ArSL lists none, so Space / Delete / Done stay hand gestures', () => {
    expect(arsl.controls).toEqual({});
    expect(asl.controls).toEqual({});
  });
  it('a file may list them; the class must be one of its labels and the action a known one', () => {
    const a = parseAlphabet(
      { static: ['a', 'sp', 'del'], controls: { sp: 'space', del: 'delete' } },
      'c',
    );
    expect(a.controls).toEqual({ sp: 'space', del: 'delete' });
    expect(() => parseAlphabet({ static: ['a', 'b'], controls: { zz: 'space' } }, 'c')).toThrow(
      /not a label/,
    );
    expect(() => parseAlphabet({ static: ['a', 'b'], controls: { a: 'jump' } }, 'c')).toThrow(
      /space, delete, finish/,
    );
  });
  it('a class not listed as a control is written as a letter, never as a command', () => {
    const s = send(spellingArabic(), ...L('al'));
    expect(s.context.word).toBe('⟨al⟩'); // a letter class (unconfirmed), not Space or Delete
    expect(s.value).not.toBe('review');
  });
});

describe('5. the validator when ArSL is active', () => {
  const ok = (chosen: string[], text: string) => validateSentence(chosen, text, 'arabic');
  it('accepts a sentence with the chosen words', () => {
    expect(ok(['طبيب'], 'أحتاج طبيب من فضلك').ok).toBe(true);
    expect(ok(['طبيب', 'ماء'], 'طبيب ماء.').ok).toBe(true);
  });
  it('skips the English-only part: Arabic words are not "unexpected characters"', () => {
    expect(validateSentence(['طبيب'], 'طبيب', 'english').ok).toBe(false);
    expect(ok(['طبيب'], 'طبيب').ok).toBe(true);
  });
  it.each([
    ['empty', ' ', /empty/],
    ['too long', 'ا'.repeat(201), /too long/],
    ['too many words', Array(26).fill('كلمة').join(' '), /too many words/],
    ['a link', 'طبيب https://x.com', /link/],
    ['an e-mail', 'طبيب a@b.com', /link/],
    ['Latin letters', 'طبيب doctor', /unexpected/],
    ['digits', 'طبيب 5', /unexpected/],
    ['three sentences', 'طبيب. ماء. دواء. كلمة.', /more than two/],
    ['a chosen word missing', 'ماء', /missing/],
  ])('still refuses %s', (_n, text, why) => {
    const v = ok(['طبيب'], text);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toMatch(why);
  });
  it('English stays exactly as strict as before', () => {
    expect(validateSentence(['DOCTOR'], 'I need a doctor, please.').ok).toBe(true);
    expect(validateSentence(['DOCTOR'], 'I need a doctor at 5 pm.').ok).toBe(false);
    expect(validateSentence(['DOCTOR'], 'I need a doctor and a nurse.').ok).toBe(false);
  });
  it('the offline sentence for Arabic is the words, nothing added', () => {
    expect(offlineSentence(['طبيب', 'ماء'], 'Clinic', 2, 'arabic')).toBe('طبيب ماء');
    expect(offlineSentence(['DOCTOR'], 'Clinic', 0)).toBe('Doctor.');
  });
  it('the request carries the alphabet, and Arabic words are accepted only with it', () => {
    const msg = (o: Record<string, unknown>) =>
      JSON.stringify({
        id: 'r',
        type: 'suggest',
        words: ['طبيب'],
        place: 'Clinic',
        attempt: 0,
        ...o,
      });
    expect(parseRequest(msg({})).ok).toBe(false);
    const p = parseRequest(msg({ alphabet: 'arsl' }));
    expect(p.ok && p.msg.type === 'suggest' && p.msg.alphabet).toBe('arsl');
    expect(parseRequest(msg({ alphabet: 'klingon' })).ok).toBe(false);
    expect(parseRequest(msg({ alphabet: 'arsl', words: ['doctor'] })).ok).toBe(false);
    const asl = parseRequest(msg({ words: ['DOCTOR'], alphabet: 'asl' }));
    expect(asl.ok && asl.msg.type === 'suggest' && asl.msg.alphabet).toBeUndefined();
  });
});

describe('the study export names the alphabet', () => {
  const trial: TrialLog = {
    participant: 1,
    block: 0,
    mode: 'camera',
    set: 'A',
    taskId: 'A1',
    startedAt: 1_700_000_000_000,
    durationMs: 1000,
    corrections: 0,
    rejections: 0,
    backs: 0,
    handLost: 0,
    attempts: 1,
    success: true,
    endedBy: 'done',
    finalText: 'x',
    cameraFps: null,
    inferMsMean: null,
    delegate: null,
  };
  it('trial rows carry it; keyboard trials and older data leave it empty', () => {
    const lines = trialsCsv({
      ...emptyData(),
      trials: [{ ...trial, alphabet: 'arsl' }, { ...trial, mode: 'keyboard', alphabet: '' }, trial],
    })
      .trim()
      .split('\n');
    const head = lines[0].split(',');
    const col = head.indexOf('alphabet');
    expect(col).toBeGreaterThan(-1);
    expect(lines[1].split(',')[col]).toBe('arsl');
    expect(lines[2].split(',')[col]).toBe('');
    expect(lines[3].split(',')[col]).toBe('');
  });
  it('session rows carry it too', () => {
    const csv = sessionCsv({
      ...emptyData(),
      sessions: [
        {
          participant: 1,
          startedAt: 1_700_000_000_000,
          appVersion: 'v',
          userAgent: 'ua',
          screen: '1x1',
          cores: 4,
          textSize: 'normal',
          contrast: 'standard',
          dwell: 'auto',
          voice: true,
          signingHand: 'right',
          alphabet: 'arsl',
        },
      ],
    })
      .trim()
      .split('\n');
    expect(csv[0].split(',')).toContain('alphabet');
    expect(csv[1].split(',').pop()).toBe('arsl');
  });
});
