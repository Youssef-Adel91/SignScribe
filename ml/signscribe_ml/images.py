"""Turning a folder of labelled pictures (one sub-folder per letter) into takes of hand landmarks.

Pictures are read, run through MediaPipe and thrown away: only 21 landmarks per picture are kept, so the output has no faces.
"""
from __future__ import annotations

import datetime
import hashlib
import re
from dataclasses import dataclass, field
from pathlib import Path

from .alphabet import Alphabet

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


class ImageUnreadable(Exception):
    pass


@dataclass
class Detection:
    landmarks: list  # 21 x [x, y, z] normalised
    width: int
    height: int


@dataclass
class LetterCount:
    images: int = 0
    imported: int = 0
    no_hand: int = 0
    unreadable: int = 0


@dataclass
class ImportStats:
    per_letter: dict = field(default_factory=dict)
    ignored_folders: list = field(default_factory=list)
    dynamic_skipped: dict = field(default_factory=dict)
    no_person_id: int = 0
    persons: set = field(default_factory=set)

    def letter(self, l) -> LetterCount:
        return self.per_letter.setdefault(l, LetterCount())

    @property
    def images(self):
        return sum(c.images for c in self.per_letter.values())

    @property
    def no_hand(self):
        return sum(c.no_hand for c in self.per_letter.values())

    @property
    def imported(self):
        return sum(c.imported for c in self.per_letter.values())

    @property
    def unreadable(self):
        return sum(c.unreadable for c in self.per_letter.values())


class MediaPipeDetector:
    """MediaPipe Hand Landmarker (Python, tasks API) on single pictures. One hand: the most confident."""

    def __init__(self, model_path: str, min_confidence: float = 0.5):
        try:
            import mediapipe as mp
            from mediapipe.tasks import python as mpp
            from mediapipe.tasks.python import vision
        except (ImportError, OSError) as e:  # pragma: no cover - environment
            raise SystemExit(f"mediapipe cannot be loaded ({e}). Install it with: pip install -r ml/requirements-import.txt (on Linux it also needs libEGL: apt install libegl1 libgles2)") from e
        if not Path(model_path).exists():
            raise SystemExit(f"hand model not found: {model_path} (run `npm run models`, or download hand_landmarker.task)")
        self.mp = mp
        self.model_path = model_path
        self.min_confidence = min_confidence
        self._lm = vision.HandLandmarker.create_from_options(
            vision.HandLandmarkerOptions(
                base_options=mpp.BaseOptions(model_asset_path=model_path),
                running_mode=vision.RunningMode.IMAGE,
                num_hands=1,
                min_hand_detection_confidence=min_confidence,
                min_hand_presence_confidence=min_confidence,
            )
        )

    def close(self) -> None:
        self._lm.close()  # closing explicitly avoids a noisy error from MediaPipe at interpreter exit

    def describe(self) -> str:
        sha = hashlib.sha256(Path(self.model_path).read_bytes()).hexdigest()[:16]
        return f"mediapipe {self.mp.__version__}, model {Path(self.model_path).name} (sha256 {sha}...), min confidence {self.min_confidence}"

    def __call__(self, path: Path) -> Detection | None:
        try:
            img = self.mp.Image.create_from_file(str(path))
        except Exception as e:
            raise ImageUnreadable(str(e)) from e
        res = self._lm.detect(img)
        if not res.hand_landmarks:
            return None
        lm = [[float(p.x), float(p.y), float(p.z)] for p in res.hand_landmarks[0]]
        return Detection(lm, int(img.width), int(img.height))


def person_of(relpath: str, regex) -> str | None:
    if regex is None:
        return None
    m = regex.search(relpath)
    if not m:
        return None
    g = m.groupdict().get("person") if m.groupdict() else None
    return (g if g is not None else (m.group(1) if m.groups() else m.group(0))) or None


def import_folder(root: Path, alphabet: Alphabet, detect, source: str, hand: str = "right", person_regex: str | None = None, dataset_name: str = "", now: str | None = None):
    """Returns (takes as dicts, stats). `detect(path) -> Detection | None`, may raise ImageUnreadable."""
    root = Path(root)
    rx = re.compile(person_regex) if person_regex else None
    stats = ImportStats()
    takes = []
    now = now or datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    for folder in sorted(p for p in root.iterdir() if p.is_dir()):
        label = alphabet.resolve(folder.name)
        files = sorted(f for f in folder.rglob("*") if f.is_file() and f.suffix.lower() in IMAGE_SUFFIXES)
        if label is None:
            stats.ignored_folders.append((folder.name, len(files)))
            continue
        if alphabet.kind_of(label) == "dynamic":
            stats.dynamic_skipped[label] = stats.dynamic_skipped.get(label, 0) + len(files)
            continue
        c = stats.letter(label)
        for f in files:
            c.images += 1
            rel = f.relative_to(root).as_posix()
            try:
                d = detect(f)
            except ImageUnreadable:
                c.unreadable += 1
                continue
            if d is None:
                c.no_hand += 1
                continue
            person = person_of(rel, rx)
            if rx is not None and person is None:
                stats.no_person_id += 1
            if person:
                stats.persons.add(person)
            c.imported += 1
            take = {
                "v": 1,
                "id": hashlib.sha1(f"{dataset_name}|{source}|{rel}".encode("utf-8")).hexdigest()[:24],
                "label": label,
                "kind": "static",
                "signer": person or f"src-{source}",
                "session": source,
                "hand": hand,
                "width": d.width,
                "height": d.height,
                "createdAt": now,
                "frames": [{"t": 0, "lm": [[round(v, 5) for v in p] for p in d.landmarks]}],
                "source": source,
            }
            if person:
                take["person"] = person
            takes.append(take)
    return takes, stats


def report_markdown(stats: ImportStats, alphabet: Alphabet, meta: dict) -> str:
    L = ["# Image import report", ""]
    for k, v in meta.items():
        L.append(f"- {k}: {v}")
    L += ["", "| letter | images | imported | no hand found | unreadable |", "| --- | --- | --- | --- | --- |"]
    for l in alphabet.labels:
        c = stats.per_letter.get(l)
        if c is None:
            L.append(f"| {l} | 0 | 0 | 0 | 0 |")
        else:
            L.append(f"| {l} | {c.images} | {c.imported} | {c.no_hand} | {c.unreadable} |")
    pct = f"{stats.no_hand / stats.images * 100:.1f}%" if stats.images else "n/a"
    L += ["", f"**Total: {stats.images} images, {stats.imported} imported, {stats.no_hand} had no hand ({pct}), {stats.unreadable} unreadable.**", ""]
    missing = [l for l in alphabet.labels if l not in stats.per_letter or stats.per_letter[l].imported == 0]
    if missing:
        L.append(f"Letters with nothing imported: {' '.join(missing)}")
    if stats.ignored_folders:
        L.append("Folders ignored (name is not a letter of this alphabet; add it to `aliases` in the alphabet config if it is one): " + ", ".join(f"{n} ({c} files)" for n, c in stats.ignored_folders))
    if stats.dynamic_skipped:
        L.append("Moving letters not imported from pictures (record them in the collection mode): " + ", ".join(f"{l} ({c} files)" for l, c in stats.dynamic_skipped.items()))
    if stats.no_person_id:
        L.append(f"WARNING: {stats.no_person_id} imported pictures did not match --person-regex, so they have no `person`; leave-one-person-out needs every picture to have one.")
    if stats.persons:
        L.append(f"Persons found: {len(stats.persons)}")
    return "\n".join(L) + "\n"
