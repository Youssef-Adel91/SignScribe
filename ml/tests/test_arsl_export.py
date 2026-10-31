"""The two ArSL model files the app loads: made by documented commands from one takes file, same alphabet and class order.
GENERATED takes (the 32 ArSL21L class ids on generated hands): this proves the pipeline and the rules, not any accuracy."""
import json
import subprocess
import sys
from pathlib import Path

import pytest

import export_arsl
import validate_model
from signscribe_ml import synth
from signscribe_ml.alphabet import load_alphabet

ROOT = Path(__file__).parent.parent.parent
ARSL = load_alphabet("arsl")


def write_takes(path, labels, persons=("p1", "p2", "p3")):
    rows = []
    for p in persons:
        for t in synth.static_takes(labels=labels, signers=(p,), takes_per=2, frames=2, seed=3):
            t.update(person=p, id=f"{p}-{t['id']}")
            rows.append(t)
    path.write_text("".join(json.dumps(r) + "\n" for r in rows), encoding="utf-8")
    return path


@pytest.fixture(scope="module")
def exported(tmp_path_factory):
    d = tmp_path_factory.mktemp("arsl")
    data = write_takes(d / "arsl.jsonl", list(ARSL.static))
    out = d / "models"
    assert export_arsl.main(["--data", str(data), "--out-dir", str(out), "--allow-synthetic", "--max-per-class", "4"]) == 0
    return data, out


def test_it_writes_the_two_files_the_app_loads_for_arsl(exported):
    _, out = exported
    assert sorted(p.name for p in out.glob("*.json")) == ["letters-arsl-knn.json", "letters-arsl-mlp.json"]


def test_both_files_list_the_same_classes_in_the_same_order_all_from_the_alphabet_file(exported):
    _, out = exported
    mlp = json.loads((out / "letters-arsl-mlp.json").read_text())
    knn = json.loads((out / "letters-arsl-knn.json").read_text())
    assert mlp["labels"] == knn["labels"] == sorted(ARSL.static)
    assert set(mlp["labels"]) <= set(ARSL.labels)
    assert (mlp["type"], knn["type"]) == ("mlp", "knn")
    assert mlp["features"] == knn["features"] == "hand60-v1"


def test_both_files_pass_the_browser_rules_and_the_alphabet_check(exported):
    _, out = exported
    for name in ("letters-arsl-mlp.json", "letters-arsl-knn.json"):
        m = json.loads((out / name).read_text())
        assert [e for e in validate_model.check(m) if not e.startswith("WARNING")] == []
        assert validate_model.check_alphabet(m, "arsl") == []


def test_a_model_for_another_alphabet_fails_the_alphabet_check(tmp_path):
    asl_takes = write_takes(tmp_path / "asl.jsonl", list("ABCD"))
    out = tmp_path / "m"
    assert export_arsl.main(["--data", str(asl_takes), "--alphabet", "asl", "--out-dir", str(out), "--allow-synthetic", "--max-per-class", "4"]) == 0
    m = json.loads((out / "letters-asl-mlp.json").read_text())
    assert validate_model.check_alphabet(m, "arsl") != []
    assert "another alphabet" in validate_model.check_alphabet(m, "arsl")[0]


def test_running_it_again_gives_the_same_models_except_the_time(exported, tmp_path):
    data, out = exported
    again = tmp_path / "again"
    assert export_arsl.main(["--data", str(data), "--out-dir", str(again), "--allow-synthetic", "--max-per-class", "4"]) == 0
    for name in ("letters-arsl-mlp.json", "letters-arsl-knn.json"):
        a, b = (json.loads((d / name).read_text()) for d in (out, again))
        a["meta"].pop("trainedAt"), b["meta"].pop("trainedAt")
        assert a == b, name


def test_synthetic_takes_are_refused_without_the_flag(tmp_path, capsys):
    data = write_takes(tmp_path / "a.jsonl", list(ARSL.static))
    assert export_arsl.main(["--data", str(data), "--out-dir", str(tmp_path / "o")]) == 2
    assert "synthetic" in capsys.readouterr().err
    assert not list((tmp_path / "o").glob("*.json"))


def test_the_commands_are_documented_in_the_readme():
    text = (ROOT / "ml" / "README.md").read_text(encoding="utf-8")
    for needle in ("ml/export_arsl.py", "letters-arsl-mlp.json", "letters-arsl-knn.json", "ml/export_mlp.py", "ml/train_knn.py"):
        assert needle in text


def test_the_cli_validator_takes_the_alphabet_option(exported):
    _, out = exported
    ok = subprocess.run([sys.executable, str(ROOT / "ml" / "validate_model.py"), str(out / "letters-arsl-knn.json"), "--alphabet", "arsl"], capture_output=True, text=True)
    assert ok.returncode == 0 or "WARNING" in ok.stdout  # synthetic warning is not a failure
    bad = subprocess.run([sys.executable, str(ROOT / "ml" / "validate_model.py"), str(out / "letters-arsl-knn.json"), "--alphabet", "asl"], capture_output=True, text=True)
    assert bad.returncode == 1 and "another alphabet" in bad.stdout
