#!/usr/bin/env python3
"""Checks a YOLO-format card photo folder and writes cards.yaml.

Expected layout (the usual YOLO one):
    ROOT/images/train/*.jpg   ROOT/labels/train/*.txt
    ROOT/images/val/*.jpg     ROOT/labels/val/*.txt
Each label line:  <class id> <cx> <cy> <w> <h>   (all 0..1). Class ids are positions in src/data/contexts.json.
Split train / val BY SESSION (different room, light, background), not by picture: neighbouring pictures of one
session look the same and would make the validation result look better than it is.
"""
import argparse
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _common import classes  # noqa: E402

IMG = {".jpg", ".jpeg", ".png"}


def check(root: Path, names: list):
    problems, summary = [], {}
    for split in ("train", "val"):
        imgs = [p for p in (root / "images" / split).glob("*") if p.suffix.lower() in IMG] if (root / "images" / split).is_dir() else []
        if not imgs:
            problems.append(f"images/{split} is missing or empty")
        boxes, empty = Counter(), 0
        for im in imgs:
            lab = root / "labels" / split / (im.stem + ".txt")
            if not lab.exists():
                problems.append(f"no label file for images/{split}/{im.name} (an empty file means 'no card')")
                continue
            lines = [l for l in lab.read_text().splitlines() if l.strip()]
            if not lines:
                empty += 1
            for n, line in enumerate(lines, 1):
                parts = line.split()
                try:
                    cid = int(parts[0])
                    vals = [float(v) for v in parts[1:]]
                except (ValueError, IndexError):
                    problems.append(f"{lab.name} line {n}: not '<class> <cx> <cy> <w> <h>'")
                    continue
                if len(vals) != 4 or not all(0 <= v <= 1 for v in vals):
                    problems.append(f"{lab.name} line {n}: four numbers between 0 and 1 are needed")
                elif not 0 <= cid < len(names):
                    problems.append(f"{lab.name} line {n}: class {cid} does not exist (0..{len(names) - 1})")
                else:
                    boxes[names[cid]] += 1
        summary[split] = {"images": len(imgs), "no_card": empty, "boxes": boxes}
    return problems, summary


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--root", required=True, type=Path)
    a = ap.parse_args(argv)
    names = classes()
    problems, summary = check(a.root, names)
    for split, s in summary.items():
        print(f"{split}: {s['images']} images, {s['no_card']} without a card")
    for split in summary:
        missing = [n for n in names if summary[split]["boxes"][n] == 0]
        if missing:
            print(f"warning: no {split} examples of: {', '.join(missing)}")
    if problems:
        print("\n".join(f"error: {p}" for p in problems[:30]), file=sys.stderr)
        return 1
    yaml = "path: " + str(a.root.resolve()) + "\ntrain: images/train\nval: images/val\nnames:\n" + "".join(f"  {i}: {n}\n" for i, n in enumerate(names))
    (a.root / "cards.yaml").write_text(yaml, encoding="utf-8")
    print(f"wrote {a.root / 'cards.yaml'} ({len(names)} classes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
