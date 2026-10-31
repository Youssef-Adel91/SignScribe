"""Writes ml/tests/golden_mlp.json: a small GENERATED neural-network model (60-64-32-C, trained on generated takes) with inputs and the
probabilities the Python forward pass gives for them. The TypeScript forward pass (src/recognition/mlp.ts) must give the same numbers
(tests/mlp.test.ts). The model here is a test fixture: it says nothing about real hands.

    python ml/tests/make_golden_mlp.py
"""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent))

from signscribe_ml import knn, mlp_model, synth  # noqa: E402
from signscribe_ml.dataset import parse_take  # noqa: E402
from signscribe_ml.features import static_features  # noqa: E402
from signscribe_ml.mlp import MLP  # noqa: E402

takes = [parse_take(t, 0, list("ABCDEF")) for t in synth.static_takes(labels="ABCDEF", signers=("s1", "s2"), takes_per=4, frames=4, seed=11)]
X, y, _ = knn.build_samples(takes)
net = MLP(epochs=15, seed=3).fit(X, y)
model = mlp_model.export_model(net, "0" * 64, len(takes), 2, True, {"note": "test fixture trained on generated takes"})
model["meta"]["trainedAt"] = "fixture"

rng = np.random.default_rng(5)
rows = [X[i] + rng.normal(0, 0.05, 60) for i in range(0, len(X), 7)][:8] + [rng.normal(0, 2.0, 60) for _ in range(4)]
feature_cases = [{"features": [round(float(v), 6) for v in r], "probs": mlp_model.forward(model, [[round(float(v), 6) for v in r]])[0].tolist()} for r in rows]

landmark_cases = []
for t, mirror in ((takes[0], False), (takes[9], True), (takes[17], False)):
    lm = [[round(v, 6) for v in p] for p in t.frames[0][1]]
    f = static_features(lm, t.width, t.height, mirror_x=mirror)
    landmark_cases.append({"landmarks": lm, "width": t.width, "height": t.height, "mirror": mirror, "features": f, "probs": mlp_model.forward(model, [f])[0].tolist()})

out = Path(__file__).parent / "golden_mlp.json"
out.write_text(json.dumps({"model": model, "feature_cases": feature_cases, "landmark_cases": landmark_cases}, separators=(",", ":")), encoding="utf-8")
print(f"wrote {out} ({out.stat().st_size / 1e3:.0f} kB)")
