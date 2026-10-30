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


# SIMULATED body: where each pose landmark rests (x, y) in the picture. The left side never moves; on the right side the
# shoulders and hips stay too, and the elbow, wrist, pinky and index follow the fingertip by a fraction (an arm moves less than the finger).
_REST = {
    "shoulders": ((0.35, 0.92), (0.65, 0.92)),
    "elbows": ((0.28, 0.80), (0.72, 0.78)),
    "wrists": ((0.30, 0.62), (0.62, 0.62)),
    "pinky": ((0.31, 0.58), (0.60, 0.50)),
    "index": ((0.29, 0.57), (0.58, 0.50)),
    "hips": ((0.40, 1.0), (0.60, 1.0)),
}
_FOLLOW = {"elbows": 0.1, "wrists": 0.3, "pinky": 0.5, "index": 0.8}


def pose_at(x: float, y: float, keys):
    """SIMULATED pose for a fingertip at (x, y)."""
    out = {}
    for k in keys:
        part, side = k.rsplit("_", 1)
        left, right = _REST[part]
        if side == "l" or part not in _FOLLOW:
            out[k] = left if side == "l" else right
        else:
            f = _FOLLOW[part]
            out[k] = (right[0] + (x - 0.5) * f, right[1] + (y - 0.5) * f)
    return out


def frames_with_pose(letter: str, keys, variant: float = 0.0, **kw):
    """Like frames(), plus the simulated pose: yields (t_ms, landmarks, width, height, pose)."""
    for t, lm, w, h in frames(letter, variant, **kw):
        yield t, lm, w, h, pose_at(lm[8][0], lm[8][1], keys)


def synthetic_templates(letters, per_letter: int = 4, pose_keys=()):
    """Templates for the demo, generated from the same shapes with a little variation. SYNTHETIC, labelled as such when saved.
    With pose_keys each template also carries a simulated pose (one entry per path point)."""
    from dollar_logic import Movement  # imported here: dollar_logic imports nothing from this file

    out = []
    for l in letters:
        for k in range(per_letter):
            path = Movement(shape(l, k + 0.5))
            if pose_keys:
                per_key = {key: [] for key in pose_keys}
                for x, y in path:
                    for key, v in pose_at(x, y, pose_keys).items():
                        per_key[key].append(v)
                path.pose = per_key
            out.append((l, path))
    return out
