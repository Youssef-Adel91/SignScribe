"""Confidence calibration: for several thresholds, how many of the predictions a recogniser would SHOW (coverage) and how many
of those are right (precision). Computed from held-out predictions only (leave-one-person-out or train/test). Each model has its
own table: the k-NN's confidence is a vote share, the MLP's is a softmax probability, so one number means different things.

Nothing here chooses a threshold. It prints what each candidate would do on the held-out data."""
from __future__ import annotations

import math

import numpy as np

DEFAULT_THRESHOLDS = (0.0, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99)


class CalibrationError(ValueError):
    pass


def wilson(correct: int, n: int, z: float = 1.96) -> tuple[float, float] | None:
    """95% interval of a proportion; None when nothing was shown."""
    if n == 0:
        return None
    p = correct / n
    d = 1 + z * z / n
    centre = (p + z * z / (2 * n)) / d
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return max(0.0, centre - half), min(1.0, centre + half)


def table(truth, pred, conf, thresholds=DEFAULT_THRESHOLDS) -> list[dict]:
    """One row per threshold: predictions with confidence >= threshold are 'shown'."""
    t, p, c = np.asarray(truth), np.asarray(pred), np.asarray(conf, dtype=float)
    if not (len(t) == len(p) == len(c)):
        raise CalibrationError("truth, pred and conf must have the same length")
    if len(t) == 0:
        raise CalibrationError("no held-out predictions")
    right = t == p
    total = len(t)
    rows = []
    for th in sorted(set(float(x) for x in thresholds)):
        shown = c >= th
        n = int(shown.sum())
        ok = int((right & shown).sum())
        ci = wilson(ok, n)
        rows.append(
            {
                "threshold": th,
                "shown": n,
                "coverage": n / total,
                "precision": (ok / n) if n else None,
                "precision_ci95": list(ci) if ci else None,
                "wrong_shown_per_100": 100.0 * (n - ok) / total,
            }
        )
    return rows


def build(res: dict, thresholds=DEFAULT_THRESHOLDS) -> dict:
    """{model: {"frames": n, "rows": [...]}} from the dict returned by evaluation.run / run_train_test. Group ids are never copied."""
    out = {}
    for name, o in res["models"].items():
        out[name] = {"frames": len(o["truth"]), "rows": table(o["truth"], o["pred"], o["conf"], thresholds)}
    return out


def _pct(x):
    return "-" if x is None else f"{x * 100:.1f}%"


def markdown(cal: dict, what: dict, kind: str) -> str:
    """kind: how the held-out predictions were made (a sentence). what: model name -> what its confidence is."""
    L = [f"Held-out predictions: {kind}.", ""]
    for name, d in cal.items():
        L += [
            f"### {name}: {d['frames']} held-out predictions",
            "",
            f"Confidence is {what.get(name, 'the model confidence')}. A prediction is *shown* when its confidence is at least the threshold.",
            "",
            "| threshold | shown | coverage | precision of shown (95% interval) | wrong shown per 100 predictions |",
            "| --- | --- | --- | --- | --- |",
        ]
        for r in d["rows"]:
            ci = r["precision_ci95"]
            ci_txt = f" ({ci[0] * 100:.1f}-{ci[1] * 100:.1f}%)" if ci else ""
            L.append(f"| {r['threshold']:.2f} | {r['shown']} | {_pct(r['coverage'])} | {_pct(r['precision'])}{ci_txt} | {r['wrong_shown_per_100']:.2f} |")
        L.append("")
    L += [
        "The two tables are not comparable row by row: a k-NN vote share and an MLP softmax probability are different scales.",
        "This report does not choose a threshold. `LETTER.minConfidence` / `confirmConfidence` in `src/recognition/letterController.ts` were set for the k-NN and are changed by hand, with a test, after reading the table of the model that will ship.",
        "",
    ]
    return "\n".join(L)
