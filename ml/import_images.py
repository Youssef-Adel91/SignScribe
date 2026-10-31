#!/usr/bin/env python3
"""Import a folder of labelled pictures (one sub-folder per letter) as takes of MediaPipe hand landmarks.

    python ml/import_images.py --images path/to/dataset --out data/asl.jsonl --dataset-name ASL-Alphabet \\
        --source asl-alphabet-train [--person-regex '(?P<person>user\\d+)']

Pictures with no hand are skipped and counted. The pictures themselves are not kept. Format: docs/DATASET.md.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from signscribe_ml import images  # noqa: E402
from signscribe_ml.alphabet import AlphabetError, load_alphabet  # noqa: E402
from signscribe_ml.dataset import parse_take  # noqa: E402

DEFAULT_MODEL = Path(__file__).resolve().parents[1] / "public" / "models" / "hand_landmarker.task"


def main(argv=None, detector=None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--images", required=True, help="folder with one sub-folder per letter")
    ap.add_argument("--out", required=True, help="takes JSONL to write")
    ap.add_argument("--alphabet", help="config/alphabets/<name>.json (default: the active one)")
    ap.add_argument("--dataset-name", default="", help="name of the dataset (goes into the take ids and the report)")
    ap.add_argument("--source", help="which recording/sub-dataset these pictures come from (default: the folder name). Used to hold a source out when the dataset has no person ids")
    ap.add_argument("--person-regex", help="regular expression applied to each picture's path inside --images (e.g. 'A/user3_001.jpg'); its group `person` (or group 1) is the person id")
    ap.add_argument("--hand", default="right", choices=["right", "left"], help="the signing hand in these pictures (mixed datasets: use right and train with --augment mirror)")
    ap.add_argument("--model", default=str(DEFAULT_MODEL), help="hand_landmarker.task")
    ap.add_argument("--min-confidence", type=float, default=0.5)
    ap.add_argument("--overwrite", action="store_true")
    a = ap.parse_args(argv)
    root = Path(a.images)
    out = Path(a.out)
    if not root.is_dir():
        print(f"error: {root} is not a folder", file=sys.stderr)
        return 2
    if out.exists() and not a.overwrite:
        print(f"error: {out} exists (use --overwrite)", file=sys.stderr)
        return 2
    try:
        alphabet = load_alphabet(a.alphabet)
    except AlphabetError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    if not alphabet.reviewed:
        print(f"warning: alphabet '{alphabet.id}' is a template that nobody has checked against a dataset yet", file=sys.stderr)
    det = detector or images.MediaPipeDetector(a.model, a.min_confidence)
    source = a.source or root.resolve().name
    try:
        takes, stats = images.import_folder(root, alphabet, det, source, a.hand, a.person_regex, a.dataset_name)
        detector_text = det.describe() if hasattr(det, "describe") else "custom detector"
    finally:
        if hasattr(det, "close"):
            det.close()
    for t in takes:  # the same rules the training scripts will apply
        parse_take(t, 0, alphabet.labels)
    out.parent.mkdir(parents=True, exist_ok=True)
    import json

    out.write_text("".join(json.dumps(t, separators=(",", ":")) + "\n" for t in sorted(takes, key=lambda t: t["id"])), encoding="utf-8")
    meta = {
        "command": "python ml/import_images.py " + " ".join(argv),
        "alphabet": alphabet.id,
        "dataset": a.dataset_name or "(not named)",
        "source": source,
        "detector": detector_text,
        "output": str(out),
    }
    rep = images.report_markdown(stats, alphabet, meta)
    out.with_suffix(".import.md").write_text(rep, encoding="utf-8")
    print(rep)
    return 0 if takes else 1


if __name__ == "__main__":
    raise SystemExit(main())
