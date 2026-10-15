import { useEffect } from 'react';
import { Machine } from '../state/MachineProvider';
import { screenOf } from '../state/machine';
import { evaluateChecks, FpsMeter, meanLuma } from './checks';
import { CameraError, openCamera, type OpenCamera } from './camera';
import { GestureController } from './controller';
import { createHandTracker, ModelMissingError, type HandTracker } from './hands';
import { getTargets, setHot } from './targets';
import { visionStore } from './store';
import type { HandFrame } from './types';

const params = new URLSearchParams(window.location.search);
const DEV = params.get('dev') === '1';
/** ?dev=1&vision=off: no camera (screenshots, layout work). ?dev=1&vision=mock: frames come from a test hook. */
const MODE: 'camera' | 'off' | 'mock' = !DEV
  ? 'camera'
  : params.get('vision') === 'off'
    ? 'off'
    : params.get('vision') === 'mock'
      ? 'mock'
      : 'camera';

/**
 * Owns the whole camera -> gestures -> machine pipeline. Renders nothing.
 * The frame handler reads the machine snapshot directly (not through React state) so that the
 * gesture loop never waits for a re-render.
 */
export function VisionProvider() {
  const actor = Machine.useActorRef();

  useEffect(() => {
    if (MODE === 'off') {
      visionStore.set({ status: 'off', source: 'none' });
      return;
    }
    let disposed = false;
    const controller = new GestureController(getTargets);
    const fps = new FpsMeter();
    let lastHot: string | null = null;

    const onFrame = (frame: HandFrame, inferMs: number) => {
      const snap = actor.getSnapshot();
      const screen = screenOf(snap.value, snap.context);
      const needsHand =
        snap.matches('spell') || snap.matches('wordSuggestion') || snap.matches('cards');
      const checks = evaluateChecks(visionStore.state.luma, frame);
      const { events, ui } = controller.step(frame, {
        screen,
        signingHand: snap.context.hand,
        needsHand,
        viewport: { w: window.innerWidth, h: window.innerHeight },
        checks,
      });
      for (const e of events) actor.send(e);
      if (ui.dwell.id !== lastHot) {
        lastHot = ui.dwell.id;
        setHot(lastHot);
      }
      visionStore.set({ frame, ui, checks, inferMs, fps: fps.tick(frame.t) });
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
        cleanup();
        visionStore.reset();
      };
    }

    // ---- real camera + MediaPipe
    let cam: OpenCamera | null = null;
    let tracker: HandTracker | null = null;
    let raf = 0;
    let lumaTimer = 0;

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
        visionStore.set({ status: 'running', message: '' });

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
        const video = cam.video;
        const loop = () => {
          if (disposed || !tracker) return;
          if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime;
            const t = performance.now();
            try {
              const { hands, ms } = tracker.detect(video, t);
              onFrame({ t, hands, width: video.videoWidth, height: video.videoHeight }, ms);
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
      cancelAnimationFrame(raf);
      clearInterval(lumaTimer);
      tracker?.close();
      cam?.stop();
      setHot(null);
      visionStore.reset();
    };
  }, [actor]);

  // the rest of the app styles itself differently once real input is flowing
  useEffect(
    () =>
      visionStore.subscribe(() => {
        const live = visionStore.state.status === 'running';
        if (live) document.documentElement.dataset.live = '1';
        else delete document.documentElement.dataset.live;
      }),
    [],
  );
  return null;
}
