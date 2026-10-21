"""Card tooling checks. Uses made-up folders and the test-only fixture; says nothing about a real detector."""
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest

ML = Path(__file__).parent.parent
ROOT = ML.parent
CARDS = ML / "cards"
CLASSES = json.loads((ROOT / "src/data/contexts.json").read_text())["classes"]


def run(script, *args):
    return subprocess.run([sys.executable, str(CARDS / script), *args], capture_output=True, text=True)


def make_dataset(root: Path, bad_label=None, skip_classes=()):
    for split in ("train", "val"):
        (root / "images" / split).mkdir(parents=True)
        (root / "labels" / split).mkdir(parents=True)
        for i, name in enumerate(CLASSES):
            if i in skip_classes:
                continue
            stem = f"{name}-{i}"
            (root / "images" / split / f"{stem}.jpg").write_bytes(b"x")
            (root / "labels" / split / f"{stem}.txt").write_text(f"{i} 0.5 0.5 0.3 0.4\n")
    if bad_label:
        (root / "labels" / "train" / "Doctor-0.txt").write_text(bad_label)


def test_yaml_is_written_in_class_order(tmp_path):
    make_dataset(tmp_path)
    r = run("make_data_yaml.py", "--root", str(tmp_path))
    assert r.returncode == 0, r.stderr
    yaml = (tmp_path / "cards.yaml").read_text()
    for i, n in enumerate(CLASSES):
        assert f"  {i}: {n}\n" in yaml


@pytest.mark.parametrize(
    "bad,msg",
    [("99 0.5 0.5 0.3 0.4\n", "class 99 does not exist"), ("0 1.5 0.5 0.3 0.4\n", "between 0 and 1"), ("zero 0.5\n", "not '<class>")],
)
def test_bad_labels_are_reported_with_file_and_line(tmp_path, bad, msg):
    make_dataset(tmp_path, bad_label=bad)
    r = run("make_data_yaml.py", "--root", str(tmp_path))
    assert r.returncode == 1 and msg in r.stderr and "Doctor-0.txt line 1" in r.stderr
    assert not (tmp_path / "cards.yaml").exists()


def test_missing_classes_are_warned_about(tmp_path):
    make_dataset(tmp_path, skip_classes=(3,))
    r = run("make_data_yaml.py", "--root", str(tmp_path))
    assert r.returncode == 0 and f"no train examples of: {CLASSES[3]}" in r.stdout


def test_missing_images_and_labels_are_errors(tmp_path):
    assert run("make_data_yaml.py", "--root", str(tmp_path)).returncode == 1
    make_dataset(tmp_path)
    (tmp_path / "labels" / "val" / "Pain-1.txt").unlink()
    r = run("make_data_yaml.py", "--root", str(tmp_path))
    assert r.returncode == 1 and "no label file for images/val/Pain-1.jpg" in r.stderr


def test_export_says_what_is_missing_instead_of_crashing(tmp_path):
    if importlib.util.find_spec("ultralytics"):
        pytest.skip("ultralytics is installed")
    r = run("export_onnx.py", "--weights", "x.pt", "--dataset", str(tmp_path), "--out", str(tmp_path / "c.onnx"))
    assert r.returncode == 2 and "ultralytics is not installed" in r.stderr


def test_the_fixture_passes_check_onnx_and_a_wrong_class_list_does_not(tmp_path):
    pytest.importorskip("onnxruntime")
    fx = ROOT / "tests/fixtures"
    r = run("check_onnx.py", str(fx / "const-yolo.onnx"), str(fx / "const-yolo.cards.json"))
    assert r.returncode == 0 and "OK" in r.stdout, r.stdout + r.stderr
    meta = json.loads((fx / "const-yolo.cards.json").read_text())
    meta["classes"] = meta["classes"][:-1]
    bad = tmp_path / "bad.json"
    bad.write_text(json.dumps(meta))
    r = run("check_onnx.py", str(fx / "const-yolo.onnx"), str(bad))
    assert r.returncode == 1 and "differ" in r.stdout
