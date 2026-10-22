#!/usr/bin/env python3
"""Train the static-letter k-NN from collected takes and write the model JSON plus an honest report."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from signscribe_ml import knn  # noqa: E402
from signscribe_ml.dataset import DatasetError, read_takes, summary  # noqa: E402
from signscribe_ml.report import write_report  # noqa: E402


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--data", required=True, help="takes.jsonl from the collection mode")
    ap.add_argument("--out", required=True, help="model JSON, e.g. public/models/letters-knn.json")
    ap.add_argument("--k", type=int, default=5)
    ap.add_argument("--tune", action="store_true", help="choose k from 1,3,5,7,9 by cross-validation")
    ap.add_argument("--max-per-class", type=int, default=300, help="stored samples per letter (keeps the file small)")
    ap.add_argument("--allow-synthetic", action="store_true", help="only for pipeline tests")
    a = ap.parse_args(argv)
    try:
        takes, sha = read_takes(a.data)
    except DatasetError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    s = summary(takes)
    if s["synthetic"] and not a.allow_synthetic:
        print("error: the data contains synthetic takes; pass --allow-synthetic to test the pipeline", file=sys.stderr)
        return 2
    k = a.k
    extra = []
    if a.tune:
        k, scores = knn.tune_k(takes)
        extra.append("- k chosen by cross-validation on the same data (optimistic): " + ", ".join(f"k={kk}: {v * 100:.1f}%" for kk, v in scores.items()))
    ev = knn.evaluate(takes, k)
    m = knn.metrics(ev)
    evaluation = {"method": ev["method"], "samples": m["samples"], "accuracy": m["accuracy"], "datasetSha256": sha}
    model = knn.export_model(takes, k, a.max_per_class, sha, evaluation, s["synthetic"])
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(model, separators=(",", ":")), encoding="utf-8")
    report = out.with_suffix(".report.md")
    write_report(report, "Static letters: k-NN evaluation", takes, sha, ev, m, extra)
    print(f"wrote {out} ({len(model['vectors'])} samples, {len(model['labels'])} letters) and {report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
