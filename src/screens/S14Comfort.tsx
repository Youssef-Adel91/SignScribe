import { useEffect, type ReactNode } from 'react';
import { READ_ALOUD_ENGLISH_ONLY } from '../ui/readAloudNote';
import { Chip } from '../ui/Chip';
import { Hint } from '../ui/HintBar';
import { Screen } from '../ui/Screen';
import { Tile } from '../ui/Tile';
import { useCtx, useSend } from '../state/MachineProvider';
import type { Contrast, DwellSetting, TextSize } from '../state/machine';
import { useAnnounceOnChange } from '../output/announcer';
import { useHasArabicVoice } from '../output/speech';
import { useStrings } from '../output/strings';
import { HandChip } from '../vision/bits';
import { useVision } from '../vision/store';
import common from './common.module.css';
import styles from './S14Comfort.module.css';

const TEXT: { key: TextSize; title: string; sub: string }[] = [
  { key: 'normal', title: 'Normal', sub: 'Default size' },
  { key: 'large', title: 'Large', sub: '25% bigger' },
  { key: 'xlarge', title: 'Extra large', sub: '50% bigger' },
];
const CONTRAST: { key: Contrast; title: string; sub: string }[] = [
  { key: 'standard', title: 'Standard', sub: 'Normal colours' },
  { key: 'high', title: 'High contrast', sub: 'Black on white' },
];
const DWELL: { key: DwellSetting; title: string; sub: string }[] = [
  { key: 'auto', title: 'Auto', sub: 'Adapts to you' },
  { key: 'slow', title: 'Slower', sub: 'Hold 1.2 s' },
  { key: 'normal', title: 'Normal', sub: 'Hold 0.8 s' },
  { key: 'fast', title: 'Faster', sub: 'Hold 0.6 s' },
];
const VOICE: { key: string; title: string; sub: string; voice: boolean; feedback: boolean }[] = [
  { key: 'all', title: 'Read aloud', sub: 'Voice and ticks', voice: true, feedback: true },
  { key: 'sounds', title: 'Sounds only', sub: 'Ticks, no voice', voice: false, feedback: true },
  { key: 'off', title: 'Silent', sub: 'Text only', voice: false, feedback: false },
];

/** One setting: a titled card with its choices side by side (the cards sit in a 2 x 2 grid so the page never scrolls). */
function Group({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className={styles.group} aria-labelledby={id}>
      <h2 className={styles.groupTitle} id={id}>
        {title}
      </h2>
      <ul className={styles.options} aria-labelledby={id}>
        {children}
      </ul>
    </section>
  );
}

/**
 * Screen 14 (no Figma frame): the comfort settings added in Phase 3. It sits right after 03 and uses
 * the same layout, hints and gestures, so it works like the screens before it.
 */
export default function S14Comfort() {
  const { textSize, contrast, dwell, voice, feedback, alphabet } = useCtx();
  const send = useSend();
  const strings = useStrings();
  const hasArVoice = useHasArabicVoice();
  const noArabicVoice = alphabet === 'arabic' && !hasArVoice;
  const holdMs = useVision((s) => s.ui?.dwell.ms ?? null);
  const live = holdMs !== null;

  // Fall back to sounds only if Arabic is active but no Arabic voice is installed
  useEffect(() => {
    if (noArabicVoice && voice) {
      send({ type: 'CHOOSE_OUTPUT', voice: false, feedback: true });
    }
  }, [noArabicVoice, voice, send]);

  useAnnounceOnChange(
    dwell === 'auto' && live
      ? strings.comfortAnnounceLive((holdMs / 1000).toFixed(1))
      : strings.comfortAnnounceStatic,
  );
  return (
    <Screen
      steps={['active', 'todo', 'todo', 'todo']}
      chips={
        <>
          <Chip kind="green">Camera on</Chip>
          <HandChip />
          <Chip kind="gray">Both hands up: Help</Chip>
        </>
      }
      hints={
        <>
          <Hint gesture="point" label="Point and hold: choose" suggested />
          <Hint gesture="up" label="Continue" />
          <Hint gesture="down" label="Back" />
        </>
      }
    >
      <div className={`${common.center} ${styles.page}`}>
        <header className={styles.head}>
          <h1 className={styles.title}>Make it comfortable</h1>
          <p className={styles.lede}>
            Changes apply straight away. Automatic hold time starts at 0.8 s and adjusts to you
            {live ? ` (now ${(holdMs / 1000).toFixed(1)} s)` : ''}.
          </p>
        </header>

        <div className={styles.grid}>
          <Group id="q-text" title="Text size">
            {TEXT.map((o) => (
              <Tile
                key={o.key}
                size="xs"
                selected={textSize === o.key}
                title={o.title}
                sub={o.sub}
                className={styles.opt}
                dwell={{ type: 'CHOOSE_TEXT_SIZE', textSize: o.key }}
              />
            ))}
          </Group>

          <Group id="q-contrast" title="Colours">
            {CONTRAST.map((o) => (
              <Tile
                key={o.key}
                size="xs"
                selected={contrast === o.key}
                title={o.title}
                sub={o.sub}
                className={styles.opt}
                dwell={{ type: 'CHOOSE_CONTRAST', contrast: o.key }}
              />
            ))}
          </Group>

          <Group id="q-dwell" title="Hold time to choose">
            {DWELL.map((o) => (
              <Tile
                key={o.key}
                size="xs"
                selected={dwell === o.key}
                title={o.title}
                sub={o.sub}
                className={styles.opt}
                dwell={{ type: 'CHOOSE_DWELL', dwell: o.key }}
              />
            ))}
          </Group>

          <Group id="q-voice" title="Speech and sounds">
            {VOICE.map((o) => {
              const isAll = o.key === 'all';
              const disabled = isAll && noArabicVoice;
              return (
                <Tile
                  key={o.key}
                  size="xs"
                  selected={o.voice === voice && o.feedback === feedback}
                  title={o.title}
                  sub={disabled ? 'No Arabic voice' : o.sub}
                  className={styles.opt}
                  dwell={{
                    type: 'CHOOSE_OUTPUT',
                    voice: disabled ? false : o.voice,
                    feedback: disabled ? true : o.feedback,
                  }}
                />
              );
            })}
          </Group>
        </div>
        {alphabet === 'arabic' && noArabicVoice && (
          <p className={styles.note} data-testid="read-aloud-note">
            {strings.noArabicVoiceNotice} {READ_ALOUD_ENGLISH_ONLY}
          </p>
        )}
      </div>
    </Screen>
  );
}
