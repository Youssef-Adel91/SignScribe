"""$P training/evaluation for signs that move. Templates are recorded paths of one landmark."""
from __future__ import annotations

import datetime
from collections import defaultdict

from . import dollar
from .dataset import Take
from .knn import make_folds


def take_path(t: Take, landmark: int):
    """x, y of one landmark over the take, in pixels (the aspect ratio matters for the shape)."""
    return [(lm[landmark][0] * t.width, lm[landmark][1] * t.height) for _, lm in t.frames]


def dynamic_takes(takes):
    return [t for t in takes if t.kind == "dynamic"]


def evaluate(takes: list[Take], landmark: int, n: int = dollar.N_POINTS):
    dyn = dynamic_takes(takes)
    if len(dyn) < 2:
        raise ValueError("need at least 2 dynamic takes to evaluate")
    method, groups = make_folds(dyn, "dynamic")
    truth, pred, score = [], [], []
    for g in sorted(set(groups)):
        test = [i for i, x in enumerate(groups) if x == g]
        train = [i for i, x in enumerate(groups) if x != g]
        if not train:
            continue
        templates = [(dyn[i].label, take_path(dyn[i], landmark)) for i in train]
        for i in test:
            lab, s = dollar.recognize(take_path(dyn[i], landmark), templates, n)
            truth.append(dyn[i].label)
            pred.append(lab)
            score.append(s)
    return {"method": method, "truth": truth, "pred": pred, "conf": score, "k": 1, "groups": len(set(groups))}


def export_model(takes: list[Take], landmark: int, max_per_label: int, sha: str, evaluation, synthetic: bool, n: int = dollar.N_POINTS):
    dyn = dynamic_takes(takes)
    per: dict = defaultdict(list)
    for t in dyn:
        if len(per[t.label]) < max_per_label:
            per[t.label].append(t)
    templates = []
    for label in sorted(per):
        for t in per[label]:
            pts = take_path(t, landmark)
            # store the path as recorded but resampled, so the file stays small and the browser re-normalises it
            templates.append({"label": label, "points": [[round(x, 3), round(y, 3)] for x, y in dollar.resample(pts, n)]})
    return {
        "format": "signscribe-model",
        "version": 1,
        "type": "dollarP",
        "landmark": landmark,
        "n": n,
        "templates": templates,
        "meta": {
            "trainedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
            "datasetSha256": sha,
            "takes": len(dyn),
            "signers": len({t.signer for t in dyn}),
            "synthetic": synthetic,
            "evaluation": evaluation,
        },
    }
