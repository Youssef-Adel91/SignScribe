#!/usr/bin/env python3
"""Train the static-letter k-NN from collected takes and write the model JSON plus an honest report."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from signscribe_ml import knn  # noqa: E402
from signscribe_ml.alphabet import AlphabetError, load_alphabet  # noqa: E402
from signscribe_ml.augment import parse_augment  # noqa: E402
from signscribe_ml.folds import FoldError  # noqa: E402
from signscribe_ml.dataset import DatasetError, read_takes, summary  # noqa: E402
from signscribe_ml.report import write_report  # noqa: E402


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--data", required=True, help="takes.jsonl from the collection mode")
    ap.add_argument("--out", required=True, help="model JSON, e.g. public/models/letters-knn.json")
    ap.add_argument("--k", type=int, default=5)
    ap.add_argument("--tune", action="store_true", help="choose k from 1,3,5,7,9 by cross-validation")
    ap.add_argument("--max-per-class", type=int, default=300, help="stored samples per letter (keeps the file small)")
    ap.add_argument("--alphabet", help="config/alphabets/<name>.json (default: the active one)")
    ap.add_argument("--group-by", default="auto", choices=["auto", "person", "source", "signer", "session"])
    ap.add_argument("--augment", default="none", help="rotate,scale,mirror (or all/none): added to the stored samples and to the training side of the evaluation")
    ap.add_argument("--augment-copies", type=int, default=2)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--allow-synthetic", action="store_true", help="only for pipeline tests")
    a = ap.parse_args(argv)
    try:
        takes, sha = read_takes(a.data, load_alphabet(a.alphabet).labels)
        aug = parse_augment(a.augment, a.augment_copies)
    except (DatasetError, AlphabetError, ValueError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    s = summary(takes)
    if s["synthetic"] and not a.allow_synthetic:
        print("error: the data contains synthetic takes; pass --allow-synthetic to test the pipeline", file=sys.stderr)
        return 2
    k = a.k
    extra = [f"- augmentation (training side only): {aug.describe()}"]
    try:
        if a.tune:
            k, scores = knn.tune_k(takes)
        ev = knn.evaluate(takes, k, aug, a.seed, a.group_by)
    except FoldError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    if a.tune:
        extra.append("- k chosen by cross-validation on the same data (optimistic): " + ", ".join(f"k={kk}: {v * 100:.1f}%" for kk, v in scores.items()))
    m = knn.metrics(ev)
    evaluation = {"method": ev["method"], "samples": m["samples"], "accuracy": m["accuracy"], "datasetSha256": sha}
    evaluation["generalises"] = ev["generalises"]
    model = knn.export_model(takes, k, a.max_per_class, sha, evaluation, s["synthetic"], aug, a.seed)
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(model, separators=(",", ":")), encoding="utf-8")
    report = out.with_suffix(".report.md")
    write_report(report, "Static letters: k-NN evaluation", takes, sha, ev, m, extra)
    print(f"wrote {out} ({len(model['vectors'])} samples, {len(model['labels'])} letters) and {report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
