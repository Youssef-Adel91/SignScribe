"""Moving letters with DollarPy (the dollarpy package from Lab 5: Recognizer, Template, Point).

Everything here is plain Python without a camera: following one fingertip, cutting its path into one movement,
storing templates, classifying with dollarpy, and building the message for the sentence server. It is tested without
a webcam; the webcam parts are in hand_tracker.py, record_templates.py and classify_live.py.
"""
from __future__ import annotations

import json
import math
import sys
from dataclasses import dataclass, field
from pathlib import Path

try:
    from dollarpy import Point, Recognizer, Template
except ImportError as e:  # pragma: no cover - environment
    raise SystemExit("dollarpy is not installed: pip install -r tools/dollarpy/requirements.txt") from e

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "common"))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "ml"))
from server_link import ServerLink  # noqa: E402,F401
from signscribe_ml.alphabet import Alphabet, load_alphabet  # noqa: E402,F401

FORMAT = "signscribe-dollarpy-templates"
INDEX_TIP = 8  # MediaPipe hand landmark 8 = tip of the index finger
WRIST, MIDDLE_KNUCKLE = 0, 9

# MediaPipe Pose landmarks (left, right) for each body part. Lab 5's getPoints uses shoulders, elbows, wrists, pinky,
# index and hips; the default here is shoulders, elbows and wrists (the hands are tracked by the hand model, and hips
# are usually outside a desk webcam's picture). Any of the others can be named with --pose-parts.
POSE_PARTS = {
    "shoulders": (11, 12),
    "elbows": (13, 14),
    "wrists": (15, 16),
    "pinky": (17, 18),
    "index": (19, 20),
    "hips": (23, 24),
}
DEFAULT_POSE_PARTS = ("shoulders", "elbows", "wrists")
MIN_POSE_SHARE = 0.8  # a movement needs the whole pose in at least this share of its frames, else it is judged by the fingertip alone
POSE_VISIBILITY = 0.5


def pose_keys(parts) -> list:
    """Names of the pose landmarks in a fixed order, e.g. ['shoulders_l', 'shoulders_r', 'elbows_l', ...]."""
    unknown = [p for p in parts if p not in POSE_PARTS]
    if unknown:
        raise ValueError(f"unknown pose part {', '.join(unknown)}; choose from {', '.join(POSE_PARTS)}")
    return [f"{p}_{side}" for p in parts for side in ("l", "r")]


def pose_index(key: str) -> int:
    part, side = key.rsplit("_", 1)
    return POSE_PARTS[part][0 if side == "l" else 1]

# The same numbers as LETTER.motion* in src/recognition/letterController.ts (tests/test_dollarpy.py compares them),
# so the Python demo and the web app cut a movement out of a path in the same way.
MOTION = {
    "start_speed": 1.2,  # palm lengths per second: a movement starts above this
    "stop_speed": 0.5,  # ...and ends after it has been slower than this for end_ms
    "end_ms": 250,
    "min_ms": 300,  # shortest and longest movement that is tried
    "max_ms": 2000,
    "min_length": 0.8,  # palm lengths of path: shorter is a tremor, not a drawn letter
    "min_score": 0.6,  # dollarpy score needed to accept a letter
}
COOLDOWN_MS = 800


def palm_size(lm, width: float, height: float) -> float:
    """Wrist to middle-finger knuckle, in pixels: the unit for speeds and path lengths."""
    return math.hypot((lm[MIDDLE_KNUCKLE][0] - lm[WRIST][0]) * width, (lm[MIDDLE_KNUCKLE][1] - lm[WRIST][1]) * height)


class Movement(list):
    """The fingertip path of one movement: a list of (x, y) in 0..1 picture units. `.pose` maps each pose landmark name
    to its own (x, y) list, one entry per path point, or is None when the pose was not seen well enough."""

    pose: dict | None = None


