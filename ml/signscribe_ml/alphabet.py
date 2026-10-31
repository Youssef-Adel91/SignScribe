"""The label set (alphabet) lives in config/alphabets/*.json, never in code. config/alphabet.json says which one is active."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path

CONFIG_DIR = Path(__file__).resolve().parents[2] / "config"

# The class a model may have for "no letter": a hand that is moving, relaxed, or in the command zone. Not part of any alphabet file.
# A take with this label is static (src/config/alphabet.ts has the same constant); a model that predicts it is shown as nothing.
REJECT_LABEL = "none"
NONE_TAGS = ("moving", "relaxed", "command-zone", "other")
CONTROL_ACTIONS = ("space", "delete", "cancel", "done")  # the old name "finish" is read as "done"


class AlphabetError(ValueError):
    pass


@dataclass(frozen=True)
class Alphabet:
    id: str
    name: str
    static: tuple
    dynamic: tuple
    aliases: dict = field(default_factory=dict)
    reviewed: bool = True
    # label -> the letter to show a person (only where it is certain), and open questions the team still has to answer
    display: dict = field(default_factory=dict)
    todo: tuple = ()
    # control classes (class id -> action): commands given as classes, never letters. STATIC ones are in `static` (a hand shape,
    # classified like a letter), DYNAMIC ones in `dynamic` (a stroke of the index fingertip, matched with $1).
    controls: dict = field(default_factory=dict)

    @property
    def letters(self) -> list:
        return [l for l in self.labels if l not in self.controls]

    def control_kind(self, label: str):
        if label not in self.controls:
            return None
        return "static" if label in self.static else "dynamic"

    @property
    def labels(self) -> list:
        return list(self.static) + list(self.dynamic)

    def kind_of(self, label: str) -> str:
        return "dynamic" if label in self.dynamic else "static"

    def resolve(self, folder_name: str):
        """Folder (or class) name -> label, or None when it is not part of this alphabet.

        Order: exact label, then an alias from the config (case-insensitive), then a case-insensitive label match."""
        if folder_name in self.labels:
            return folder_name
        low = folder_name.strip().lower()
        for k, v in self.aliases.items():
            if k.strip().lower() == low and v in self.labels:
                return v
        for l in self.labels:
            if l.lower() == low:
                return l
        return None


def available(config_dir: Path = CONFIG_DIR) -> list:
    return sorted(p.stem for p in (config_dir / "alphabets").glob("*.json"))


def active_name(config_dir: Path = CONFIG_DIR) -> str:
    env = os.environ.get("SIGNSCRIBE_ALPHABET")
    if env:
        return env
    return json.loads((config_dir / "alphabet.json").read_text(encoding="utf-8"))["active"]


def _controls(raw, labels, name) -> dict:
    out = {}
    for cls, what in dict(raw).items():
        action = "done" if what == "finish" else what
        if cls not in labels:
            raise AlphabetError(f"alphabet '{name}': control class '{cls}' is not a label")
        if action not in CONTROL_ACTIONS:
            raise AlphabetError(f"alphabet '{name}': control '{what}' is not one of {', '.join(CONTROL_ACTIONS)}")
        if action in out.values():
            raise AlphabetError(f"alphabet '{name}': two classes do the control '{action}'")
        out[cls] = action
    return out


def load_alphabet(name: str | None = None, config_dir: Path = CONFIG_DIR) -> Alphabet:
    name = name or active_name(config_dir)
    p = config_dir / "alphabets" / f"{name}.json"
    if not p.exists():
        raise AlphabetError(f"no alphabet '{name}' (have: {', '.join(available(config_dir)) or 'none'})")
    raw = json.loads(p.read_text(encoding="utf-8"))
    static, dynamic = tuple(raw.get("static", [])), tuple(raw.get("dynamic", []))
    allv = list(static) + list(dynamic)
    if not allv:
        raise AlphabetError(f"alphabet '{name}' has no labels")
    if len(set(allv)) != len(allv):
        raise AlphabetError(f"alphabet '{name}' lists a label twice")
    # a label is one letter (ASL: "A") or a short name without spaces (ArSL21L: "ain"); the letter to show may differ (`display`)
    if any(not isinstance(l, str) or not 1 <= len(l) <= 16 or any(c.isspace() for c in l) for l in allv):
        raise AlphabetError(f"alphabet '{name}': every label must be 1 to 16 characters without spaces")
    return Alphabet(
        raw.get("id", name),
        raw.get("name", name),
        static,
        dynamic,
        dict(raw.get("aliases", {})),
        bool(raw.get("reviewed", True)),
        dict(raw.get("display", {})),
        tuple(raw.get("todo", [])),
        _controls(raw.get("controls", {}), allv, name),
    )
