"""k-NN training, honest evaluation and export. No accuracy is ever typed by hand: report.py writes what is measured."""
from __future__ import annotations

import math
import random
from collections import defaultdict

import numpy as np

from .dataset import Take
from .features import FEATURES_ID, FEATURE_LENGTH, static_features

EPS = 1e-6


def build_samples(takes: list[Take]):
    """One row per usable frame of every static take. Returns X (n,60), labels, take index per row."""
    X, y, tk = [], [], []
    for ti, t in enumerate(takes):
        if t.kind != "static":
            continue
        for _, lm in t.frames:
            f = static_features(lm, t.width, t.height, mirror_x=(t.hand == "left"))
            if f is not None:
                X.append(f)
                y.append(t.label)
                tk.append(ti)
    if not X:
        raise ValueError("no static takes with usable frames")
    return np.asarray(X, dtype=np.float64), y, np.asarray(tk)


def predict(X_train, y_train, x, k):
    """Weighted vote, identical to src/recognition/knn.ts. Returns (label, confidence, ranked list)."""
    d = np.sqrt(((X_train - x) ** 2).sum(axis=1))
    idx = np.argsort(d, kind="stable")[:k]
    votes: dict = defaultdict(float)
    total = 0.0
    for i in idx:
        w = 1.0 / (d[i] + EPS)
        votes[y_train[i]] += w
        total += w
    ranked = sorted(votes.items(), key=lambda kv: -kv[1])
    return ranked[0][0], ranked[0][1] / total, [(l, v / total) for l, v in ranked]


def make_folds(takes: list[Take], kind: str = "static"):
    """Groups for cross-validation, and the name of the method. Never splits the frames of one take."""
    signers = sorted({t.signer for t in takes if t.kind == kind})
    sessions = sorted({(t.signer, t.session) for t in takes if t.kind == kind})
    if len(signers) >= 2:
        return "leave-one-signer-out", [t.signer for t in takes]
    if len(sessions) >= 2:
        return "leave-one-session-out", [f"{t.signer}/{t.session}" for t in takes]
    # one signer, one session: 5 folds over takes, assigned round-robin per label so every letter is in every fold
    seen: dict = defaultdict(int)
    groups = []
    for t in takes:
        groups.append(f"fold{seen[t.label] % 5}")
        seen[t.label] += 1
    return "5-fold over takes (one signer, one session: optimistic, do not quote as accuracy for new people)", groups


def evaluate(takes: list[Take], k: int):
    X, y, tk = build_samples(takes)
    method, take_groups = make_folds(takes)
    groups = np.asarray([take_groups[i] for i in tk])
    truth, pred, conf = [], [], []
    for g in sorted(set(groups)):
        test = groups == g
        train = ~test
        if not train.any():
            continue
        Xtr = X[train]
        ytr = [y[i] for i in np.where(train)[0]]
        for i in np.where(test)[0]:
            lab, c, _ = predict(Xtr, ytr, X[i], k)
            truth.append(y[i])
            pred.append(lab)
            conf.append(c)
    return {"method": method, "truth": truth, "pred": pred, "conf": conf, "k": k, "groups": len(set(groups))}


def metrics(ev: dict) -> dict:
    labels = sorted(set(ev["truth"]) | set(ev["pred"]))
    n = len(ev["truth"])
    correct = sum(1 for a, b in zip(ev["truth"], ev["pred"]) if a == b)
    per = {}
    for l in labels:
        tp = sum(1 for a, b in zip(ev["truth"], ev["pred"]) if a == l and b == l)
        fp = sum(1 for a, b in zip(ev["truth"], ev["pred"]) if a != l and b == l)
        fn = sum(1 for a, b in zip(ev["truth"], ev["pred"]) if a == l and b != l)
        per[l] = {
            "support": tp + fn,
            "precision": tp / (tp + fp) if tp + fp else None,
            "recall": tp / (tp + fn) if tp + fn else None,
        }
    confusions: dict = defaultdict(int)
    for a, b in zip(ev["truth"], ev["pred"]):
        if a != b:
            confusions[(a, b)] += 1
    return {
        "samples": n,
        "accuracy": correct / n if n else None,
        "per_label": per,
        "top_confusions": sorted(confusions.items(), key=lambda kv: -kv[1])[:10],
    }


def tune_k(takes: list[Take], candidates=(1, 3, 5, 7, 9)):
    """Picks k by the same cross-validation. The chosen value is optimistic by a little; the report says so."""
    scores = {}
    for k in candidates:
        m = metrics(evaluate(takes, k))
        scores[k] = m["accuracy"]
    best = max(scores, key=lambda k: (scores[k], -k))
    return best, scores


def subsample(X, y, max_per_class: int, seed: int = 0):
    rng = random.Random(seed)
    by: dict = defaultdict(list)
    for i, l in enumerate(y):
        by[l].append(i)
    keep = []
    for l in sorted(by):
        idx = by[l]
        if len(idx) > max_per_class:
            idx = sorted(rng.sample(idx, max_per_class))
        keep.extend(idx)
    keep.sort()
    return X[keep], [y[i] for i in keep]


def export_model(takes: list[Take], k: int, max_per_class: int, sha: str, evaluation, synthetic: bool) -> dict:
    import datetime

    X, y, _ = build_samples(takes)
    X, y = subsample(X, y, max_per_class)
    labels = sorted(set(y))
    index = {l: i for i, l in enumerate(labels)}
    return {
        "format": "signscribe-model",
        "version": 1,
        "type": "knn",
        "features": FEATURES_ID,
        "k": k,
        "labels": labels,
        "vectors": [[round(float(v), 4) for v in row] for row in X],
        "y": [index[l] for l in y],
        "meta": {
            "trainedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
            "datasetSha256": sha,
            "takes": len([t for t in takes if t.kind == "static"]),
            "signers": len({t.signer for t in takes if t.kind == "static"}),
            "synthetic": synthetic,
            "evaluation": evaluation,
        },
    }
