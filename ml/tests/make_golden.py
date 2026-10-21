"""Regenerates the golden files that the Python and the TypeScript tests both check. Run after changing features or $P."""
import json
import math
import random
import sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent))
from signscribe_ml import dollar  # noqa: E402
from signscribe_ml.features import static_features  # noqa: E402
from signscribe_ml.synth import base_hand, noisy, path_for  # noqa: E402


def features_golden():
    rng = random.Random(7)
    cases = []
    for i in range(6):
        lm = noisy(base_hand(rng), rng, 0.01)
        w, h = (640, 480) if i % 2 == 0 else (1280, 720)
        mirror = i >= 3
        cases.append({"landmarks": lm, "width": w, "height": h, "mirror": mirror, "expected": static_features(lm, w, h, mirror)})
    return {"cases": cases}


def dollar_golden():
    rng = random.Random(9)
    cases = []
    for label, i in [("J", 1), ("Z", 2), ("J", 3)]:
        path = path_for(label, i)
        # an irregularly sampled variant: drop random points
        thin = [p for k, p in enumerate(path) if k % 3 != 1 or rng.random() < 0.3]
        cases.append({"label": label, "path": path, "thin": thin, "normalized": dollar.normalize(thin)})
    pairs = []
    for a in range(len(cases)):
        for b in range(len(cases)):
            na, nb = dollar.normalize(cases[a]["path"]), dollar.normalize(cases[b]["thin"])
            pairs.append({"a": a, "b": b, "distance": dollar.greedy_cloud_match(na, nb)})
    return {"cases": cases, "pairs": pairs}


def takes_golden():
    """One static and one dynamic take in the exact shape the browser writes (TS test: tests/collect.test.ts)."""
    from signscribe_ml import synth

    st = synth.static_takes(labels="B", signers=("s01",), takes_per=1, frames=3)[0]
    dy = synth.dynamic_takes(labels="J", signers=("s01",), takes_per=1)[0]
    for t in (st, dy):
        t["createdAt"] = "2026-01-01T00:00:00.000Z"
        t["synthetic"] = True
    return [st, dy]


def model_golden():
    """A small k-NN model written by the Python exporter, and what Python predicts for some queries.
    The TypeScript test loads the model and must give the same letters and confidences."""
    from signscribe_ml import knn, synth
    from signscribe_ml.dataset import parse_take

    rng = random.Random(11)
    takes = [parse_take(t) for t in synth.static_takes(labels="ABC", signers=("s1", "s2"), takes_per=2, frames=3, seed=5)]
    model = knn.export_model(takes, 3, 50, "golden", None, True)
    model["meta"]["trainedAt"] = "2026-01-01T00:00:00+00:00"
    X = [(v, l) for v, l in zip(model["vectors"], model["y"])]
    import numpy as np

    Xtr = np.asarray(model["vectors"])
    ytr = [model["labels"][i] for i in model["y"]]
    queries = []
    for _ in range(6):
        base = base_hand(random.Random(rng.randint(0, 3)))
        lm = noisy(base, rng, 0.02)
        f = static_features(lm, 640, 480, False)
        label, conf, ranked = knn.predict(Xtr, ytr, np.asarray(f), model["k"])
        queries.append({"landmarks": lm, "width": 640, "height": 480, "label": label, "confidence": conf, "ranked": ranked})
    return {"model": model, "queries": queries}


if __name__ == "__main__":
    (HERE / "golden_model.json").write_text(json.dumps(model_golden()))
    (HERE / "golden_takes.jsonl").write_text("\n".join(json.dumps(t) for t in takes_golden()) + "\n")
    (HERE / "golden_features.json").write_text(json.dumps(features_golden()))
    (HERE / "golden_dollar.json").write_text(json.dumps(dollar_golden()))
    print("golden files written")
