#!/usr/bin/env python3
"""Train the small neural network on ALL the takes of a dataset and write the browser model (public/models/letters-mlp.json).

    python ml/export_mlp.py --data ml/data/arsl21l.jsonl --alphabet arsl --out public/models/letters-mlp.json

Nothing is held out here: this is the model you ship, so there is NO accuracy in its report. Honest numbers come from
`ml/evaluate.py` on the same data (leave-one-person-out); `--evaluation-json` copies the headline of such a run into the model's
meta, only when that run was made on exactly these takes. The takes (and pictures) are never written anywhere by this script.
The browser uses this file first and falls back to letters-knn.json if it is missing or broken."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from signscribe_ml import evaluation as ev  # noqa: E402
from signscribe_ml import knn  # noqa: E402
from signscribe_ml import mlp_model  # noqa: E402
from signscribe_ml.alphabet import AlphabetError, load_alphabet  # noqa: E402
from signscribe_ml.augment import augmented_samples, parse_augment  # noqa: E402
from signscribe_ml.dataset import DatasetError, summary  # noqa: E402
from signscribe_ml.mlp import MLP  # noqa: E402

import numpy as np  # noqa: E402


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", nargs="+", required=True, help="takes JSONL file(s): ALL of their takes are used for training")
    ap.add_argument("--out", required=True, help="e.g. public/models/letters-mlp.json")
    ap.add_argument("--alphabet", help="config/alphabets/<name>.json (default: the active one)")
    ap.add_argument("--augment", default="all", help="rotate,scale,mirror (or all/none), training side only. Default all: the setting that was evaluated")
    ap.add_argument("--augment-copies", type=int, default=2)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--evaluation-json", help="the JSON written by ml/evaluate.py for these same takes: its method and pooled accuracy are copied into meta.evaluation")
    ap.add_argument("--allow-synthetic", action="store_true", help="pipeline tests only")
    a = ap.parse_args(argv)
    try:
        alphabet = load_alphabet(a.alphabet)
        takes, sha = ev.read_many(a.data, alphabet)
        s = summary(takes)
        if s["synthetic"] and not a.allow_synthetic:
            print("error: the data contains synthetic takes; pass --allow-synthetic to test the pipeline", file=sys.stderr)
            return 2
        aug = parse_augment(a.augment, a.augment_copies)
        X, y, _ = knn.build_samples(takes)
        if aug.enabled:
            ax, ay, _ = augmented_samples(takes, aug, a.seed)
            X, y = np.vstack([X, ax]), list(y) + list(ay)
        net = MLP(seed=a.seed).fit(X, y)
        evaluation = None
        if a.evaluation_json:
            j = json.loads(Path(a.evaluation_json).read_text(encoding="utf-8"))
            prov = j["provenance"]
            if prov.get("dataset_sha256") != sha:
                print("error: that evaluation was made on different takes (sha256 differs): it says nothing about this model", file=sys.stderr)
                return 2
            run = next((r for r in j["runs"] if r["name"] == ("with augmentation" if aug.enabled else "no augmentation")), None)
            if run and "mlp" in run["models"]:
                evaluation = {"method": run["method"], "pooledAccuracy": run["models"]["mlp"]["metrics"]["pooled_accuracy"], "source": "ml/evaluate.py", "datasetSha256": sha, "augmentation": run["augment"]}
        model = mlp_model.export_model(net, sha, s["takes"], max(s["persons"], s["signers"]), s["synthetic"], {"augmentation": aug.describe(), "seed": a.seed})
        model["meta"]["evaluation"] = evaluation
        bad = mlp_model.check(model)
        if bad:
            print("error: " + "; ".join(bad), file=sys.stderr)
            return 2
    except (DatasetError, AlphabetError, ev.EvaluationError, OSError, ValueError, KeyError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(model, separators=(",", ":")), encoding="utf-8")
    report = out.with_suffix(".report.md")
    report.write_text(
        "# Letter model (neural network)\n\n"
        + ("> **SYNTHETIC DATA: pipeline test only.**\n\n" if s["synthetic"] else "")
        + f"- trained on ALL {s['takes']} takes of dataset sha256 `{sha}` ({len(model['labels'])} labels), {aug.describe()} (augmentation), seed {a.seed}\n"
        f"- network: {model['meta']['network']}\n"
        "- **no accuracy is reported here**: nothing was held out. Honest numbers: `ml/evaluate.py` on the same data (see docs/MODEL_RESULTS.md)\n"
        + (f"- evaluation copied from ml/evaluate.py: {evaluation['method']}, pooled accuracy {evaluation['pooledAccuracy'] * 100:.1f}%\n" if evaluation else "- no evaluation attached (pass --evaluation-json with the run on these same takes)\n"),
        encoding="utf-8",
    )
    print(f"wrote {out} ({out.stat().st_size / 1e3:.0f} kB, {len(model['labels'])} labels) and {report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
