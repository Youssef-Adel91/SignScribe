"""Honest evaluation of the static-letter recognisers: hold whole people (or sources) out, never random frames.

Every number in a report comes from here. The headline is only ever a leave-one-GROUP-out result; the same-person
fallback is refused unless asked for, and is then labelled as not generalising.
"""
from __future__ import annotations

import datetime
import hashlib
import platform
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

from . import knn
from .alphabet import Alphabet
from .augment import AugmentConfig, augmented_samples
from .dataset import Take, read_takes, summary
from .folds import FoldError, make_groups
from .mlp import MLP

# Mirrors LETTER.minConfidence in src/recognition/letterController.ts (tests/mlresults.test.ts checks they agree).
DEFAULT_MIN_CONFIDENCE = 0.6
THRESHOLDS = (0.5, 0.6, 0.7, 0.8, 0.9)


class EvaluationError(ValueError):
    pass


def read_many(paths, alphabet: Alphabet):
    """Several JSONL files as one dataset. The sha256 covers every file's own hash, in the order given."""
    takes, digests = [], []
    for p in paths:
        t, sha = read_takes(p, alphabet.labels)
        takes += t
        digests.append(sha)
    ids = [t.id for t in takes]
    if len(set(ids)) != len(ids):
        raise EvaluationError("two takes (possibly in different files) share the same id")
    sha = digests[0] if len(digests) == 1 else hashlib.sha256("".join(digests).encode()).hexdigest()
    return takes, sha


def _predict_knn(Xtr, ytr, Xte, k):
    best, share, second, share2 = knn.predict_batch(Xtr, ytr, Xte, k)
    return best, share, second, share2


def _predict_mlp(Xtr, ytr, Xte, seed):
    m = MLP(seed=seed).fit(Xtr, ytr)
    return m.predict(Xte), m.describe()


def run(takes: list[Take], models=("knn", "mlp"), k: int = 5, augment: AugmentConfig | None = None, seed: int = 0, group_by: str = "auto", allow_optimistic: bool = False):
    """Same folds for every model. Returns a plain dict (it is what gets written to the JSON report)."""
    X, y, tk = knn.build_samples(takes)
    method, take_groups, generalises = make_groups(takes, "static", group_by)
    if not generalises and not allow_optimistic:
        raise EvaluationError(
            "there is only one person/source/signer/session, so the only possible split would put the same person on both sides. "
            "That number says nothing about new people. Add data from more people (person or source field), or pass --allow-optimistic "
            "to see it labelled as optimistic."
        )
    groups = np.asarray([take_groups[i] for i in tk])
    aug = augmented_samples(takes, augment, seed) if augment and augment.enabled else None
    aug_groups = np.asarray([take_groups[i] for i in aug[2]]) if aug is not None and len(aug[2]) else None
    out = {m: {"truth": [], "pred": [], "conf": [], "second": [], "conf2": [], "group": []} for m in models}
    desc = {}
    for g in sorted(set(groups)):
        test = groups == g
        train = ~test
        if not train.any():
            continue
        Xtr, ytr = X[train], [y[i] for i in np.where(train)[0]]
        if aug_groups is not None:
            keep = aug_groups != g  # augmented copies of the held-out group never reach training
            Xtr = np.vstack([Xtr, aug[0][keep]])
            ytr = ytr + [aug[1][i] for i in np.where(keep)[0]]
        idx = np.where(test)[0]
        Xte = X[idx]
        for m in models:
            if m == "knn":
                p, c, p2, c2 = _predict_knn(Xtr, ytr, Xte, k)
                desc["knn"] = f"k-NN, k={k}, distance-weighted vote on the 60 hand features (same as the browser)"
            elif m == "mlp":
                (p, c, p2, c2), desc["mlp"] = _predict_mlp(Xtr, ytr, Xte, seed)
            else:
                raise EvaluationError(f"unknown model {m}")
            o = out[m]
            o["truth"] += [y[i] for i in idx]
            o["pred"] += list(p)
            o["conf"] += [float(v) for v in c]
            o["second"] += list(p2)
            o["conf2"] += [float(v) for v in c2]
            o["group"] += [g] * len(idx)
    labels = sorted(set(y))
    return {
        "method": method,
        "generalises": generalises,
        "groups": sorted(set(groups)),
        "group_sizes": {g: int((groups == g).sum()) for g in sorted(set(groups))},
        "labels": labels,
        "models": {m: {**out[m], "description": desc[m], "metrics": metrics(out[m], labels)} for m in models},
        "augment": augment.describe() if augment else "none",
        "k": k,
        "seed": seed,
    }


