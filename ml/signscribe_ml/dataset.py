"""Reading and checking the dataset written by the collection mode (docs/DATASET.md)."""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

from .alphabet import load_alphabet


class DatasetError(ValueError):
    pass


@dataclass
class Take:
    id: str
    label: str
    kind: str  # "static" | "dynamic"
    signer: str
    session: str
    hand: str  # signing hand setting when recorded: "left" | "right"
    width: float
    height: float
    synthetic: bool
    frames: list  # list of (t_ms, landmarks[21][3])
    # who the images/takes came from, when the dataset says: `person` (a human) or else `source` (a recording, folder or
    # sub-dataset). Used to hold whole groups out when testing. None when the dataset does not say.
    person: str | None = None
    source: str | None = None
    # True when the person was under 18 (set by the importer from an age in the file name; the age itself is never stored).
    # Used only so that evaluation can report such persons as counts and never show a result for one of them.
    minor: bool | None = None


def _check(cond, msg, line):
    if not cond:
        raise DatasetError(f"line {line}: {msg}")


def parse_take(raw: dict, line: int = 0, labels=None) -> Take:
    """labels: the allowed labels (default: the active alphabet in config/)."""
    if labels is None:
        labels = load_alphabet().labels
    _check(raw.get("v") == 1, "unsupported or missing version 'v' (expected 1)", line)
    for key in ("id", "label", "kind", "signer", "session", "hand", "width", "height", "frames"):
        _check(key in raw, f"missing field '{key}'", line)
    _check(raw["kind"] in ("static", "dynamic"), "kind must be 'static' or 'dynamic'", line)
    _check(raw["hand"] in ("left", "right"), "hand must be 'left' or 'right'", line)
    _check(
        isinstance(raw["label"], str) and raw["label"] in labels,
        f"label must be one letter of the alphabet ({' '.join(labels)})",
        line,
    )
    _check("minor" not in raw or isinstance(raw["minor"], bool), "'minor' must be true or false", line)
    for opt in ("person", "source"):
        _check(opt not in raw or (isinstance(raw[opt], str) and raw[opt].strip() != ""), f"'{opt}' must be a non-empty string", line)
    _check(raw["width"] > 0 and raw["height"] > 0, "width and height must be positive", line)
    frames = []
    _check(isinstance(raw["frames"], list) and len(raw["frames"]) >= 1, "a take needs at least one frame", line)
    if raw["kind"] == "dynamic":
        _check(len(raw["frames"]) >= 5, "a dynamic take needs at least 5 frames", line)
    last_t = None
    for f in raw["frames"]:
        lm = f.get("lm")
        _check(isinstance(lm, list) and len(lm) == 21, "every frame needs 21 landmarks 'lm'", line)
        for p in lm:
            _check(len(p) == 3 and all(isinstance(v, (int, float)) for v in p), "a landmark must be [x, y, z]", line)
        t = f.get("t", 0)
        _check(last_t is None or t >= last_t, "frame times must not go backwards", line)
        last_t = t
        frames.append((t, lm))
    return Take(
        id=str(raw["id"]), label=raw["label"], kind=raw["kind"], signer=str(raw["signer"]),
        session=str(raw["session"]), hand=raw["hand"], width=float(raw["width"]), height=float(raw["height"]),
        synthetic=bool(raw.get("synthetic", False)), frames=frames,
        person=raw.get("person"), source=raw.get("source"), minor=raw.get("minor"),
    )


def read_takes(path: str | Path, labels=None) -> tuple[list[Take], str]:
    """Returns the takes and the sha256 of the file (so a model names the exact data it came from)."""
    if labels is None:
        labels = load_alphabet().labels
    data = Path(path).read_bytes()
    takes = []
    for n, line in enumerate(data.decode("utf-8").splitlines(), 1):
        if not line.strip():
            continue
        try:
            raw = json.loads(line)
        except json.JSONDecodeError as e:
            raise DatasetError(f"line {n}: not valid JSON ({e.msg})") from e
        takes.append(parse_take(raw, n, labels))
    if not takes:
        raise DatasetError("the file has no takes")
    ids = [t.id for t in takes]
    if len(set(ids)) != len(ids):
        raise DatasetError("two takes share the same id")
    return takes, hashlib.sha256(data).hexdigest()


def summary(takes: list[Take]) -> dict:
    labels: dict[str, int] = {}
    for t in takes:
        labels[t.label] = labels.get(t.label, 0) + 1
    return {
        "takes": len(takes),
        "signers": len({t.signer for t in takes}),
        "persons": len({t.person for t in takes if t.person}),
        "sources": len({t.source for t in takes if t.source}),
        "sessions": len({(t.signer, t.session) for t in takes}),
        "synthetic": any(t.synthetic for t in takes),
        "per_label": dict(sorted(labels.items())),
    }
