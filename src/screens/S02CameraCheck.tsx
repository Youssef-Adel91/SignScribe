import { Chip } from '../ui/Chip';
import { CamPill, CameraView } from '../ui/CameraView';
import { HandGlyph } from '../ui/HandGlyph';
import { Hint } from '../ui/HintBar';
import { Icon, type IconName } from '../ui/Icon';
import { Screen } from '../ui/Screen';
import { useAnnounceOnChange } from '../output/announcer';
import { useStrings, type AppStrings } from '../output/strings';
import styles from './S02CameraCheck.module.css';
import { HandChip } from '../vision/bits';
import { Demo, useLive } from '../vision/bits';
import { useVision } from '../vision/store';
import { evaluateChecks, type Checks } from '../vision/checks';

type Tone = 'ok' | 'warn';

function getCheckText(strings: AppStrings, key: string): string {
  switch (key) {
    case 'Measuring the light…':
      return strings.checksLightMeasuring;
    case 'Too dark. Turn on a light.':
      return strings.checksLightDark;
    case 'Too bright. Avoid a window behind you.':
      return strings.checksLightBright;
    case 'Good light on your hands':
      return strings.checksLightGood;
    case 'Show one hand to the camera':
      return strings.checksDistanceShowHand;
    case 'A bit far. Move a little closer.':
      return strings.checksDistanceFar;
    case 'A bit close. Move back a little.':
      return strings.checksDistanceClose;
    case 'Distance is good':
      return strings.checksDistanceGood;
    case 'No hand yet. Raise one hand.':
      return strings.checksHandNoHand;
    case 'Your whole hand is in view':
      return strings.checksHandGood;
    case 'Part of your hand is outside the picture':
      return strings.checksHandOutside;
    default:
      return key;
  }
}

function toRows(
  c: Checks,
  strings: AppStrings,
): { title: string; text: string; tone: Tone; icon: IconName }[] {
  const tone = (st: string): Tone => (st === 'ok' ? 'ok' : 'warn');
  return [
    {
      title: strings.checksLightTitle,
      text: getCheckText(strings, c.light.text),
      tone: tone(c.light.state),
      icon: 'sun',
    },
    {
      title: strings.checksDistanceTitle,
      text: getCheckText(strings, c.distance.text),
      tone: tone(c.distance.state),
      icon: 'move',
    },
    {
      title: strings.checksHandTitle,
      text: getCheckText(strings, c.hand.text),
      tone: tone(c.hand.state),
      icon: 'hand',
    },
  ];
}

/** the first thing that is not right, as one short sentence */
function tipFor(c: Checks, strings: AppStrings): string {
  const bad = [c.light, c.distance, c.hand].find((i) => i.state !== 'ok');
  return bad ? getCheckText(strings, bad.text) : strings.checksAllGoodTip;
}

export default function S02CameraCheck() {
  const strings = useStrings();
  const live = useLive();
  const liveChecks = useVision((st) => st.checks);
  const checks = liveChecks ?? evaluateChecks(null, null);

  const designChecks: { title: string; text: string; tone: Tone; icon: IconName }[] = [
    { title: strings.checksLightTitle, text: strings.checksLightGood, tone: 'ok', icon: 'sun' },
    {
      title: strings.checksDistanceTitle,
      text: strings.checksDistanceFar,
      tone: 'warn',
      icon: 'move',
    },
    { title: strings.checksHandTitle, text: strings.checksHandGood, tone: 'ok', icon: 'hand' },
  ];
  const designTip = strings.checksDistanceFar;

  const CHECKS = live ? toRows(checks, strings) : designChecks;
  const TIP = live ? tipFor(checks, strings) : designTip;
  useAnnounceOnChange(strings.cameraCheckTip(TIP));
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
          <Hint gesture="open" label="Hold still while we check" suggested />
          <Hint gesture="down" label="Back" />
        </>
      }
    >
      <div className={styles.body}>
        <div className={styles.left}>
          <h1 className={styles.h1}>Checking your camera</h1>
          <p className={styles.lede}>Hold still for a moment so we can check your setup.</p>
          <ul className={styles.checklist}>
            {CHECKS.map((c) => (
              <li key={c.title} className={`${styles.check} ${styles[c.tone]}`}>
                <div className={styles.checkIcon}>
                  <Icon name={c.icon} size="var(--s-28)" />
                </div>
                <div>
                  <h2 className={styles.checkTitle}>{c.title}</h2>
                  <p className={styles.checkSub}>{c.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <CameraView label="Camera preview for the setup check. Hold still.">
          <Demo>
            <HandGlyph
              gesture="open"
              height="41.2cqw"
              stroke="var(--teal-soft)"
              dot="#fff"
              label="Check progress"
              className={styles.hand}
            />
          </Demo>
          <CamPill style={{ left: '52%', top: 'auto', bottom: '12.5%' }}>{TIP}</CamPill>
        </CameraView>
      </div>
    </Screen>
  );
}
