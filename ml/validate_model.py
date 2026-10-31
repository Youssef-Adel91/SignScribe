#!/usr/bin/env python3
"""Checks a model JSON against the rules the browser enforces (docs/MODEL_FORMAT.md). Exit code 0 = loadable."""
import json
import sys

from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from signscribe_ml.features import FEATURES_ID, FEATURE_LENGTH  # noqa: E402
from signscribe_ml import mlp_model  # noqa: E402


def check(m) -> list:
    errs = []
    if not isinstance(m, dict) or m.get("format") != "signscribe-model":
        return ["format must be 'signscribe-model'"]
    if m.get("version") != 1:
        errs.append("version must be 1")
    meta = m.get("meta")
    if not isinstance(meta, dict):
        errs.append("meta is missing")
    elif meta.get("synthetic"):
        errs.append("WARNING: trained on synthetic data, must not be used for a real study")
    if m.get("type") == "mlp":
        errs += [e for e in mlp_model.check(m) if e not in errs]
    elif m.get("type") == "knn":
        if m.get("features") != FEATURES_ID:
            errs.append(f"features must be {FEATURES_ID}")
        if not isinstance(m.get("labels"), list) or len(m["labels"]) < 2:
            errs.append("need at least 2 labels")
        v, y = m.get("vectors"), m.get("y")
        if not isinstance(v, list) or not isinstance(y, list) or len(v) != len(y) or not v:
            errs.append("vectors and y must be equal-length, non-empty lists")
        else:
            if any(len(r) != FEATURE_LENGTH for r in v):
                errs.append(f"every vector needs {FEATURE_LENGTH} numbers")
            if any(not isinstance(i, int) or i < 0 or i >= len(m.get("labels", [])) for i in y):
                errs.append("y points at a missing label")
        if not isinstance(m.get("k"), int) or m["k"] < 1:
            errs.append("k must be a positive integer")
    elif m.get("type") == "dollarP":
        if not isinstance(m.get("landmark"), int) or not 0 <= m["landmark"] <= 20:
            errs.append("landmark must be 0..20")
        t = m.get("templates")
        if not isinstance(t, list) or not t:
            errs.append("templates must be a non-empty list")
        elif any(len(x.get("points", [])) < 2 for x in t):
            errs.append("every template needs at least 2 points")
    else:
        errs.append("type must be 'knn', 'mlp' or 'dollarP'")
    return errs


def check_alphabet(m, name) -> list:
    """The browser refuses a model with a letter its alphabet does not have; so does this."""
    from signscribe_ml.alphabet import REJECT_LABEL, AlphabetError, load_alphabet

    try:
        known = set(load_alphabet(name).labels) | {REJECT_LABEL}
    except AlphabetError as e:
        return [str(e)]
    stranger = [l for l in (m.get("labels") or []) if l not in known]
    return [f"letter '{stranger[0]}' is not in the {name} alphabet: the model was trained for another alphabet"] if stranger else []


def main(argv) -> int:
    args = list(argv[1:])
    alphabet = None
    if "--alphabet" in args:
        i = args.index("--alphabet")
        if i + 1 >= len(args):
            print("usage: validate_model.py MODEL.json [--alphabet NAME]", file=sys.stderr)
            return 2
        alphabet = args[i + 1]
        del args[i : i + 2]
    if len(args) != 1:
        print("usage: validate_model.py MODEL.json [--alphabet NAME]", file=sys.stderr)
        return 2
    model = json.loads(Path(args[0]).read_text(encoding="utf-8"))
    errs = check(model)
    if alphabet and model.get("type") in ("knn", "mlp"):
        errs += check_alphabet(model, alphabet)
    for e in errs:
        print(e)
    hard = [e for e in errs if not e.startswith("WARNING")]
    print("OK" if not hard else f"{len(hard)} problem(s)")
    return 1 if hard else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