@dataclass
class Segmenter:
    """Follows one fingertip and returns its path when one movement is over (a port of followMotion in the web app).

    With pose (a dict of landmark name -> (x, y) in 0..1, or None) the same frames of the shoulders, elbows and wrists are
    kept, so the movement carries the arm as well as the finger."""

    cfg: dict = field(default_factory=lambda: dict(MOTION))
    trail: list = field(default_factory=list)  # (t_ms, x_px, y_px, pose)
    moving: bool = False
    slow_since: float | None = None
    start_t: float = 0.0
    cooldown_until: float = -1e18

    def reset(self) -> None:
        self.trail, self.moving, self.slow_since = [], False, None

    def feed(self, t: float, landmarks, width: float, height: float, pose=None):
        """Returns (state, path). state: 'idle' | 'moving'. path: list of (x, y) in 0..1 picture units when a movement just ended."""
        if landmarks is None:
            self.reset()
            return "idle", None
        if t < self.cooldown_until:
            return "idle", None
        c = self.cfg
        ps = palm_size(landmarks, width, height) or 1.0
        x, y = landmarks[INDEX_TIP][0] * width, landmarks[INDEX_TIP][1] * height
        prev = self.trail[-1] if self.trail else None
        speed = math.hypot(x - prev[1], y - prev[2]) / ps / ((t - prev[0]) / 1000) if prev and t > prev[0] else 0.0
        self.trail.append((t, x, y, pose))
        while self.trail and t - self.trail[0][0] > c["max_ms"] + 500:
            self.trail.pop(0)
        if not self.moving:
            if speed >= c["start_speed"]:
                self.moving, self.slow_since = True, None
                self.start_t = prev[0] if prev else t
            return "idle", None
        if speed < c["stop_speed"]:
            if self.slow_since is None:
                self.slow_since = t
        else:
            self.slow_since = None
        ended = self.slow_since is not None and t - self.slow_since >= c["end_ms"]
        if not ended and t - self.start_t <= c["max_ms"]:
            return "moving", None
        end_t = self.slow_since if self.slow_since is not None else t
        window = [q for q in self.trail if self.start_t <= q[0] <= end_t]
        pts = [(q[1], q[2]) for q in window]
        dur = end_t - self.start_t
        self.moving, self.slow_since = False, None
        length = sum(math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) for i in range(1, len(pts)))
        if dur < c["min_ms"] or length / ps < c["min_length"] or len(pts) < 2:
            return "idle", None
        self.cooldown_until = t + COOLDOWN_MS
        self.trail = []
        move = Movement((px / width, py / height) for px, py in pts)
        move.pose = _pose_of(window)
        return "idle", move


def _pose_of(window):
    """Per-landmark lists aligned with the path, or None when the full pose is missing in too many frames."""
    full = [q[3] for q in window if q[3]]
    if not window or len(full) < MIN_POSE_SHARE * len(window):
        return None
    keys = list(full[0])
    out = {k: [] for k in keys}
    last = full[0]  # frames without the pose repeat the nearest earlier one (the first valid one at the start)
    for q in window:
        last = q[3] or last
        for k in keys:
            out[k].append(tuple(last[k]))
    return out


# ---------------------------------------------------------------- templates
def to_points(path) -> list:
    """The fingertip path as one stroke."""
    return [Point(float(x), float(y), 1) for x, y in path]


N_TIP = 32  # points of the fingertip stroke (dollarpy's own default)
N_POSE = 4  # points of each pose landmark's stroke: the arm gives the shape of the body, the fingertip stays the main signal


def time_resample(pts, m: int) -> list:
    """m points evenly spaced in TIME (by index) along a trajectory, so a landmark that hardly moves still gets its m points."""
    pts = list(pts)
    n = len(pts)
    out = []
    for i in range(m):
        f = i * (n - 1) / (m - 1)
        a = int(f)
        b = min(a + 1, n - 1)
        r = f - a
        out.append((pts[a][0] * (1 - r) + pts[b][0] * r, pts[a][1] * (1 - r) + pts[b][1] * r))
    return out


def to_cloud(path, pose: dict, keys) -> list:
    """The fingertip (stroke 1, N_TIP points) and every pose landmark (one stroke each, N_POSE points) as one point cloud."""
    pts = [Point(x, y, 1) for x, y in time_resample(path, N_TIP)]
    for sid, k in enumerate(keys, start=2):
        pts += [Point(x, y, sid) for x, y in time_resample(pose[k], N_POSE)]
    return pts


def cloud_size(keys) -> int:
    return N_TIP + N_POSE * len(keys)


def _r(pts):
    return [[round(x, 5), round(y, 5)] for x, y in pts]


def save_templates(path, templates: list, alphabet_id: str, synthetic: bool = False, pose_parts=()) -> None:
    """templates: [(label, path), ...] where path is a list of (x, y), or a Movement with `.pose`. Picture units, so the
    file does not depend on the camera size. `pose_parts` names the pose parts that were recorded (empty = fingertip only)."""
    keys = pose_keys(pose_parts) if pose_parts else []
    rows = []
    for l, p in templates:
        row = {"label": l, "points": _r(p)}
        pose = getattr(p, "pose", None)
        if keys and pose and all(k in pose for k in keys):
            row["pose"] = {k: _r(pose[k]) for k in keys}
        rows.append(row)
    Path(path).write_text(
        json.dumps(
            {
                "format": FORMAT,
                "version": 2,
                "alphabet": alphabet_id,
                "landmark": INDEX_TIP,
                "pose_parts": list(pose_parts) if keys else [],
                "synthetic": synthetic,
                "templates": rows,
            }
        ),
        encoding="utf-8",
    )


