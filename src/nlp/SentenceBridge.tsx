import { useEffect, useRef } from 'react';
import { Machine, useSend } from '../state/MachineProvider';
import { alphabetOfSetting, hasUnconfirmed } from '../config/alphabet';
import { validateSentence } from './validate';
import type { AlphabetId, PlaceName } from './protocol';
import type { SentenceClient } from './sentenceClient';

/**
 * Asks the sentence server for a better sentence whenever the review screen (11) shows a new offline
 * one. The offline sentence is on screen at once and stays if the server is missing, slow, wrong or
 * breaks the safety rule: the person never waits for it. The machine checks the answer again before
 * using it. Words are sent only when a client was configured (never by default).
 */
export function SentenceBridge({ client }: { client: SentenceClient }) {
  const send = useSend();
  const inReview = Machine.useSelector((s) => s.matches('review'));
  const words = Machine.useSelector((s) => s.context.words);
  const place = Machine.useSelector((s) => s.context.place);
  const attempt = Machine.useSelector((s) => s.context.sentenceAttempt);
  const confirmed = Machine.useSelector((s) => s.context.sentenceConfirmed);
  const sentence = Machine.useSelector((s) => s.context.sentence);
  const setting = Machine.useSelector((s) => s.context.alphabet);
  const arabic = setting === 'arabic';
  const seen = useRef<string[]>([]);
  const key = `${words.join('|')}#${attempt}`;
  const keyRef = useRef('');
  const wordsRef = useRef('');

  useEffect(() => {
    if (!inReview || confirmed || words.length === 0) return;
    // a word with a letter nobody has confirmed is not a word the server can be sent
    if (words.some(hasUnconfirmed)) return;
    if (keyRef.current === key) return; // already asked for this words + attempt
    const wk = words.join('|');
    if (wk !== wordsRef.current) {
      wordsRef.current = wk; // new words: sentences shown for the old ones no longer matter
      seen.current = [];
    }
    keyRef.current = key;
    seen.current = [...seen.current, sentence].slice(-3);
    const mine = key;
    const asked = [...words];
    client
      .suggest(
        asked,
        place as PlaceName,
        attempt,
        seen.current,
        alphabetOfSetting(setting).id as AlphabetId,
      )
      .then((r) => {
        if (keyRef.current !== mine) return; // the person moved on
        if (!validateSentence(asked, r.sentence, arabic ? 'arabic' : 'english').ok) return; // never trust the server
        if (r.source !== 'llm') return; // an offline answer from the server adds nothing
        send({ type: 'SENTENCE_SERVER', sentence: r.sentence, words: asked, attempt });
      })
      .catch(() => {
        /* the offline sentence stays: no message, nothing for the person to do */
      });
  }, [inReview, confirmed, key, words, place, attempt, sentence, client, send, setting, arabic]);

  return null;
}
