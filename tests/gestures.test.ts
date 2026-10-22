import { describe, expect, it } from 'vitest';
import { GestureStabilizer, classify } from '../src/vision/gestures';
import { makeHand, type Pose } from '../src/vision/testing/fixtures';
import { fingerExtension, thumbExtension, thumbVertical } from '../src/vision/landmarks';

const W = 1280;
const H = 720;
const label = (pose: Pose, o = {}) => classify(makeHand(pose, o), W, H).label;

describe('synthetic fixtures behave like the anatomy they describe', () => {
  it('open hand has all four fingers extended and a straight-up hand', () => {
    const h = makeHand('open');
    for (const f of ['index', 'middle', 'ring', 'pinky'] as const)
      expect(fingerExtension(h, f, W, H)).toBeGreaterThan(0.95);
  });
  it('fist has no extended finger', () => {
    const h = makeHand('fist');
    for (const f of ['index', 'middle', 'ring', 'pinky'] as const)
      expect(fingerExtension(h, f, W, H)).toBeLessThan(0.05);
    expect(thumbExtension(h, W, H)).toBeLessThan(0.3);
  });
  it('thumbs up points the thumb up and thumbs down points it down', () => {
    expect(thumbVertical(makeHand('thumbsUp'), W, H)).toBeGreaterThan(0.9);
    expect(thumbVertical(makeHand('thumbsDown'), W, H)).toBeLessThan(-0.9);
  });
});

describe('classify: the six gestures', () => {
  it.each([
    ['open', 'open'],
    ['fist', 'fist'],
    ['thumbsUp', 'up'],
    ['thumbsDown', 'down'],
    ['point', 'point'],
  ] as const)('%s is read as %s', (pose, expected) => {
    expect(label(pose)).toBe(expected);
  });

  it('confidence is high for clear poses', () => {
    for (const pose of ['open', 'fist', 'thumbsUp', 'thumbsDown', 'point'] as const)
      expect(classify(makeHand(pose), W, H).confidence).toBeGreaterThan(0.85);
  });

  it('works for left hands, other sizes and other positions', () => {
    for (const handedness of ['Left', 'Right'] as const)
      for (const size of [0.12, 0.22, 0.4])
        for (const [cx, cy] of [
          [0.2, 0.3],
          [0.5, 0.5],
          [0.8, 0.7],
        ]) {
          const o = { handedness, size, cx, cy };
          expect(label('open', o)).toBe('open');
          expect(label('fist', o)).toBe('fist');
          expect(label('thumbsUp', o)).toBe('up');
          expect(label('thumbsDown', o)).toBe('down');
          expect(label('point', o)).toBe('point');
        }
  });

  it('open palm, fist and pointing do not depend on how the hand is rotated', () => {
    for (const rot of [-40, -20, 0, 20, 40, 90, 180]) {
      expect(label('open', { rot })).toBe('open');
      expect(label('fist', { rot })).toBe('fist');
      expect(label('point', { rot })).toBe('point');
    }
  });

  it('thumbs up and down tolerate a tilt of about 20 degrees', () => {
    for (const rot of [-20, -10, 10, 20]) {
      expect(label('thumbsUp', { rot })).toBe('up');
      expect(label('thumbsDown', { rot })).toBe('down');
    }
  });

  it('survives a few pixels of landmark noise', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const o = { jitterPx: 3, seed };
      expect(label('open', o)).toBe('open');
      expect(label('fist', o)).toBe('fist');
      expect(label('thumbsUp', o)).toBe('up');
      expect(label('thumbsDown', o)).toBe('down');
      expect(label('point', o)).toBe('point');
    }
  });
});

describe('classify: confusing pairs', () => {
  it('a fist with the thumb out to the side is a fist, not thumbs up', () => {
    expect(label('fistThumbSide')).toBe('fist');
  });
  it('thumbs up is not read as fist, and fist is not read as thumbs up', () => {
    expect(label('thumbsUp')).not.toBe('fist');
    expect(label('fist')).not.toBe('up');
  });
  it('thumbs up and thumbs down are never swapped', () => {
    for (const rot of [-25, -10, 0, 10, 25]) {
      expect(label('thumbsUp', { rot })).not.toBe('down');
      expect(label('thumbsDown', { rot })).not.toBe('up');
    }
  });
  it('a thumb pointing sideways is neither up nor down', () => {
    // thumbs-up pose turned by 90 degrees: the thumb now points sideways
    for (const rot of [90, -90]) {
      const l = label('thumbsUp', { rot });
      expect(l).not.toBe('up');
      expect(l).not.toBe('down');
    }
  });
  it('point is not open and open is not point', () => {
    expect(label('point')).not.toBe('open');
    expect(label('open')).not.toBe('point');
  });
  it('two fingers (peace) is not any command gesture', () => {
    expect(label('peace')).toBe('none');
  });
  it('a half-curled hand is not trusted as open, fist or point', () => {
    const l = label('halfCurl', { curl: 0.45 });
    expect(l).toBe('none');
  });
  it('a hand that is almost an open palm still reads as open, and almost a fist as fist', () => {
    expect(label('halfCurl', { curl: 0.05 })).toBe('open');
    expect(label('halfCurl', { curl: 0.97 })).toBe('fist');
  });
});

describe('GestureStabilizer (hysteresis)', () => {
  it('needs the new label for enterMs before switching', () => {
    const s = new GestureStabilizer(100, 200);
    expect(s.update('open', 0).label).toBe('none');
    expect(s.update('open', 60).label).toBe('none');
    expect(s.update('open', 110).label).toBe('open');
  });
  it('ignores a one-frame glitch inside a held gesture', () => {
    const s = new GestureStabilizer(100, 200);
    for (let t = 0; t <= 300; t += 33) s.update('fist', t);
    expect(s.value.label).toBe('fist');
    expect(s.update('none', 333).label).toBe('fist'); // glitch
    expect(s.update('fist', 366).label).toBe('fist');
    expect(s.update('none', 400).label).toBe('fist');
    expect(s.update('none', 480).label).toBe('fist');
  });
  it('drops to none only after exitMs of not seeing it', () => {
    const s = new GestureStabilizer(100, 200);
    for (let t = 0; t <= 300; t += 33) s.update('up', t);
    s.update('none', 400);
    expect(s.update('none', 550).label).toBe('up');
    expect(s.update('none', 610).label).toBe('none');
  });
  it('flickering between two labels never produces either of them', () => {
    const s = new GestureStabilizer(100, 200);
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) seen.add(s.update(i % 2 ? 'open' : 'fist', i * 33).label);
    expect(seen).toEqual(new Set(['none']));
  });
  it('keeps the original start time while a label is held', () => {
    const s = new GestureStabilizer(100, 200);
    for (let t = 0; t <= 500; t += 33) s.update('open', t);
    const since = s.value.since;
    s.update('open', 700);
    expect(s.value.since).toBe(since);
  });
});