def metrics(o: dict, labels: list) -> dict:
    t, p, c, grp = o["truth"], o["pred"], np.asarray(o["conf"]), np.asarray(o["group"])
    n = len(t)
    correct = np.asarray([a == b for a, b in zip(t, p)])
    per_group = {g: float(correct[grp == g].mean()) for g in sorted(set(grp))}
    per = {}
    for l in labels:
        tp = sum(1 for a, b in zip(t, p) if a == l and b == l)
        fp = sum(1 for a, b in zip(t, p) if a != l and b == l)
        fn = sum(1 for a, b in zip(t, p) if a == l and b != l)
        per[l] = {"support": tp + fn, "precision": tp / (tp + fp) if tp + fp else None, "recall": tp / (tp + fn) if tp + fn else None}
    pairs: dict = defaultdict(int)
    for a, b in zip(t, p):
        if a != b:
            pairs[tuple(sorted((a, b)))] += 1
    worst = sorted(pairs.items(), key=lambda kv: (-kv[1], kv[0]))[:10]
    detail = {}
    for pair, cnt in worst:
        a, b = pair
        detail[f"{a}/{b}"] = {"total": cnt, f"{a}->{b}": sum(1 for x, y2 in zip(t, p) if x == a and y2 == b), f"{b}->{a}": sum(1 for x, y2 in zip(t, p) if x == b and y2 == a)}
    sel = {}
    for th in THRESHOLDS:
        acc = c >= th
        sel[th] = {"coverage": float(acc.mean()) if n else None, "accuracy_when_shown": float(correct[acc].mean()) if acc.any() else None}
    vals = list(per_group.values())
    recalls = [v["recall"] for v in per.values() if v["recall"] is not None]
    return {
        "samples": n,
        "pooled_accuracy": float(correct.mean()) if n else None,
        "mean_group_accuracy": float(np.mean(vals)) if vals else None,
        "min_group_accuracy": float(min(vals)) if vals else None,
        "max_group_accuracy": float(max(vals)) if vals else None,
        "per_group_accuracy": per_group,
        "macro_recall": float(np.mean(recalls)) if recalls else None,
        "per_label": per,
        "worst_pairs": detail,
        "selective": sel,
    }


def provenance(argv, dataset_name, dataset_version, sha, takes, alphabet):
    def git():
        try:
            return subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, cwd=Path(__file__).parent, timeout=5).stdout.strip() or None
        except Exception:
            return None

    s = summary(takes)
    return {
        "command": "python " + " ".join(argv),
        "date": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "dataset_name": dataset_name,
        "dataset_version": dataset_version,
        "dataset_sha256": sha,
        "alphabet": alphabet.id,
        "takes": s["takes"],
        "persons": s["persons"],
        "sources": s["sources"],
        "signers": s["signers"],
        "synthetic": s["synthetic"],
        "python": platform.python_version(),
        "numpy": np.__version__,
        "git_commit": git(),
    }


def pct(x):
    return "n/a" if x is None else f"{x * 100:.1f}%"


def markdown(res: dict, prov: dict, min_confidence: float = DEFAULT_MIN_CONFIDENCE) -> str:
    L = []
    L.append("### Static letters: leave-one-group-out evaluation" if res["generalises"] else "### Static letters: SAME-PERSON evaluation (optimistic)")
    L.append("")
    if prov["synthetic"]:
        L += ["> **SYNTHETIC DATA. This run only tests the pipeline. The numbers say nothing about real hands and must not be quoted.**", ""]
    if not res["generalises"]:
        L += ["> **NOT A RESULT FOR NEW PEOPLE.** Only one person/source/signer/session exists, so the same people are on both sides of the split. Do not quote these numbers.", ""]
    L += [
        f"- command: `{prov['command']}`",
        f"- date (UTC): {prov['date']}" + (f", git commit {prov['git_commit']}" if prov["git_commit"] else ""),
        f"- dataset: **{prov['dataset_name'] or '(not named)'}**, version **{prov['dataset_version'] or '(not given)'}**, sha256 `{prov['dataset_sha256']}`",
        f"- alphabet: {prov['alphabet']}; takes: {prov['takes']}; persons: {prov['persons']}, sources: {prov['sources']}, signers: {prov['signers']}",
        f"- split: **{res['method']}**, {len(res['groups'])} held-out groups, the same folds for every model",
        f"- augmentation (training side only): {res['augment']}",
        f"- python {prov['python']}, numpy {prov['numpy']}",
        "",
    ]
    names = list(res["models"])
    L += ["| model | description | samples | pooled accuracy | mean over held-out groups | worst group | best group | macro recall |", "| --- | --- | --- | --- | --- | --- | --- | --- |"]
    for n in names:
        m = res["models"][n]
        mm = m["metrics"]
        L.append(f"| {n} | {m['description']} | {mm['samples']} | {pct(mm['pooled_accuracy'])} | {pct(mm['mean_group_accuracy'])} | {pct(mm['min_group_accuracy'])} | {pct(mm['max_group_accuracy'])} | {pct(mm['macro_recall'])} |")
    L += ["", "Pooled = every held-out sample counted once (large groups weigh more). Mean over groups = each held-out person/source counts once.", ""]
    L += ["#### Per letter (precision / recall)", "", "| letter | support | " + " | ".join(f"{n} precision | {n} recall" for n in names) + " |", "| --- | --- | " + " | ".join("--- | ---" for _ in names) + " |"]
    for l in res["labels"]:
        row = [l, str(res["models"][names[0]]["metrics"]["per_label"][l]["support"])]
        for n in names:
            v = res["models"][n]["metrics"]["per_label"][l]
            row += [pct(v["precision"]), pct(v["recall"])]
        L.append("| " + " | ".join(row) + " |")
    for n in names:
        L += ["", f"#### {n}: the 10 worst letter pairs (errors in both directions)", ""]
        wp = res["models"][n]["metrics"]["worst_pairs"]
        L += [f"- {pair}: {d['total']} errors ({', '.join(f'{k} {v}' for k, v in d.items() if k != 'total')})" for pair, d in wp.items()] or ["- no errors"]
    L += ["", f"#### What the app would show (confidence at least the threshold; the browser's minimum is {min_confidence})", ""]
    L += ["| model | threshold | share of frames shown | accuracy of what is shown |", "| --- | --- | --- | --- |"]
    for n in names:
        for th, v in res["models"][n]["metrics"]["selective"].items():
            L.append(f"| {n} | {th} | {pct(v['coverage'])} | {pct(v['accuracy_when_shown'])} |")
    L += ["", "k-NN confidence is a vote share and the MLP's is a softmax probability: the two are not comparable, and only the k-NN reaches the browser.", ""]
    return "\n".join(L) + "\n"
