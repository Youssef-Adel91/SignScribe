#!/usr/bin/env python3
"""Precision and coverage at several confidence thresholds, for the k-NN vote share and for the MLP softmax separately.

    # leave-one-person-out on a dataset
    python ml/calibrate.py --data ml/data/arsl21l.jsonl --alphabet arsl

    # trained on a dataset, tested on your own webcam takes only (never mixed into training)
    python ml/calibrate.py --train ml/data/arsl21l.jsonl --test ml/data/my-webcam.jsonl --test-name "team webcam" --alphabet arsl

The numbers come from held-out predictions only and are written to ml/reports/ (git-ignored) with the dataset hash.
No threshold is chosen or changed here: read the table, then change `LETTER` by hand with a test (docs/MODEL_HANDOFF.md, Step 5).

--alphabet is required for anything that is not the active alphabet (ArSL data needs --alphabet arsl). --augment defaults to all, the setting
ml/export_arsl.py ships, so the calibration matches the shipped model; pass --augment none to see the model without it.
--dataset-name defaults to the takes file name and --dataset-version to "unspecified" (both are only labels in the report)."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from signscribe_ml import calibration as cal  # noqa: E402
from signscribe_ml import evaluation as ev  # noqa: E402
from signscribe_ml.alphabet import AlphabetError, load_alphabet  # noqa: E402
from signscribe_ml.augment import parse_augment  # noqa: E402
from signscribe_ml.dataset import DatasetError  # noqa: E402
from signscribe_ml.folds import FoldError  # noqa: E402

EXAMPLE = """example (ArSL, leave-one-person-out, the way the shipped model is trained):
  python ml/calibrate.py --data ml/data/arsl21l.jsonl --alphabet arsl
and on your own webcam takes:
  python ml/calibrate.py --train ml/data/arsl21l.jsonl --test ml/data/my-webcam.jsonl --test-name "team webcam" --alphabet arsl"""

WHAT = {
    "knn": "the winner's share of the distance-weighted votes of the 5 nearest samples (what the browser's k-NN reports)",
    "mlp": "the softmax probability of the best letter (what the browser's neural network reports)",
}


def main(argv=None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", nargs="+", help="takes JSONL file(s): leave-one-group-out predictions on these")
    ap.add_argument("--train", nargs="+", help="with --test: train on these ...")
    ap.add_argument("--test", nargs="+", help="... and use predictions on THESE recordings only")
    ap.add_argument("--test-name", default="own recordings")
    ap.add_argument("--alphabet", help="config/alphabets/<name>.json")
    ap.add_argument("--dataset-name", help="label for the report (default: the name of the takes file)")
    ap.add_argument("--dataset-version", default="unspecified", help="label for the report (default: unspecified)")
    ap.add_argument("--models", default="knn,mlp")
    ap.add_argument("--thresholds", default=",".join(str(t) for t in cal.DEFAULT_THRESHOLDS), help="comma list, e.g. 0,0.5,0.7,0.9")
    ap.add_argument("--k", type=int, default=5)
    ap.add_argument("--group-by", default="auto", choices=["auto", "person", "source", "signer", "session"])
    ap.add_argument("--augment", default="all", help="rotate,scale,mirror (or all/none), training side only. Default all: what ml/export_arsl.py ships")
    ap.add_argument("--augment-copies", type=int, default=2)
    ap.add_argument("--shared-classes", action="store_true")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out-dir", default="ml/reports")
    ap.add_argument("--allow-synthetic", action="store_true", help="pipeline tests only")
    ap.add_argument("--allow-optimistic", action="store_true")
    ap.epilog = EXAMPLE
    a = ap.parse_args(argv)
    if not a.dataset_name:
        a.dataset_name = Path((a.data or a.train)[0] if (a.data or a.train) else "dataset").stem
    if bool(a.data) == bool(a.train and a.test) or (a.train and not a.test) or (a.test and not a.train):
        print("error: pass either --data, or both --train and --test", file=sys.stderr)
        return 2
    try:
        thresholds = [float(x) for x in a.thresholds.split(",") if x.strip()]
        if not thresholds or any(not 0 <= t <= 1 for t in thresholds):
            raise ValueError("--thresholds must be numbers between 0 and 1")
        alphabet = load_alphabet(a.alphabet)
        aug = parse_augment(a.augment, a.augment_copies)
        models = tuple(m.strip() for m in a.models.split(",") if m.strip())
        if a.data:
            takes, sha = ev.read_many(a.data, alphabet)
            prov = ev.provenance(["ml/calibrate.py", *argv], a.dataset_name, a.dataset_version, sha, takes, alphabet)
            if prov["synthetic"] and not a.allow_synthetic:
                raise ev.EvaluationError("the data contains synthetic takes; pass --allow-synthetic to test the pipeline")
            res = ev.run(takes, models, a.k, aug, a.seed, a.group_by, a.allow_optimistic, a.shared_classes)
            kind = f"{res['method']} over {res['n_groups']} groups, every prediction made by a model that never saw that group"
            if not res["generalises"]:
                kind += " (OPTIMISTIC: one group only, says nothing about new people)"
        else:
            train, sha = ev.read_many(a.train, alphabet)
            test, tsha = ev.read_many(a.test, alphabet)
            prov = ev.provenance(["ml/calibrate.py", *argv], a.dataset_name, a.dataset_version, sha, train, alphabet)
            prov["synthetic"] = prov["synthetic"] or any(t.synthetic for t in test)
            if prov["synthetic"] and not a.allow_synthetic:
                raise ev.EvaluationError("the data contains synthetic takes; pass --allow-synthetic to test the pipeline")
            prov["test_sha256"] = tsha
            res = ev.run_train_test(train, test, models, a.k, aug, a.seed, a.shared_classes)
            kind = f"trained on {a.dataset_name}, tested on separate recordings ({a.test_name}); not a leave-one-person-out result"
        table = cal.build(res, thresholds)
    except (DatasetError, AlphabetError, ev.EvaluationError, FoldError, cal.CalibrationError, ValueError) as e:
        print(f"error: {e}", file=sys.stderr)
        if "label must be" in str(e):
            print("hint: the labels are checked against the alphabet. For ArSL data pass --alphabet arsl.\n" + EXAMPLE, file=sys.stderr)
        return 2
    head = [
        f"# Confidence calibration: {a.dataset_name} {a.dataset_version}",
        "",
        "> **SYNTHETIC DATA: pipeline test only.**" if prov["synthetic"] else "",
        f"- dataset sha256 `{prov['dataset_sha256']}`" + (f", test recordings sha256 `{prov['test_sha256']}`" if "test_sha256" in prov else ""),
        f"- alphabet `{prov['alphabet']}`, augmentation (training side only): {res['augment']}, k={a.k}, seed {a.seed}",
        f"- command: `{prov['command']}`",
        "",
    ]
    body = "\n".join(head) + "\n" + cal.markdown(table, WHAT, kind)
    out = Path(a.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    safe = "".join(c if c.isalnum() or c in "-_." else "_" for c in a.dataset_name + ("-on-" + a.test_name if a.test else ""))
    stem = f"calibration-{safe}-{prov['date'][:10]}"
    (out / f"{stem}.md").write_text(body, encoding="utf-8")
    (out / f"{stem}.json").write_text(json.dumps({"provenance": prov, "method": res["method"], "thresholds": thresholds, "models": table}, indent=1), encoding="utf-8")
    print(body)
    print(f"wrote {out / (stem + '.md')} and {out / (stem + '.json')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
