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


@dataclass
class Segmenter:
    """Follows one fingertip and returns its path when one movement is over (a port of followMotion in the web app)."""

    cfg: dict = field(default_factory=lambda: dict(MOTION))
    trail: list = field(default_factory=list)  # (t_ms, x_px, y_px)
    moving: bool = False
    slow_since: float | None = None
    start_t: float = 0.0
    cooldown_until: float = -1e18

    def reset(self) -> None:
        self.trail, self.moving, self.slow_since = [], False, None

    def feed(self, t: float, landmarks, width: float, height: float):
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
        self.trail.append((t, x, y))
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
        pts = [(q[1], q[2]) for q in self.trail if self.start_t <= q[0] <= end_t]
        dur = end_t - self.start_t
        self.moving, self.slow_since = False, None
        length = sum(math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) for i in range(1, len(pts)))
        if dur < c["min_ms"] or length / ps < c["min_length"] or len(pts) < 2:
            return "idle", None
        self.cooldown_until = t + COOLDOWN_MS
        self.trail = []
        return "idle", [(px / width, py / height) for px, py in pts]


# ---------------------------------------------------------------- templates
def to_points(path) -> list:
    return [Point(float(x), float(y), 1) for x, y in path]


def save_templates(path, templates: list, alphabet_id: str, synthetic: bool = False) -> None:
    """templates: [(label, [(x, y), ...]), ...]. Picture units, so the file does not depend on the camera size."""
    Path(path).write_text(
        json.dumps(
            {
                "format": FORMAT,
                "version": 1,
                "alphabet": alphabet_id,
                "landmark": INDEX_TIP,
                "synthetic": synthetic,
                "templates": [{"label": l, "points": [[round(x, 5), round(y, 5)] for x, y in p]} for l, p in templates],
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
    if not isinstance(raw, dict) or raw.get("format") != FORMAT or raw.get("version") != 1:
        raise TemplateError(f"{p} is not a {FORMAT} file")
    if raw.get("synthetic") and not allow_synthetic:
        raise TemplateError("these templates are SYNTHETIC (generated shapes, not a person's movement); pass --synthetic-templates to use them for a demo")
    out = []
    for i, t in enumerate(raw.get("templates", [])):
        pts = t.get("points")
        if not isinstance(t.get("label"), str) or len(t["label"]) != 1 or not isinstance(pts, list) or len(pts) < 5 or any(len(q) != 2 for q in pts):
            raise TemplateError(f"templates[{i}] needs a one-letter label and at least 5 [x, y] points")
        out.append((t["label"], [(float(a), float(b)) for a, b in pts]))
    if not out:
        raise TemplateError("the file has no templates")
    return out, raw


def build_recognizer(templates: list) -> Recognizer:
    return Recognizer([Template(label, to_points(path)) for label, path in templates])


def classify(recognizer: Recognizer, path, min_score: float = MOTION["min_score"]):
    """(letter, score) or None when nothing matches well enough."""
    if len(path) < 5:
        return None
    name, score = recognizer.recognize(to_points(path))
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

    def feed(self, t_ms: float, landmarks, width: float, height: float):
        """Returns (state, result) where result is (letter, score) when a letter was recognised, 'unknown' when a movement did not match, else None."""
        state, path = self.segmenter.feed(t_ms, landmarks, width, height)
        if path is None:
            return state, None
        hit = classify(self.recognizer, path, self.min_score)
        return state, hit if hit else "unknown"
