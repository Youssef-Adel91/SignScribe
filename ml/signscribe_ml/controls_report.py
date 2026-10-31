"""What the controls do next to the letters: confusion between controls and letters, and false triggers from 'none' takes.

STATIC controls (hand shapes) are classes of the letter model, so they come out of the same leave-one-person-out predictions as the
letters. DYNAMIC controls (strokes of the index fingertip) are matched with $1: they are evaluated leave-one-person-out on the dynamic
takes, and false triggers are counted by running every 'none' take's fingertip path through the same recogniser, with the gate the app
uses (a minimum duration and path length), so a relaxed hand that hardly moves cannot "match".

Counts and shares only: never a person id, never a per-person result. Nothing here is an accuracy claim about real use."""
from __future__ import annotations

import math

import numpy as np

from . import dollar, motion
from .alphabet import REJECT_LABEL, Alphabet
from .dataset import Take
from .folds import make_groups

# the gate of the app (src/recognition/letterController.ts LETTER.motionMinMs / motionMinLength)
MIN_MS = 300
MIN_LENGTH_PALM = 0.8


def _share(n, d):
    return None if d == 0 else n / d


def static_report(o: dict, alphabet: Alphabet, min_conf: float) -> dict | None:
    """o: one model's raw held-out predictions (truth / pred / conf per frame). None when the alphabet has no static control."""
    ctl = [c for c in alphabet.controls if alphabet.control_kind(c) == "static"]
    if not ctl:
        return None
    t, p, c = np.asarray(o["truth"]), np.asarray(o["pred"]), np.asarray(o["conf"], dtype=float)
    ctl_set = set(ctl)
    is_ctl_t = np.isin(t, ctl)
    is_ctl_p = np.isin(p, ctl)
    is_none_t = t == REJECT_LABEL
    is_letter_t = ~is_ctl_t & ~is_none_t
    shown = c >= min_conf
    per = {}
    for k in ctl:
        m = t == k
        n = int(m.sum())
        per[k] = {
            "action": alphabet.controls[k],
            "frames": n,
            "recall": _share(int((m & (p == k)).sum()), n),
            "recall_shown": _share(int((m & (p == k) & shown).sum()), n),
            "as_other_control": _share(int((m & is_ctl_p & (p != k)).sum()), n),
            "as_letter": _share(int((m & ~is_ctl_p & (p != REJECT_LABEL)).sum()), n),
            "as_none": _share(int((m & (p == REJECT_LABEL)).sum()), n),
        }
    n_letters, n_none = int(is_letter_t.sum()), int(is_none_t.sum())
    false_on_letters = {k: _share(int((is_letter_t & (p == k) & shown).sum()), n_letters) for k in ctl}
    false_on_none = {k: _share(int((is_none_t & (p == k) & shown).sum()), n_none) for k in ctl}
    return {
        "min_confidence": min_conf,
        "controls": per,
        "letter_frames": n_letters,
        "letters_shown_as_a_control": _share(int((is_letter_t & is_ctl_p & shown).sum()), n_letters),
        "false_control_on_letters": false_on_letters,
        "none_frames": n_none,
        "none_shown_as_a_control": _share(int((is_none_t & is_ctl_p & shown).sum()), n_none),
        "false_control_on_none": false_on_none,
        "none_shown_as_a_letter": _share(int((is_none_t & ~is_ctl_p & (p != REJECT_LABEL) & shown).sum()), n_none),
    }


def _palm_px(t: Take) -> float:
    lm = t.frames[0][1]
    return math.hypot((lm[9][0] - lm[0][0]) * t.width, (lm[9][1] - lm[0][1]) * t.height)


