"""$P point-cloud recognizer (the algorithm of dollarpy 0.1.1). Must match src/recognition/dollarP.ts."""
from __future__ import annotations

import math

N_POINTS = 32
EPSILON = 0.5


def _dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _path_length(p):
    return sum(_dist(p[i - 1], p[i]) for i in range(1, len(p)))


def resample(points, n=N_POINTS):
    pts = [tuple(p) for p in points]
    interval = _path_length(pts) / (n - 1)
    acc = 0.0
    out = [pts[0]]
    i = 1
    while i < len(pts):
        d = _dist(pts[i - 1], pts[i])
        if acc + d >= interval and d > 0:
            t = (interval - acc) / d
            q = (pts[i - 1][0] + t * (pts[i][0] - pts[i - 1][0]), pts[i - 1][1] + t * (pts[i][1] - pts[i - 1][1]))
            out.append(q)
            pts.insert(i, q)
            acc = 0.0
        else:
            acc += d
        i += 1
    if len(out) == n - 1:
        out.append(pts[-1])
    return out


def scale_to_unit(p):
    xs = [q[0] for q in p]
    ys = [q[1] for q in p]
    s = max(max(xs) - min(xs), max(ys) - min(ys))
    k = s if s > 0 else 1.0
    return [((q[0] - min(xs)) / k, (q[1] - min(ys)) / k) for q in p]


def to_origin(p):
    cx = sum(q[0] for q in p) / len(p)
    cy = sum(q[1] for q in p) / len(p)
    return [(q[0] - cx, q[1] - cy) for q in p]


def normalize(points, n=N_POINTS):
    return to_origin(scale_to_unit(resample(points, n)))


def _cloud_distance(a, b, n, start):
    matched = [False] * n
    total = 0.0
    i = start
    while True:
        best, idx = math.inf, -1
        for j in range(n):
            if matched[j]:
                continue
            d = _dist(a[i], b[j])
            if d < best:
                best, idx = d, j
        matched[idx] = True
        weight = 1 - ((i - start + n) % n) / n
        total += weight * best
        i = (i + 1) % n
        if i == start:
            break
    return total


def greedy_cloud_match(a, b, n=N_POINTS):
    step = int(math.floor(n ** (1 - EPSILON)))
    best = math.inf
    for i in range(0, n, step):
        best = min(best, _cloud_distance(a, b, n, i), _cloud_distance(b, a, n, i))
    return best


def score_from_distance(d):
    return max((2 - d) / 2, 0.0)


def recognize(path, templates, n=N_POINTS):
    """templates: list of (label, points). Returns (label, score) or (None, 0.0)."""
    if len(path) < 2 or _path_length(path) <= 1e-9:
        return None, 0.0
    pts = normalize(path, n)
    best, label = math.inf, None
    for name, tp in templates:
        d = greedy_cloud_match(pts, normalize(tp, n), n)
        if d < best:
            best, label = d, name
    score = score_from_distance(best)
    return (None, 0.0) if label is None or score == 0 else (label, score)
