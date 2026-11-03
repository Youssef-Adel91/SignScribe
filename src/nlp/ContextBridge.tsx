import { useEffect, useRef } from 'react';
import { alphabetOfSetting } from '../config/alphabet';
import { useCtx, useSend } from '../state/MachineProvider';
import { loadProfile } from '../state/profiles';
import { ContextFeed } from './contextFeed';
import { receiveLetter } from './remoteLetter';

/**
 * Turns what the Bluetooth scanner found (pushed by the sentence server) into machine events: the detected
 * place is loaded and the recognised person's saved settings are applied before a message starts, and
 * the person can override both (CONTEXT_IGNORE). With no server, no scanner or Bluetooth off nothing
 * arrives and the app works exactly as it did before.
 */
export function ContextBridge({ url }: { url: string }) {
  const send = useSend();
  // the letters of the alphabet chosen now; a ref, so choosing another alphabet does not reconnect the feed
  const { alphabet } = useCtx();
  const labels = useRef<readonly string[]>([]);
  const a = alphabetOfSetting(alphabet);
  labels.current = [...a.static, ...a.dynamic];
  useEffect(() => {
    const feed = new ContextFeed(
      url,
      (c) => {
        if (!c) send({ type: 'CONTEXT_CLEARED' });
        else
          send({
            type: 'CONTEXT_DETECTED',
            userId: c.userId,
            place: c.place,
            demo: c.demo,
            profile: c.userId ? loadProfile(c.userId) : null,
            gender: c.gender,
          });
      },
      undefined,
      undefined,
      undefined,
      (p) => receiveLetter(p, Date.now(), labels.current),
    );
    return () => feed.close();
  }, [url, send]);
  return null;
}
