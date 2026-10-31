#!/usr/bin/env python3
"""Writes BOTH model files the app loads for ArSL from one takes file, with the same alphabet file and the same settings:

    python ml/export_arsl.py --data ml/data/arsl21l.jsonl

        public/models/letters-arsl-mlp.json   (ml/export_mlp.py)
        public/models/letters-arsl-knn.json   (ml/train_knn.py)

Each file can also be made alone (docs/MODEL_HANDOFF.md):

    python ml/export_mlp.py --data ml/data/arsl21l.jsonl --alphabet arsl --augment all --seed 0 --out public/models/letters-arsl-mlp.json
    python ml/train_knn.py  --data ml/data/arsl21l.jsonl --alphabet arsl --augment all --seed 0 --out public/models/letters-arsl-knn.json

The class order of both files is the same by construction (sorted class ids of the takes); this script checks it and checks both
files against config/alphabets/arsl.json before it says OK. The takes file and the pictures are only read: nothing of the data is
written to the models except the numbers a model needs. Re-running gives the same weights and samples (fixed seed); only
`meta.trainedAt` differs. The files carry no accuracy of their own: honest numbers come from ml/evaluate.py (docs/MODEL_RESULTS.md)."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import export_mlp  # noqa: E402
import train_knn  # noqa: E402
import validate_model  # noqa: E402


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", required=True, help="the takes JSONL file of the ArSL data (for example from import_images.py)")
    ap.add_argument("--alphabet", default="arsl", help="config/alphabets/<name>.json (default arsl)")
    ap.add_argument("--out-dir", default="public/models")
    ap.add_argument("--augment", default="all")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--max-per-class", type=int, default=300, help="stored k-NN samples per letter (file size)")
    ap.add_argument("--evaluation-json", help="the ml/evaluate.py JSON for these same takes: copied into the MLP's meta only if the dataset hash matches")
    ap.add_argument("--allow-synthetic", action="store_true", help="pipeline tests only")
    a = ap.parse_args(argv)
    out = Path(a.out_dir)
    mlp_path, knn_path = out / f"letters-{a.alphabet}-mlp.json", out / f"letters-{a.alphabet}-knn.json"
    common = ["--alphabet", a.alphabet, "--augment", a.augment, "--seed", str(a.seed)] + (["--allow-synthetic"] if a.allow_synthetic else [])
    r = export_mlp.main(["--data", a.data, "--out", str(mlp_path), *common] + (["--evaluation-json", a.evaluation_json] if a.evaluation_json else []))
    if r:
        return r
    r = train_knn.main(["--data", a.data, "--out", str(knn_path), "--max-per-class", str(a.max_per_class), *common])
    if r:
        return r
    labels = {}
    for path in (mlp_path, knn_path):
        m = json.loads(path.read_text(encoding="utf-8"))
        bad = [e for e in validate_model.check(m) if not e.startswith("WARNING")] + validate_model.check_alphabet(m, a.alphabet)
        if bad:
            print(f"error: {path}: " + "; ".join(bad), file=sys.stderr)
            return 1
        labels[path.name] = m["labels"]
    if labels[mlp_path.name] != labels[knn_path.name]:
        print("error: the two files do not list the same classes in the same order", file=sys.stderr)
        return 1
    print(f"OK: {mlp_path.name} and {knn_path.name} list the same {len(labels[mlp_path.name])} classes in the same order, all in the {a.alphabet} alphabet")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
