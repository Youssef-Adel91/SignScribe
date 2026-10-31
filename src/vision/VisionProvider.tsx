import { useEffect } from 'react';
import { alphabetOfSetting } from '../config/alphabet';
import { Machine } from '../state/MachineProvider';
import { screenOf } from '../state/machine';
import { evaluateChecks, FpsMeter, meanLuma } from './checks';
import { CameraError, openCamera, type OpenCamera } from './camera';
import { ContextSensor } from './context';
import { GestureController } from './controller';
import { palmFraction } from './landmarks';
import { CardController, IDLE_CARD_UI } from '../cards/controller';
import { OnnxCardDetector } from '../cards/onnx';
import { SortTracker } from '../cards/sort';
import type { CardDetector, Detection } from '../cards/types';
import { LetterController } from '../recognition/letterController';
import { letterLog, rowOf } from '../recognition/letterLog';
import { commandState, dropLettersWithCommand } from '../recognition/priority';
import { onTuningSaved, resolveTuning } from '../recognition/tuning';
import { loadModels, type LoadedModels } from '../recognition/models';
import { createHandTracker, ModelMissingError, type HandTracker } from './hands';
import { getTargets, setHot } from './targets';
import { LETTER_DEBUG, VISION_MODE as MODE, visionStore } from './store';
import { getMockCards } from './mock';
import type { HandFrame } from './types';

/**
 * Owns the whole camera -> gestures -> machine pipeline. Renders nothing.
 * The frame handler reads the machine snapshot directly (not through React state) so that the
 * gesture loop never waits for a re-render.
 */
