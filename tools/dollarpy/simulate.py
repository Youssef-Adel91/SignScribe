"""SIMULATED hand frames for demos and tests without a webcam. Nothing here is a person's movement.

The index fingertip follows a generated path (a hook for J, a zig-zag for Z); every other landmark stays put."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "ml"))
from signscribe_ml.synth import path_for  # noqa: E402

SIM_BANNER = "*** SIMULATED INPUT: generated paths, no webcam and no real hand ***"
SHAPES = ("J", "Z")
WIDTH, HEIGHT = 640, 480


def shape(letter: str, variant: float = 0.0, n: int = 40):
    if letter not in SHAPES:
        raise ValueError(f"no simulated shape for '{letter}' (only {', '.join(SHAPES)}); record real templates with record_templates.py")
    return path_for(letter, variant, n)


def hand_at(x: float, y: float):
    lm = [[0.5, 0.85, 0.0] for _ in range(21)]
    lm[9] = [0.5, 0.65, 0.0]  # middle-finger knuckle: palm length = 0.2 of the picture height
    lm[8] = [x, y, 0.0]
    return lm


def frames(letter: str, variant: float = 0.0, fps: int = 30, still_ms: int = 600, draw_ms: int = 1100):
    """Yields (t_ms, landmarks, width, height): hand still, one movement, hand still again."""
    dt = 1000 / fps
    path = shape(letter, variant)
    t = 0.0
    start = path[0]
    for _ in range(int(still_ms / dt)):
        yield t, hand_at(*start), WIDTH, HEIGHT
        t += dt
    steps = max(2, int(draw_ms / dt))
    for i in range(steps):
        x, y = path[min(len(path) - 1, int(i * len(path) / steps))]
        yield t, hand_at(x, y), WIDTH, HEIGHT
        t += dt
    end = path[-1]
    for _ in range(int(still_ms / dt)):
        yield t, hand_at(*end), WIDTH, HEIGHT
        t += dt


def synthetic_templates(letters, per_letter: int = 4):
    """Templates for the demo, generated from the same shapes with a little variation. SYNTHETIC, labelled as such when saved."""
    out = []
    for l in letters:
        for k in range(per_letter):
            out.append((l, shape(l, k + 0.5)))
    return out
