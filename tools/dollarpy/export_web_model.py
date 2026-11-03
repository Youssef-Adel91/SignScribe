#!/usr/bin/env python3
"""Turn the DollarPy templates file (picture units 0..1) into the motion model of the web app (public/models/motion-dollar.json).

    python tools/dollarpy/export_web_model.py                       # tools/dollarpy/templates.json -> public/models/motion-dollar.json
    python tools/dollarpy/export_web_model.py --width 1280 --height 720

The web app judges a path in camera pixels and keeps the aspect ratio, so the 0..1 paths are scaled back by the picture size
(default 1280x720, what the app asks the camera for). Use the size of the camera that made the templates."""
from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from dollar_logic import TemplateError, load_templates  # noqa: E402
from signscribe_ml import dollar  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]


def build_model(templates, landmark: int, width: float, height: float, sha: str, n: int = dollar.N_POINTS) -> dict:
    items = []
    for label, move in templates:
        pts = [(p[0] * width, p[1] * height) for p in move]
        items.append({"label": label, "points": [[round(x, 3), round(y, 3)] for x, y in dollar.resample(pts, n)]})
    return {
        "format": "signscribe-model",
        "version": 1,
        "type": "dollarP",
        "landmark": landmark,
        "n": n,
        "templates": items,
        "meta": {
            "trainedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
            "datasetSha256": sha,
            "takes": len(items),
            "signers": 1,
            "synthetic": False,
            "evaluation": None,
        },
    }


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--templates", default=str(Path(__file__).parent / "templates.json"))
    ap.add_argument("--out", default=str(ROOT / "public" / "models" / "motion-dollar.json"))
    ap.add_argument("--width", type=float, default=1280)
    ap.add_argument("--height", type=float, default=720)
    a = ap.parse_args(argv)
    try:
        templates, raw = load_templates(a.templates)
    except TemplateError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    if raw.get("pose_parts"):
        print("error: these templates carry the body; the web app compares the fingertip only. Record with --no-pose.", file=sys.stderr)
        return 2
    sha = hashlib.sha256(Path(a.templates).read_bytes()).hexdigest()
    model = build_model(templates, int(raw.get("landmark", 8)), a.width, a.height, sha)
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(model, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {out}: {', '.join(sorted({t['label'] for t in model['templates']}))} ({len(model['templates'])} templates, one signer, not evaluated)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
