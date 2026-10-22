"""Generated takes for TESTING THE PIPELINE ONLY. Every take is marked synthetic=true.

Each letter gets a random base hand (21 landmarks); takes are noisy copies. This says nothing about
how well real signs can be told apart.
"""
from __future__ import annotations

import json
import math
import random


def base_hand(rng: random.Random):
    pts = [(0.5, 0.8, 0.0)]
    for i in range(1, 21):
        pts.append((0.5 + rng.uniform(-0.2, 0.2), 0.8 - rng.uniform(0.05, 0.5), rng.uniform(-0.05, 0.05)))
    pts[9] = (0.5, 0.55, 0.0)  # middle knuckle straight above the wrist: a usable scale
    return pts


def noisy(hand, rng, sigma):
    return [[x + rng.gauss(0, sigma), y + rng.gauss(0, sigma), z + rng.gauss(0, sigma / 2)] for x, y, z in hand]


def static_takes(labels="ABCDE", signers=("s1", "s2"), takes_per=4, frames=6, sigma=0.004, seed=1):
    rng = random.Random(seed)
    bases = {l: base_hand(rng) for l in labels}
    out = []
    for s in signers:
        for l in labels:
            for k in range(takes_per):
                out.append(
                    {
                        "v": 1, "id": f"{s}-{l}-{k}", "label": l, "kind": "static", "signer": s, "session": "a",
                        "hand": "right", "width": 640, "height": 480, "synthetic": True,
                        "frames": [{"t": f * 33, "lm": noisy(bases[l], rng, sigma)} for f in range(frames)],
                    }
                )
    return out


def path_for(letter, i, n=40):
    """J = hook (down then curve left), Z = zig-zag. Plain shapes, with a little wobble from the take index."""
    pts = []
    for s in range(n):
        t = s / (n - 1)
        if letter == "J":
            x, y = 0.5 - 0.25 * math.sin(t * math.pi / 1.2) * (t > 0.5), 0.2 + 0.6 * min(1, t * 1.6)
        else:
            seg = int(t * 3)
            u = t * 3 - seg
            corners = [(0.3, 0.3), (0.7, 0.3), (0.3, 0.7), (0.7, 0.7)]
            (x0, y0), (x1, y1) = corners[min(seg, 2)], corners[min(seg, 2) + 1]
            x, y = x0 + (x1 - x0) * u, y0 + (y1 - y0) * u
        pts.append((x + 0.004 * math.sin(i + s), y + 0.004 * math.cos(i * 2 + s)))
    return pts


def dynamic_takes(labels="JZ", signers=("s1", "s2"), takes_per=4, seed=2):
    rng = random.Random(seed)
    out = []
    for s in signers:
        for l in labels:
            for k in range(takes_per):
                frames = []
                for f, (px, py) in enumerate(path_for(l, k + rng.random())):
                    lm = [[0.5, 0.8, 0.0] for _ in range(21)]
                    lm[8] = [px, py, 0.0]
                    frames.append({"t": f * 33, "lm": lm})
                out.append(
                    {
                        "v": 1, "id": f"{s}-{l}-d{k}", "label": l, "kind": "dynamic", "signer": s, "session": "a",
                        "hand": "right", "width": 640, "height": 480, "synthetic": True, "frames": frames,
                    }
                )
    return out


def write_jsonl(path, takes):
    with open(path, "w", encoding="utf-8") as f:
        for t in takes:
            f.write(json.dumps(t) + "\n")