class TemplateError(ValueError):
    pass


def load_templates(path, allow_synthetic: bool = False):
    p = Path(path)
    if not p.exists():
        raise TemplateError(f"{p} not found. Record templates first: python tools/dollarpy/record_templates.py")
    try:
        raw = json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise TemplateError(f"{p}: not valid JSON ({e.msg})") from e
    if not isinstance(raw, dict) or raw.get("format") != FORMAT or raw.get("version") not in (1, 2):
        raise TemplateError(f"{p} is not a {FORMAT} file")
    if raw.get("synthetic") and not allow_synthetic:
        raise TemplateError("these templates are SYNTHETIC (generated shapes, not a person's movement); pass --synthetic-templates to use them for a demo")
    out = []
    for i, t in enumerate(raw.get("templates", [])):
        pts = t.get("points")
        if not isinstance(t.get("label"), str) or len(t["label"]) != 1 or not isinstance(pts, list) or len(pts) < 5 or any(len(q) != 2 for q in pts):
            raise TemplateError(f"templates[{i}] needs a one-letter label and at least 5 [x, y] points")
        mv = Movement((float(a), float(b)) for a, b in pts)
        pose = t.get("pose")
        if pose is not None:
            if not isinstance(pose, dict) or any(not isinstance(v, list) or len(v) != len(pts) or any(len(q) != 2 for q in v) for v in pose.values()):
                raise TemplateError(f"templates[{i}].pose must have one [x, y] per point for every landmark")
            mv.pose = {k: [(float(a), float(b)) for a, b in v] for k, v in pose.items()}
        out.append((t["label"], mv))
    if not out:
        raise TemplateError("the file has no templates")
    return out, raw


class PoseAwareRecognizer:
    """dollarpy's Recognizer, used on the fingertip path alone or, when the movement and every template carry the same
    pose landmarks, on the fingertip plus the pose of every frame. `used_pose` says which one the last call used."""

    def __init__(self, templates: list):
        self.templates = templates
        self.used_pose = False

    def _keys_for(self, movement):
        pose = getattr(movement, "pose", None)
        if not pose:
            return None
        keys = list(pose)
        for _, t in self.templates:
            tp = getattr(t, "pose", None)
            if not tp or any(k not in tp for k in keys):
                return None
        return keys

    def recognize(self, movement):
        keys = self._keys_for(movement)
        self.used_pose = keys is not None
        if keys:
            rec = Recognizer([Template(l, to_cloud(t, t.pose, keys)) for l, t in self.templates])
            return rec.recognize(to_cloud(movement, movement.pose, keys), n=cloud_size(keys))
        rec = Recognizer([Template(l, to_points(t)) for l, t in self.templates])
        return rec.recognize(to_points(movement))


def build_recognizer(templates: list) -> PoseAwareRecognizer:
    return PoseAwareRecognizer(templates)


def classify(recognizer, path, min_score: float = MOTION["min_score"]):
    """(letter, score) or None when nothing matches well enough."""
    if len(path) < 5:
        return None
    name, score = recognizer.recognize(path)
    if name is None or score < min_score:
        return None
    return name, float(score)


def letter_message(seq: int, letter: str, score: float, demo: bool) -> dict:
    """One JSON line for the sentence server (server/README.md, type 'letter')."""
    return {"id": f"l{seq}", "type": "letter", "letter": letter, "score": round(score, 4), "source": "dollarpy", "demo": demo}


@dataclass
class Pipeline:
    """Frames in, recognised letters out. Used by the webcam client and by --simulate."""

    recognizer: Recognizer
    min_score: float = MOTION["min_score"]
    segmenter: Segmenter = field(default_factory=Segmenter)

    def feed(self, t_ms: float, landmarks, width: float, height: float, pose=None):
        """Returns (state, result) where result is (letter, score) when a letter was recognised, 'unknown' when a movement did not match, else None."""
        state, path = self.segmenter.feed(t_ms, landmarks, width, height, pose)
        if path is None:
            return state, None
        hit = classify(self.recognizer, path, self.min_score)
        return state, hit if hit else "unknown"