export function VisionProvider() {
  const actor = Machine.useActorRef();

  useEffect(() => {
    if (MODE === 'off') return;
    let disposed = false;
    const controller = new GestureController(getTargets);
    const fps = new FpsMeter();
    const sensor = new ContextSensor();
    let letters = new LetterController(null, null);
    // picture cards: detector (loaded the first time screen 10 is shown) -> SORT tracker -> hold-to-add
    const sort = new SortTracker();
    const cardCtl = new CardController();
    let detector: CardDetector | null = null;
    let cardsLoading = false;
    let cardBusy = false;
    let lastCardRun = -Infinity;
    let video: HTMLVideoElement | null = null;
    const CARD_EVERY_MS = 100;
    const runCards = (dets: Detection[], t: number) => {
      const snap = actor.getSnapshot();
      const r = cardCtl.step(sort.update(dets, t), t, { screen: 10, place: snap.context.place });
      for (const e of r.events) actor.send(e);
      visionStore.set({ cards: { ...visionStore.state.cards, ui: r.ui } });
    };
    const loadCards = () => {
      if (cardsLoading || MODE === 'mock') return;
      cardsLoading = true;
      visionStore.set({ cards: { ...visionStore.state.cards, status: 'loading' } });
      OnnxCardDetector.create()
        .then((r) => {
          if (disposed) return;
          if ('missing' in r) {
            visionStore.set({
              cards: {
                status: 'missing',
                message: 'No card detector yet.',
                synthetic: false,
                ui: IDLE_CARD_UI,
              },
            });
          } else {
            detector = r.detector;
            visionStore.set({
              cards: {
                status: 'ready',
                message: '',
                synthetic: r.detector.meta.meta.synthetic,
                ui: IDLE_CARD_UI,
              },
            });
          }
        })
        .catch((e: unknown) => {
          if (!disposed)
            visionStore.set({
              cards: {
                status: 'error',
                message: e instanceof Error ? e.message : String(e),
                synthetic: false,
                ui: IDLE_CARD_UI,
              },
            });
        });
    };
    const cardIdle = (
      t: number,
      screen: number,
      place: Parameters<typeof cardCtl.step>[2]['place'],
    ) => {
      if (!visionStore.state.cards.ui.box && !visionStore.state.cards.ui.word) return;
      cardCtl.step([], t, { screen, place }); // lets the controller reset
      sort.reset();
      visionStore.set({ cards: { ...visionStore.state.cards, ui: IDLE_CARD_UI } });
    };
    /** one detector update on screen 10; `dets` come from the mock hook, or null to run the real detector */
    const cardTick = (t: number, dets: Detection[] | null) => {
      const snap = actor.getSnapshot();
      const screen = screenOf(snap.value, snap.context);
      // the card detector also runs under the "hand lost" notice: a card appearing brings the screen back
      if (!snap.matches('cards') || snap.context.overlay === 'help')
        return cardIdle(t, screen, snap.context.place);
      if (MODE === 'mock') {
        if (visionStore.state.cards.status !== 'ready')
          visionStore.set({ cards: { ...visionStore.state.cards, status: 'ready' } });
        return runCards(dets ?? [], t);
      }
      if (!detector) return loadCards();
      if (cardBusy || !video || t - lastCardRun < CARD_EVERY_MS) return;
      cardBusy = true;
      lastCardRun = t;
      detector
        .detect(video, video.videoWidth, video.videoHeight)
        .then((found) => !disposed && runCards(found, t))
        .catch((e: unknown) => {
          detector?.close();
          detector = null;
          visionStore.set({
            cards: {
              status: 'error',
              message: `Card detection stopped: ${e instanceof Error ? e.message : String(e)}`,
              synthetic: false,
              ui: IDLE_CARD_UI,
            },
          });
        })
        .finally(() => (cardBusy = false));
    };
    // letter models are optional files; the app works (with a clear notice) when they are absent
    let loadedFor = '';
    const loadFor = (setting: string) => {
      loadedFor = setting;
      // no letters are read with the old alphabet's model while the new one loads
      letters = new LetterController(null, null);
      visionStore.set({ letters: { ...visionStore.state.letters, status: 'idle', message: '' } });
      void loadModels(fetch, alphabetOfSetting(setting).id).then((m: LoadedModels) => {
        // the alphabet was changed again while this was loading: that load wins
        if (disposed || loadedFor !== setting) return;
        applyModels(m);
      });
    };
    const tuningFor = (modelId: string | undefined) =>
      resolveTuning(alphabetOfSetting(loadedFor).id, modelId);
    const applyModels = (m: LoadedModels) => {
      const tuning = tuningFor(m.letters.recognizer?.id);
      letters = new LetterController(
        m.letters.recognizer,
        m.motion.recognizer,
        tuning,
        alphabetOfSetting(loadedFor).controls,
      );
      visionStore.set({
        letters: {
          ...visionStore.state.letters,
          status: m.letters.status,
          message: m.letters.status === 'ready' ? '' : m.letters.message,
          synthetic: m.letters.synthetic || m.motion.synthetic,
          motionStatus: m.motion.status,
          tuning,
          alphabetId: alphabetOfSetting(loadedFor).id,
          modelId: m.letters.recognizer?.id ?? '',
        },
      });
    };
    // values saved from the debug overlay apply from the next frame
    const tuningSub = onTuningSaved(() => {
      const modelId = visionStore.state.letters.modelId || undefined;
      const tuning = tuningFor(modelId);
      letters.setTuning(tuning);
      visionStore.set({ letters: { ...visionStore.state.letters, tuning } });
    });
    loadFor(actor.getSnapshot().context.alphabet);
    const alphabetSub = actor.subscribe((snap) => {
      if (snap.context.alphabet !== loadedFor) loadFor(snap.context.alphabet);
    });
    let lastHot: string | null = null;

    const onFrame = (frame: HandFrame, inferMs: number) => {
      const stepStart = performance.now();
      const snap = actor.getSnapshot();
      const screen = screenOf(snap.value, snap.context);
      // on the card screen a hand holds the card and the camera may not see it: a card in view counts as presence
      const needsHand =
        snap.matches('spell') ||
        snap.matches('wordSuggestion') ||
        (snap.matches('cards') && !visionStore.state.cards.ui.box);
      const checks = evaluateChecks(visionStore.state.luma, frame);
      const { events, ui } = controller.step(frame, {
        screen,
        signingHand: snap.context.hand,
        dwell: snap.context.dwell,
        needsHand,
        viewport: { w: window.innerWidth, h: window.innerHeight },
        checks,
      });
      // a control gesture, or the pointer / a posing hand in the command zone, has priority over every letter on this very frame
      const command = commandState(
        ui,
        events.map((e) => e.type),
        snap.context.hand,
        window.innerWidth,
      );
      const lr = letters.step(frame, { screen, signingHand: snap.context.hand, command });
      // a command given while a letter is held must not let that letter come straight back
      if (events.some((e) => e.type === 'NO' || e.type === 'DELETE' || e.type === 'SPACE'))
        letters.notifyCommand();
      // one frame never sends a command and a letter
      const letterEvents = dropLettersWithCommand(events, lr.events);
      if (LETTER_DEBUG && (screen === 6 || screen === 7))
        letterLog.record(
          rowOf(
            frame.t,
            screen,
            lr.ui,
            { ...command, label: command.label ?? '' },
            [...events, ...letterEvents].map((e) => e.type),
            `${visionStore.state.letters.alphabetId}/${visionStore.state.letters.modelId || '-'}`,
          ),
        );
      for (const e of [...events, ...letterEvents]) actor.send(e);

      // ---- picture cards: the mock camera is driven by frames, the real one by its own timer (cardTick)
      if (MODE === 'mock') cardTick(frame.t, getMockCards());
      else if (screen !== 10) cardIdle(frame.t, screen, snap.context.place);
      if (ui.dwell.id !== lastHot) {
        lastHot = ui.dwell.id;
        setHot(lastHot);
      }
      const hand0 = frame.hands[0];
      const advice = sensor.update(
        frame.t,
        visionStore.state.luma,
        hand0 ? palmFraction(hand0, frame.width, frame.height) : null,
      );
      const prev = visionStore.state.advice;
      visionStore.set({
        frame,
        ui,
        checks,
        inferMs,
        stepMs: performance.now() - stepStart,
        fps: fps.tick(frame.t),
        advice: prev.message === advice.message && prev.light === advice.light ? prev : advice,
        letters: { ...visionStore.state.letters, ui: lr.ui },
      });
    };

    let cleanup: () => void = () => {};

    if (MODE === 'mock') {
      visionStore.set({ status: 'running', source: 'mock', luma: 140, message: '' });
      void import('./mock').then(({ installMock }) => {
        if (disposed) return;
        const un = installMock(
          (f) => onFrame(f, 0),
          (v) => visionStore.set({ luma: v }),
        );
        cleanup = un;
      });
      return () => {
        disposed = true;
        alphabetSub.unsubscribe();
        tuningSub();
        cleanup();
        visionStore.reset();
      };
    }

    // ---- real camera + MediaPipe
    let cam: OpenCamera | null = null;
    let tracker: HandTracker | null = null;
    let raf = 0;
    let lumaTimer = 0;
    let cardTimer = 0;

    const fail = (e: unknown) => {
      if (e instanceof ModelMissingError) {
        visionStore.set({ status: 'nomodel', message: e.message });
      } else if (e instanceof CameraError) {
        visionStore.set({
          status: e.kind === 'denied' ? 'denied' : e.kind === 'nocamera' ? 'nocamera' : 'error',
          message: e.message,
        });
      } else {
        visionStore.set({
          status: 'error',
          message: `Hand tracking could not start: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    };

    void (async () => {
      try {
        visionStore.set({
          status: 'asking',
          source: 'camera',
          message: 'Allow the camera when your browser asks.',
        });
        cam = await openCamera();
        if (disposed) return cam.stop();
        visionStore.set({
          status: 'starting',
          stream: cam.stream,
          video: { w: cam.width, h: cam.height },
          message: 'Loading the hand model…',
        });
        tracker = await createHandTracker();
        if (disposed) return;
        visionStore.set({ status: 'running', message: '', delegate: tracker.delegate });

        const c = document.createElement('canvas');
        c.width = 32;
        c.height = 18;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        lumaTimer = window.setInterval(() => {
          if (!ctx || !cam) return;
          ctx.drawImage(cam.video, 0, 0, 32, 18);
          visionStore.set({ luma: meanLuma(ctx.getImageData(0, 0, 32, 18).data) });
        }, 500);

        let lastVideoTime = -1;
        video = cam.video;
        const vid = cam.video;
        cardTimer = window.setInterval(() => cardTick(performance.now(), null), CARD_EVERY_MS);
        const loop = () => {
          if (disposed || !tracker) return;
          if (vid.readyState >= 2 && vid.currentTime !== lastVideoTime) {
            lastVideoTime = vid.currentTime;
            const t = performance.now();
            try {
              const { hands, ms } = tracker.detect(vid, t);
              onFrame({ t, hands, width: vid.videoWidth, height: vid.videoHeight }, ms);
            } catch (e) {
              fail(e);
              return;
            }
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch (e) {
        if (!disposed) fail(e);
      }
    })();

    return () => {
      disposed = true;
      alphabetSub.unsubscribe();
      tuningSub();
      cancelAnimationFrame(raf);
      clearInterval(lumaTimer);
      clearInterval(cardTimer);
      tracker?.close();
      detector?.close();
      cam?.stop();
      setHot(null);
      visionStore.reset();
    };
  }, [actor]);

  // the rest of the app styles itself differently once vision is on (design placeholders go away)
  useEffect(() => {
    const apply = () => {
      if (visionStore.state.status !== 'off') document.documentElement.dataset.live = '1';
      else delete document.documentElement.dataset.live;
    };
    apply();
    return visionStore.subscribe(apply);
  }, []);
  return null;
}
