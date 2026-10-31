import { useEffect, useState } from 'react';
import { AnnouncerProvider } from '../output/announcer';
import { MachineProvider, useSend } from '../state/MachineProvider';
import { PATH_TO_SCREEN } from '../state/paths';
import { DevPanel } from '../dev/DevPanel';
import { VisionDebug } from '../dev/VisionDebug';
import { SentenceBridge } from '../nlp/SentenceBridge';
import { WsSentenceClient, resolveSentenceUrl } from '../nlp/sentenceClient';
import { PerfPanel } from '../perf/PerfPanel';
import { CardSheet } from '../cards/CardSheet';
import { CardNotice } from '../cards/CardNotice';
import { LetterNotice } from '../recognition/LetterNotice';
import { ContextNotice } from '../vision/ContextNotice';
import { PointerOverlay } from '../vision/PointerOverlay';
import { StatusBanner } from '../vision/StatusBanner';
import { VisionProvider } from '../vision/VisionProvider';
import { LETTER_DEBUG } from '../vision/store';
import { ScreenHost } from './ScreenHost';
import { CollectPanel } from '../collect/CollectPanel';
import { LetterDebug } from '../dev/LetterDebug';
import { WozPanel } from '../dev/WozPanel';
import { StudyPanel } from '../study/StudyPanel';
import { StudyProvider } from '../study/StudyProvider';

const params = new URLSearchParams(window.location.search);
/** Developer simulator. Without ?dev=1 there is no mouse or keyboard navigation at all. */
export const DEV = params.get('dev') === '1';
/** Comparison study console (facilitator). Independent of ?dev=1. */
export const STUDY = params.get('study') === '1';
/** Data collection mode for the letter recogniser (researcher tool). */
export const COLLECT = params.get('collect') === '1';
/** Wizard-of-Oz letter entry for studies before a letter model exists. */
export const WOZ = params.get('woz') === '1';
/** Printable sheet of the picture cards. */
export const CARD_SHEET = params.get('cards') === 'print';
/** Performance recording panel (measures fps, model time and stalls on the real camera). */
export const PERF = params.get('perf') === '1';
/**
 * Sentence server (Phase 6). Off unless an address is given: the build's VITE_SENTENCE_URL, or `?server=ws://localhost:8787`
 * for development. The comparison study always uses the offline rules so both methods get the same sentences.
 */
const SENTENCE_URL = STUDY
  ? null
  : resolveSentenceUrl(
      window.location.search,
      import.meta.env.VITE_SENTENCE_URL as string | undefined,
    );
const sentenceClient = SENTENCE_URL ? new WsSentenceClient(SENTENCE_URL) : null;

function initialScreen(): number {
  if (!DEV) return 1;
  const n = Number(window.location.hash.replace('#', ''));
  return n >= 1 && n <= 14 ? n : 1;
}

/** Replays the event path to a screen on mount (dev only). */
function Replay({ screen }: { screen: number }) {
  const send = useSend();
  useEffect(() => {
    for (const e of PATH_TO_SCREEN[screen] ?? []) send(e);
  }, [screen, send]);
  return null;
}

function Body() {
  const [boot, setBoot] = useState({ key: 0, screen: initialScreen() });
  return (
    <>
      <MachineProvider key={boot.key}>
        {DEV && <Replay screen={boot.screen} />}
        {STUDY && <StudyPanel />}
        {COLLECT && <CollectPanel />}
        {WOZ && <WozPanel />}
        {PERF && <PerfPanel />}
        {sentenceClient && <SentenceBridge client={sentenceClient} />}
        {CARD_SHEET && <CardSheet />}
        <ScreenHost />
        <VisionProvider />
        <PointerOverlay />
        <StatusBanner />
        <ContextNotice />
        <LetterNotice />
        <CardNotice />
        {DEV && <DevPanel goTo={(screen) => setBoot((b) => ({ key: b.key + 1, screen }))} />}
        {DEV && <VisionDebug />}
        {LETTER_DEBUG && <LetterDebug />}
      </MachineProvider>
    </>
  );
}

export function App() {
  return (
    <AnnouncerProvider>
      <StudyProvider enabled={STUDY}>
        <Body />
      </StudyProvider>
    </AnnouncerProvider>
  );
}
