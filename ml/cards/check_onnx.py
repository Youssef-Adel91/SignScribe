#!/usr/bin/env python3
"""Opens a card detector and checks it against what the app expects. Needs: pip install onnxruntime numpy"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _common import classes  # noqa: E402


def check(onnx_path: Path, meta_path: Path) -> list:
    import numpy as np
    import onnxruntime as ort

    problems = []
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    names = classes()
    if meta.get("classes") != names:
        problems.append("cards.json classes differ from src/data/contexts.json")
    if meta.get("format") != "signscribe-cards" or meta.get("output") != "yolov8":
        problems.append("cards.json: format must be 'signscribe-cards' and output 'yolov8'")
    size = meta.get("inputSize")
    sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    inp = sess.get_inputs()[0]
    if list(inp.shape[1:]) != [3, size, size]:
        problems.append(f"model input is {inp.shape}, cards.json says {size}x{size}")
    out = sess.run(None, {inp.name: np.zeros((1, 3, size, size), dtype=np.float32)})[0]
    c = 4 + len(names)
    if out.ndim != 3 or out.shape[0] != 1 or c not in (out.shape[1], out.shape[2]):
        problems.append(f"model output is {list(out.shape)}, expected [1, {c}, N] or [1, N, {c}]")
    return problems


def main(argv) -> int:
    if len(argv) not in (2, 3):
        print("usage: check_onnx.py MODEL.onnx [cards.json]", file=sys.stderr)
        return 2
    onnx_path = Path(argv[1])
    meta_path = Path(argv[2]) if len(argv) == 3 else onnx_path.with_name("cards.json")
    problems = check(onnx_path, meta_path)
    for p in problems:
        print(p)
    print("OK" if not problems else f"{len(problems)} problem(s)")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
