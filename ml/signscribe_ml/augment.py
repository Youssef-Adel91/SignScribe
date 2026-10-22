"""Augmentation for hand landmarks that keeps the shape of the sign.

Only three things, each with a stated bound:
- rotate: the hand turned a little in the picture plane, about the wrist (at most ROT_MAX_DEG either way).
- scale: the x and y size of the hand changed independently by at most ASPECT_RANGE (a different camera aspect or tilt).
  A change of BOTH by the same factor does nothing, because the features divide by the hand size (tested).
- mirror: the other hand. Letters are the same sign with either hand, so a mirrored hand has the same label.
  Takes recorded with hand=left are already mirrored when features are made, so this matters for images
  where left and right hands are mixed and the hand is not known.
Augmentation is only ever applied to training data, never to the held-out group. Whether it helps is measured
by evaluate.py (--augment-ablation), never assumed.
"""
from __future__ import annotations

import math
import zlib
from dataclasses import dataclass

import numpy as np

from .dataset import Take
from .features import static_features

ROT_MAX_DEG = 15.0
ASPECT_RANGE = 0.08


@dataclass(frozen=True)
class AugmentConfig:
    rotate: bool = False
    scale: bool = False
    mirror: bool = False
    copies: int = 2

    @property
    def enabled(self) -> bool:
        return (self.rotate or self.scale or self.mirror) and self.copies > 0

    def describe(self) -> str:
        parts = [n for n, on in (("rotate", self.rotate), ("scale", self.scale), ("mirror", self.mirror)) if on]
        return "none" if not self.enabled else f"{'+'.join(parts)} x{self.copies} copies per frame"


def parse_augment(spec: str | None, copies: int = 2) -> AugmentConfig:
    if not spec or spec == "none":
        return AugmentConfig(copies=copies)
    names = {s.strip() for s in spec.split(",") if s.strip()}
    bad = names - {"rotate", "scale", "mirror", "all"}
    if bad:
        raise ValueError(f"unknown augmentation {sorted(bad)}; use rotate, scale, mirror, all or none")
    if "all" in names:
        names = {"rotate", "scale", "mirror"}
    return AugmentConfig("rotate" in names, "scale" in names, "mirror" in names, copies)


def rotate_landmarks(lm, width: float, height: float, deg: float):
    """Turn the hand `deg` degrees about the wrist, in pixel space (so a wide picture is not sheared)."""
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    wx, wy = lm[0][0] * width, lm[0][1] * height
    out = []
    for x, y, z in lm:
        dx, dy = x * width - wx, y * height - wy
        out.append([(wx + c * dx - s * dy) / width, (wy + s * dx + c * dy) / height, z])
    return out


def stretch_landmarks(lm, width: float, height: float, sx: float, sy: float):
    """Scale x by sx and y by sy about the wrist (depth z follows x, as MediaPipe measures it in picture widths)."""
    wx, wy, wz = lm[0][0], lm[0][1], lm[0][2]
    return [[wx + (x - wx) * sx, wy + (y - wy) * sy, wz + (z - wz) * sx] for x, y, z in lm]


def mirror_landmarks(lm):
    """The same hand seen in a mirror: x -> 1 - x."""
    return [[1.0 - x, y, z] for x, y, z in lm]


def augmented_features(lm, width: float, height: float, hand: str, rng: np.random.Generator, cfg: AugmentConfig):
    """One augmented 60-number feature vector for one frame, or None when the result is unusable."""
    cur = lm
    if cfg.rotate:
        cur = rotate_landmarks(cur, width, height, float(rng.uniform(-ROT_MAX_DEG, ROT_MAX_DEG)))
    if cfg.scale:
        cur = stretch_landmarks(cur, width, height, 1 + float(rng.uniform(-ASPECT_RANGE, ASPECT_RANGE)), 1 + float(rng.uniform(-ASPECT_RANGE, ASPECT_RANGE)))
    mirror_x = hand == "left"
    if cfg.mirror and rng.random() < 0.5:
        mirror_x = not mirror_x  # identical to mirror_landmarks(): tested
    return static_features(cur, width, height, mirror_x=mirror_x)


def augmented_samples(takes: list[Take], cfg: AugmentConfig, seed: int = 0):
    """Augmented rows for every static frame: X (n,60), labels, take index. Deterministic for a given seed."""
    X, y, tk = [], [], []
    if not cfg.enabled:
        return np.zeros((0, 60)), y, np.zeros(0, dtype=int)
    for ti, t in enumerate(takes):
        if t.kind != "static":
            continue
        rng = np.random.default_rng([seed, zlib.crc32(t.id.encode("utf-8"))])
        for _, lm in t.frames:
            for _ in range(cfg.copies):
                f = augmented_features(lm, t.width, t.height, t.hand, rng, cfg)
                if f is not None:
                    X.append(f)
                    y.append(t.label)
                    tk.append(ti)
    return (np.asarray(X, dtype=np.float64).reshape(-1, 60), y, np.asarray(tk, dtype=int))
