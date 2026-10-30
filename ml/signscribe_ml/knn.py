"""k-NN training, honest evaluation and export. No accuracy is ever typed by hand: report.py writes what is measured."""
from __future__ import annotations

import math
import random
from collections import defaultdict

import numpy as np

from .augment import AugmentConfig, augmented_samples
from .dataset import Take
from .folds import make_groups
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


def make_folds(takes: list[Take], kind: str = "static", group_by: str = "auto"):
    """Groups for cross-validation, and the name of the method. Never splits the frames of one take."""
    method, groups, _ = make_groups(takes, kind, group_by)
    return method, groups


def predict_batch(X_train, y_train, X_test, k, chunk: int = 256):
    """The same weighted vote as predict(), for many rows at once. Returns (best, share, second, share)."""
    X_train = np.asarray(X_train, dtype=np.float64)
    classes = sorted(set(y_train))
    ci = {c: i for i, c in enumerate(classes)}
    yi = np.asarray([ci[l] for l in y_train])
    kk = min(k, len(X_train))
    tn = (X_train**2).sum(axis=1)
    best, share, second, share2 = [], [], [], []
    for s in range(0, len(X_test), chunk):
        A = np.asarray(X_test[s : s + chunk], dtype=np.float64)
        d2 = np.maximum(tn[None, :] + (A**2).sum(axis=1)[:, None] - 2.0 * A @ X_train.T, 0.0)
        part = np.argpartition(d2, kk - 1, axis=1)[:, :kk] if kk < d2.shape[1] else np.tile(np.arange(d2.shape[1]), (len(A), 1))
        w = 1.0 / (np.sqrt(np.take_along_axis(d2, part, axis=1)) + EPS)
        votes = np.zeros((len(A), len(classes)))
        rows = np.repeat(np.arange(len(A)), kk)
        np.add.at(votes, (rows, yi[part].ravel()), w.ravel())
        votes /= votes.sum(axis=1, keepdims=True)
        order = np.argsort(-votes, axis=1, kind="stable")
        r = np.arange(len(A))
        f1 = order[:, 0]
        f2 = order[:, 1] if len(classes) > 1 else order[:, 0]
        best += [classes[i] for i in f1]
        share += list(votes[r, f1])
        second += [classes[i] if votes[j, i] > 0 else None for j, i in enumerate(f2)]
        share2 += list(votes[r, f2])
    return best, np.asarray(share), second, np.asarray(share2)


def evaluate(takes: list[Take], k: int, augment: AugmentConfig | None = None, seed: int = 0, group_by: str = "auto"):
    """Hold out one group at a time (person, source, signer or session). `augment` only touches the training side."""
    X, y, tk = build_samples(takes)
    method, take_groups, generalises = make_groups(takes, "static", group_by)
    groups = np.asarray([take_groups[i] for i in tk])
    aug = augmented_samples(takes, augment, seed) if augment and augment.enabled else None
    aug_groups = np.asarray([take_groups[i] for i in aug[2]]) if aug is not None and len(aug[2]) else None
    truth, pred, conf, held = [], [], [], []
    for g in sorted(set(groups)):
        test = groups == g
        train = ~test
        if not train.any():
            continue
        Xtr, ytr = X[train], [y[i] for i in np.where(train)[0]]
        if aug is not None and aug_groups is not None:
            keep = aug_groups != g
            Xtr = np.vstack([Xtr, aug[0][keep]])
            ytr = ytr + [aug[1][i] for i in np.where(keep)[0]]
        idx = np.where(test)[0]
        lab, c, _, _ = predict_batch(Xtr, ytr, X[idx], k)
        truth += [y[i] for i in idx]
        pred += lab
        conf += list(c)
        held += [g] * len(idx)
    return {"method": method, "generalises": generalises, "truth": truth, "pred": pred, "conf": conf, "groups_of": held, "k": k, "groups": len(set(groups))}


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


def export_model(takes: list[Take], k: int, max_per_class: int, sha: str, evaluation, synthetic: bool, augment: AugmentConfig | None = None, seed: int = 0) -> dict:
    import datetime

    X, y, _ = build_samples(takes)
    if augment and augment.enabled:
        ax, ay, _ = augmented_samples(takes, augment, seed)
        X, y = np.vstack([X, ax]), y + ay
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
