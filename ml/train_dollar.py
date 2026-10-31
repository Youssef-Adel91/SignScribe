#!/usr/bin/env python3
"""Train the $P recognizer for signs that move (templates = recorded paths) and write model + report."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from signscribe_ml import motion  # noqa: E402
from signscribe_ml.alphabet import AlphabetError, load_alphabet  # noqa: E402
from signscribe_ml.dataset import DatasetError, read_takes, summary  # noqa: E402
from signscribe_ml.knn import metrics  # noqa: E402
from signscribe_ml.report import write_report  # noqa: E402


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", required=True, help="e.g. public/models/motion-dollar.json (ASL) or public/models/motion-arsl-dollar.json (ArSL)")
    ap.add_argument("--alphabet", help="config/alphabets/<name>.json (default: the active one). The templates are the dynamic classes of that alphabet: J and Z, or the dynamic controls")
    ap.add_argument("--landmark", type=int, default=8, help="landmark whose path is used (8 = index tip, 20 = pinky tip)")
    ap.add_argument("--max-per-label", type=int, default=30)
    ap.add_argument("--allow-synthetic", action="store_true")
    a = ap.parse_args(argv)
    try:
        takes, sha = read_takes(a.data, load_alphabet(a.alphabet).labels)
    except (DatasetError, AlphabetError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    s = summary(takes)
    if s["synthetic"] and not a.allow_synthetic:
        print("error: the data contains synthetic takes; pass --allow-synthetic to test the pipeline", file=sys.stderr)
        return 2
    try:
        ev = motion.evaluate(takes, a.landmark)
    except ValueError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    m = metrics(ev)
    evaluation = {"method": ev["method"], "samples": m["samples"], "accuracy": m["accuracy"], "datasetSha256": sha}
    model = motion.export_model(takes, a.landmark, a.max_per_label, sha, evaluation, s["synthetic"])
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(model, separators=(",", ":")), encoding="utf-8")
    report = out.with_suffix(".report.md")
    write_report(report, "Moving signs: $P evaluation", takes, sha, ev, m, [f"- landmark: {a.landmark}"])
    print(f"wrote {out} ({len(model['templates'])} templates) and {report}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
