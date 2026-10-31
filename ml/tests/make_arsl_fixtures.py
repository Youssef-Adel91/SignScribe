#!/usr/bin/env python3
"""Regenerates tests/fixtures/arsl/*.json: the two ArSL model files made by ml/export_arsl.py from GENERATED hands (all 32 ArSL21L classes).
They exist so tests/arsl-models.test.ts can check the browser loader against what the Python exporters really write. They are marked
synthetic, are not a model of anything and never go into public/models/.   python ml/tests/make_arsl_fixtures.py"""
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE))

import export_arsl  # noqa: E402
from signscribe_ml.alphabet import load_alphabet  # noqa: E402
from test_arsl_export import write_takes  # noqa: E402

OUT = HERE.parent.parent / "tests" / "fixtures" / "arsl"

if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as d:
        data = write_takes(Path(d) / "arsl.jsonl", list(load_alphabet("arsl").static))
        OUT.mkdir(parents=True, exist_ok=True)
        raise SystemExit(export_arsl.main(["--data", str(data), "--out-dir", str(OUT), "--allow-synthetic", "--max-per-class", "2"]))
