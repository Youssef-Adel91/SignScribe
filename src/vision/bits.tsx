import { useEffect, useRef, type ReactNode } from 'react';
import { Chip } from '../ui/Chip';
import { HoldRing } from '../ui/HoldRing';
import { Icon } from '../ui/Icon';
import { isEnabled, useVision, visionStore } from './store';
import type { GestureLabel } from './types';

/** True whenever vision is switched on. Static design values only show with ?dev=1&vision=off. */
export const useLive = (): boolean => useVision(isEnabled);

/** Wraps design-only illustrations (a drawn hand, a fake ring). They disappear when the camera is live. */
export function Demo({ children }: { children: ReactNode }) {
  return (
    <div data-demo="true" style={{ display: 'contents' }}>
      {children}
    </div>
  );
}

/** "Hand detected" chip. With a live camera it follows the real number of hands. */
export function HandChip({ idle = false }: { idle?: boolean }) {
  const live = useLive();
  const hands = useVision((s) => s.ui?.hands ?? 0);
  const on = live ? hands > 0 : !idle;
  return on ? (
    <Chip kind="green">Hand detected</Chip>
  ) : (
    <Chip kind="amber">Waiting for a hand</Chip>
  );
}

/** Hold-to-confirm ring that shows the command gesture the person is making right now. */
export function CommandRing({ label, fallback }: { label: GestureLabel; fallback: number }) {
  const live = useLive();
  const cmd = useVision((s) => s.ui?.command);
  const progress = live ? (cmd?.label === label ? cmd.progress : 0) : fallback;
  if (live && !(cmd?.label === label && progress > 0)) return null;
  return (
    <HoldRing progress={progress} size="100%" label="Hold to confirm">
      <Icon name="check" size="40%" strokeWidth={3.2} />
    </HoldRing>
  );
}

/** The command gesture being held, as the name the command zone uses for it. */
export const COMMAND_NAME: Partial<Record<GestureLabel, 'Space' | 'Delete' | 'Done' | 'Cancel'>> = {
  open: 'Space',
  fist: 'Delete',
  up: 'Done',
  down: 'Cancel',
};

export function useActiveCommand(fallback?: 'Space' | 'Delete' | 'Done' | 'Cancel') {
  const live = useLive();
  const label = useVision((s) => s.ui?.command.label ?? null);
  if (!live) return fallback;
  return label ? COMMAND_NAME[label] : undefined;
}

/** Live mirrored camera picture (the hand model reads a separate hidden video of the same stream). */
export function LiveVideo({ className }: { className?: string }) {
  const stream = useVision((s) => s.stream);
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.srcObject = stream;
    if (stream) void v.play().catch(() => {});
  }, [stream]);
  if (!stream) return null;
  return (
    <video
      ref={ref}
      className={className}
      muted
      playsInline
      autoPlay
      aria-hidden="true"
      style={{ transform: 'scaleX(-1)' }}
    />
  );
}

const BONES = [
  [0, 1, 2, 3, 4],
  [0, 5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [0, 17, 18, 19, 20],
  [5, 9, 13, 17],
];

/** Draws the hand skeleton over the camera picture (mirrored, same crop as object-fit: cover). */
export function SkeletonCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const { frame, video, status } = visionStore.state;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      ctx.clearRect(0, 0, cw, ch);
      if (!frame || status !== 'running') return;
      const vw = video.w || frame.width;
      const vh = video.h || frame.height;
      const scale = Math.max(cw / vw, ch / vh);
      const ox = (vw * scale - cw) / 2;
      const oy = (vh * scale - ch) / 2;
      const map = (x: number, y: number): [number, number] => [
        (1 - x) * vw * scale - ox,
        y * vh * scale - oy,
      ];
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (const hand of frame.hands) {
        ctx.strokeStyle = '#5eead4';
        for (const bone of BONES) {
          ctx.beginPath();
          bone.forEach((i, k) => {
            const [x, y] = map(hand.landmarks[i].x, hand.landmarks[i].y);
            if (k === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();
        }
        ctx.fillStyle = '#ffffff';
        for (const p of hand.landmarks) {
          const [x, y] = map(p.x, p.y);
          ctx.beginPath();
          ctx.arc(x, y, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };
    draw();
    return visionStore.subscribe(draw);
  }, []);
  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
