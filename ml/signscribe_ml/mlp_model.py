"""The small neural network as a browser model: JSON out of the numpy MLP, and the same forward pass in numpy for checking it.

File (`letters-mlp.json`, docs/MODEL_FORMAT.md): standardisation (mean, std per feature) and layers with `w[in][out]` and `b[out]`.
Hidden layers use ReLU, the last layer is followed by softmax. The browser runs the same arithmetic (src/recognition/mlp.ts); a golden
file (ml/tests/golden_mlp.json) is checked by both test suites. Weights are rounded to 6 decimals, so what is stored is what is tested."""
from __future__ import annotations

import datetime

import numpy as np

from .features import FEATURES_ID, FEATURE_LENGTH
from .mlp import MLP

DECIMALS = 6


def _r(a) -> list:
    return np.round(np.asarray(a, dtype=np.float64), DECIMALS).tolist()


def export_model(mlp: MLP, sha: str, takes: int, signers: int, synthetic: bool, extra_meta: dict | None = None) -> dict:
    """The browser model for a trained MLP (must have been fitted)."""
    if not getattr(mlp, "classes", None):
        raise ValueError("the MLP has not been trained")
    sd = mlp.sd.astype(np.float64)
    return {
        "format": "signscribe-model",
        "version": 1,
        "type": "mlp",
        "features": FEATURES_ID,
        "labels": list(mlp.classes),
        "standardize": {"mean": _r(mlp.mu), "std": _r(sd)},
        "layers": [{"w": _r(W), "b": _r(b)} for W, b in zip(mlp.W, mlp.b)],
        "meta": {
            "trainedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
            "datasetSha256": sha,
            "takes": takes,
            "signers": signers,
            "synthetic": synthetic,
            "network": mlp.describe(),
            "evaluation": None,
            **(extra_meta or {}),
        },
    }


def check(m) -> list:
    """Problems with a model dict (the same rules the browser enforces in parseMlpModel)."""
    errs = []
    if not isinstance(m, dict) or m.get("format") != "signscribe-model" or m.get("type") != "mlp":
        return ["not a signscribe mlp model"]
    if m.get("version") != 1:
        errs.append("version must be 1")
    if m.get("features") != FEATURES_ID:
        errs.append(f"features must be {FEATURES_ID}")
    labels = m.get("labels")
    if not isinstance(labels, list) or len(labels) < 2:
        errs.append("need at least 2 labels")
        return errs
    st = m.get("standardize") or {}
    for k in ("mean", "std"):
        v = st.get(k)
        if not isinstance(v, list) or len(v) != FEATURE_LENGTH or any(not isinstance(x, (int, float)) for x in v):
            errs.append(f"standardize.{k} needs {FEATURE_LENGTH} numbers")
    if isinstance(st.get("std"), list) and any(x <= 0 for x in st["std"] if isinstance(x, (int, float))):
        errs.append("standardize.std must be positive")
    layers = m.get("layers")
    if not isinstance(layers, list) or len(layers) < 1:
        return errs + ["layers must be a non-empty list"]
    width = FEATURE_LENGTH
    for i, L in enumerate(layers):
        w, b = L.get("w"), L.get("b")
        if not isinstance(w, list) or len(w) != width or any(not isinstance(r, list) for r in w):
            errs.append(f"layers[{i}].w must have {width} rows")
            break
        out = len(w[0])
        if any(len(r) != out for r in w) or not isinstance(b, list) or len(b) != out:
            errs.append(f"layers[{i}]: w rows and b must all have {out} numbers")
            break
        width = out
    else:
        if width != len(labels):
            errs.append(f"the last layer has {width} outputs but there are {len(labels)} labels")
    if not isinstance(m.get("meta"), dict):
        errs.append("meta is missing")
    return errs


def forward(m: dict, X) -> np.ndarray:
    """Class probabilities (rows sum to 1) for feature rows, computed only from the JSON (what the browser does)."""
    a = (np.asarray(X, dtype=np.float64) - np.asarray(m["standardize"]["mean"])) / np.asarray(m["standardize"]["std"])
    n = len(m["layers"])
    for i, L in enumerate(m["layers"]):
        a = a @ np.asarray(L["w"]) + np.asarray(L["b"])
        if i < n - 1:
            a = np.maximum(a, 0.0)
    a = a - a.max(axis=1, keepdims=True)
    e = np.exp(a)
    return e / e.sum(axis=1, keepdims=True)
