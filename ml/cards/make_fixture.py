#!/usr/bin/env python3
"""Writes tests/fixtures/const-yolo.onnx: a TEST FIXTURE, not a detector.

It ignores the picture and always answers "one Doctor card, in the middle, score 0.9" in YOLOv8's output
layout [1, 4 + classes, N]. The browser tests use it to check the whole card path (onnxruntime-web ->
decode -> SORT -> hold-to-add -> state machine) without any trained model. Needs: pip install onnx numpy
"""
import json
import sys
from pathlib import Path

import numpy as np
import onnx
from onnx import TensorProto, helper, numpy_helper

ROOT = Path(__file__).resolve().parents[2]
CLASSES = json.loads((ROOT / "src/data/contexts.json").read_text())["classes"]
N = 8
SIZE = 640


def main(out: Path) -> None:
    out_t = np.zeros((1, 4 + len(CLASSES), N), dtype=np.float32)
    out_t[0, 0, 0] = SIZE / 2  # centre x
    out_t[0, 1, 0] = SIZE / 2  # centre y
    out_t[0, 2, 0] = 150  # width
    out_t[0, 3, 0] = 200  # height
    out_t[0, 4 + CLASSES.index("Doctor"), 0] = 0.9
    const = helper.make_node("Constant", [], ["output0"], value=numpy_helper.from_array(out_t))
    graph = helper.make_graph(
        [const],
        "const-yolo",
        [helper.make_tensor_value_info("images", TensorProto.FLOAT, [1, 3, SIZE, SIZE])],
        [helper.make_tensor_value_info("output0", TensorProto.FLOAT, list(out_t.shape))],
    )
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 13)])
    model.ir_version = 8
    onnx.checker.check_model(model)
    out.parent.mkdir(parents=True, exist_ok=True)
    onnx.save(model, out)
    meta = {
        "format": "signscribe-cards", "version": 1, "classes": CLASSES, "inputSize": SIZE, "output": "yolov8",
        "meta": {"trainedAt": "2026-01-01T00:00:00+00:00", "datasetSha256": "fixture", "images": 0, "synthetic": True, "evaluation": None},
    }
    (out.parent / "const-yolo.cards.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(f"wrote {out} and const-yolo.cards.json")


if __name__ == "__main__":
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "tests/fixtures/const-yolo.onnx")