def dynamic_report(takes: list[Take], alphabet: Alphabet, landmark: int = 8, min_score: float = 0.6) -> dict | None:
    """$1 on the dynamic takes, leave-one-person-out, plus false triggers from 'none' takes. None when no dynamic control exists."""
    ctl = [c for c in alphabet.controls if alphabet.control_kind(c) == "dynamic"]
    if not ctl:
        return None
    dyn = motion.dynamic_takes(takes)
    out: dict = {"landmark": landmark, "min_score": min_score, "controls": {}}
    if len(dyn) >= 2 and not make_groups(dyn, "dynamic")[2]:
        # one person / source / signer / session: the only split would put the same person on both sides, which says nothing about new people
        return {**out, "not_evaluated": "there is only one person (or source, signer, session) among the dynamic takes, so a person cannot be left out"}
    try:
        ev = motion.evaluate(dyn, landmark)
    except ValueError as e:
        return {**out, "not_evaluated": str(e)}
    t, p, s = np.asarray(ev["truth"]), np.asarray(ev["pred"]), np.asarray(ev["conf"], dtype=float)
    ctl_p = np.isin(p, ctl)
    for k in ctl:
        m = t == k
        n = int(m.sum())
        out["controls"][k] = {
            "action": alphabet.controls[k],
            "takes": n,
            "recall": _share(int((m & (p == k)).sum()), n),
            "recall_shown": _share(int((m & (p == k) & (s >= min_score)).sum()), n),
            "as_other_control": _share(int((m & ctl_p & (p != k)).sum()), n),
            "as_other": _share(int((m & ~ctl_p).sum()), n),
        }
    out["method"] = ev["method"]
    out["groups"] = ev["groups"]
    # false triggers: every 'none' take (and every static LETTER take) as a path through the same templates
    templates = [(x.label, motion.take_path(x, landmark)) for x in dyn]
    ctl_set = set(ctl)
    for name, picked in (("none", [x for x in takes if x.label == REJECT_LABEL]), ("letters", [x for x in takes if x.kind == "static" and x.label not in alphabet.controls and x.label != REJECT_LABEL])):
        gated, hits = 0, {k: 0 for k in ctl}
        for x in picked:
            if len(x.frames) < 2:
                continue
            path = motion.take_path(x, landmark)
            dur = x.frames[-1][0] - x.frames[0][0]
            length = sum(math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]) for i in range(1, len(path)))
            palm = _palm_px(x)
            if dur < MIN_MS or palm <= 0 or length / palm < MIN_LENGTH_PALM:
                continue  # the app would not even try to match this path
            gated += 1
            lab, sc = dollar.recognize(path, templates)
            if lab in ctl_set and sc >= min_score:
                hits[lab] += 1
        out[f"{name}_takes"] = len(picked)
        out[f"{name}_passed_the_gate"] = gated
        out[f"{name}_triggered"] = hits
    return out


def _pct(x):
    return "n/a" if x is None else f"{x * 100:.1f}%"


def markdown(static_by_model: dict, dyn: dict | None) -> str:
    L = ["### Controls", ""]
    if not static_by_model and not dyn:
        return ""
    for model, r in static_by_model.items():
        if not r:
            continue
        L += [
            f"#### Static controls, {model} (hand shapes classified like letters; a prediction counts as shown at confidence >= {r['min_confidence']})",
            "",
            "| control | action | frames | recall | recall shown | taken for another control | taken for a letter | taken for none |",
            "| --- | --- | --- | --- | --- | --- | --- | --- |",
        ]
        for k, v in r["controls"].items():
            L.append(f"| {k} | {v['action']} | {v['frames']} | {_pct(v['recall'])} | {_pct(v['recall_shown'])} | {_pct(v['as_other_control'])} | {_pct(v['as_letter'])} | {_pct(v['as_none'])} |")
        L += [
            "",
            f"- letter frames shown as a control (false control): {_pct(r['letters_shown_as_a_control'])} of {r['letter_frames']} (" + ", ".join(f"{k} {_pct(v)}" for k, v in r["false_control_on_letters"].items()) + ")",
            f"- **'none' frames shown as a control (false trigger): {_pct(r['none_shown_as_a_control'])} of {r['none_frames']}** (" + ", ".join(f"{k} {_pct(v)}" for k, v in r["false_control_on_none"].items()) + ")",
            f"- 'none' frames shown as a letter: {_pct(r['none_shown_as_a_letter'])}",
            "",
        ]
    if dyn:
        L += [f"#### Dynamic controls ($1 on the path of landmark {dyn['landmark']}, a match counts at score >= {dyn['min_score']})", ""]
        if "not_evaluated" in dyn:
            L += [f"Not evaluated: {dyn['not_evaluated']}", ""]
        else:
            L += [
                f"Method: {dyn['method']} over {dyn['groups']} groups; every take is matched against templates of the other groups only.",
                "",
                "| control | action | takes | recall | recall shown | taken for another control | taken for something else |",
                "| --- | --- | --- | --- | --- | --- | --- |",
            ]
            for k, v in dyn["controls"].items():
                L.append(f"| {k} | {v['action']} | {v['takes']} | {_pct(v['recall'])} | {_pct(v['recall_shown'])} | {_pct(v['as_other_control'])} | {_pct(v['as_other'])} |")
            L.append("")
            for name, what in (("none", "'none' takes"), ("letters", "static letter takes")):
                if f"{name}_takes" in dyn:
                    trig = ", ".join(f"{k} {n}" for k, n in dyn[f"{name}_triggered"].items())
                    L.append(f"- {what}: {dyn[f'{name}_takes']} takes, {dyn[f'{name}_passed_the_gate']} long and moving enough for the app to try them, triggered a control: {trig} (templates from all dynamic takes; these takes are never templates)")
            L.append("")
    L += ["Counts and shares only; no result for any person. Not a claim about real use: it is what this recording set shows.", ""]
    return "\n".join(L)
