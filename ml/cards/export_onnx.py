#!/usr/bin/env python3
"""Exports trained YOLOv8 weights to cards.onnx + cards.json (what the browser loads).

Needs `pip install ultralytics`. The evaluation entry is only filled in when you pass the metrics file of a
validation run (--metrics, JSON); nothing is invented here.
"""
import argparse
import datetime
import hashlib
import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _common import classes  # noqa: E402

SIZE = 640


def dataset_hash(root: Path) -> str:
    h = hashlib.sha256()
    for p in sorted((root / "images").rglob("*")) + sorted((root / "labels").rglob("*.txt")):
        if p.is_file():
            h.update(str(p.relative_to(root)).encode())
            h.update(p.read_bytes())
    return h.hexdigest()


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--weights", required=True, type=Path)
    ap.add_argument("--dataset", required=True, type=Path, help="the photo folder used for training")
    ap.add_argument("--out", required=True, type=Path, help="e.g. public/models/cards.onnx")
    ap.add_argument("--metrics", type=Path, help="JSON written by you from a validation run")
    ap.add_argument("--synthetic", action="store_true", help="mark a model trained on generated pictures")
    a = ap.parse_args(argv)
    try:
        from ultralytics import YOLO
    except ImportError:
        print("error: ultralytics is not installed (pip install ultralytics)", file=sys.stderr)
        return 2
    exported = Path(YOLO(str(a.weights)).export(format="onnx", imgsz=SIZE, opset=12, simplify=True))
    a.out.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(exported, a.out)
    images = sum(1 for _ in (a.dataset / "images").rglob("*") if _.is_file())
    meta = {
        "format": "signscribe-cards", "version": 1, "classes": classes(), "inputSize": SIZE, "output": "yolov8",
        "meta": {
            "trainedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
            "datasetSha256": dataset_hash(a.dataset), "images": images, "synthetic": a.synthetic,
            "evaluation": json.loads(a.metrics.read_text()) if a.metrics else None,
        },
    }
    a.out.with_name("cards.json").write_text(json.dumps(meta, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {a.out} and {a.out.with_name('cards.json')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
