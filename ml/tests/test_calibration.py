"""Confidence calibration tables. GENERATED data: this proves the arithmetic and the guards, not how good any model is."""
import json

import pytest

import calibrate
from signscribe_ml import calibration as cal
from test_arsl_export import write_takes


def test_the_table_counts_shown_and_right_at_each_threshold():
    truth = ["a", "a", "a", "a", "b", "b"]
    pred = ["a", "a", "b", "a", "b", "a"]
    conf = [0.9, 0.8, 0.7, 0.4, 0.95, 0.3]
    rows = {r["threshold"]: r for r in cal.table(truth, pred, conf, [0, 0.5, 0.85, 1.0])}
    assert rows[0]["shown"] == 6 and rows[0]["coverage"] == 1.0 and rows[0]["precision"] == pytest.approx(4 / 6)
    assert rows[0.5]["shown"] == 4  # 0.9, 0.8, 0.7, 0.95
    assert rows[0.5]["precision"] == pytest.approx(3 / 4)
    assert rows[0.5]["wrong_shown_per_100"] == pytest.approx(100 * 1 / 6)
    assert rows[0.85]["shown"] == 2 and rows[0.85]["precision"] == 1.0
    assert rows[1.0]["shown"] == 0 and rows[1.0]["precision"] is None and rows[1.0]["precision_ci95"] is None


def test_a_prediction_exactly_at_the_threshold_is_shown():
    assert cal.table(["a"], ["a"], [0.7], [0.7])[0]["shown"] == 1


def test_coverage_never_grows_with_the_threshold():
    import random

    r = random.Random(1)
    conf = [r.random() for _ in range(200)]
    truth = ["a"] * 200
    pred = [("a" if r.random() < c else "b") for c in conf]
    cov = [row["coverage"] for row in cal.table(truth, pred, conf)]
    assert cov == sorted(cov, reverse=True)


def test_the_interval_contains_the_estimate_and_narrows_with_more_data():
    lo, hi = cal.wilson(9, 10)
    lo2, hi2 = cal.wilson(900, 1000)
    assert lo < 0.9 < hi and lo2 < 0.9 < hi2 and (hi2 - lo2) < (hi - lo)
    assert cal.wilson(0, 0) is None


def test_bad_input_is_refused():
    with pytest.raises(cal.CalibrationError):
        cal.table([], [], [])
    with pytest.raises(cal.CalibrationError):
        cal.table(["a"], ["a", "b"], [0.5])


# ---------------------------------------------------------------- the command
@pytest.fixture
def data(tmp_path):
    from signscribe_ml.alphabet import load_alphabet

    return write_takes(tmp_path / "arsl.jsonl", list(load_alphabet("arsl").static)[:6])


BASE = ["--alphabet", "arsl", "--dataset-name", "GEN", "--dataset-version", "0", "--allow-synthetic", "--augment", "none"]


def test_leave_one_person_out_gives_one_table_per_model_and_no_person_id(data, tmp_path, capsys):
    out = tmp_path / "r"
    assert calibrate.main(["--data", str(data), *BASE, "--out-dir", str(out), "--thresholds", "0,0.5,0.9"]) == 0
    text = capsys.readouterr().out
    assert "### knn" in text and "### mlp" in text
    assert "vote" in text and "softmax" in text  # each model says what its confidence is
    assert "SYNTHETIC DATA" in text
    assert "p1" not in text and "p2" not in text  # the persons in the generated data are called p1, p2, p3
    j = json.loads(next(out.glob("calibration-*.json")).read_text())
    assert set(j["models"]) == {"knn", "mlp"}
    assert [r["threshold"] for r in j["models"]["knn"]["rows"]] == [0, 0.5, 0.9]
    assert "group" not in json.dumps(j) and "p1" not in json.dumps(j)
    assert j["provenance"]["dataset_sha256"] in next(out.glob("calibration-*.md")).read_text()


def test_a_model_can_be_asked_for_alone(data, tmp_path, capsys):
    assert calibrate.main(["--data", str(data), *BASE, "--models", "knn", "--out-dir", str(tmp_path / "r")]) == 0
    text = capsys.readouterr().out
    assert "### knn" in text and "### mlp" not in text


def test_train_and_test_uses_only_the_test_recordings(data, tmp_path, capsys):
    from signscribe_ml.alphabet import load_alphabet

    mine = write_takes(tmp_path / "mine.jsonl", list(load_alphabet("arsl").static)[:6], persons=("webcam",))
    # different ids so the same take is never on both sides
    rows = [json.loads(l) for l in mine.read_text().splitlines()]
    for r in rows:
        r["id"] = "mine-" + r["id"]
    mine.write_text("".join(json.dumps(r) + "\n" for r in rows))
    assert calibrate.main(["--train", str(data), "--test", str(mine), "--test-name", "team webcam", *BASE, "--out-dir", str(tmp_path / "r")]) == 0
    text = capsys.readouterr().out
    assert "not a leave-one-person-out result" in text and "test recordings sha256" in text
    n_test_frames = sum(len(r["frames"]) for r in rows)
    j = json.loads(next((tmp_path / "r").glob("calibration-*.json")).read_text())
    assert j["models"]["knn"]["frames"] == n_test_frames


def test_synthetic_data_is_refused_without_the_flag(data, tmp_path, capsys):
    args = [a for a in BASE if a != "--allow-synthetic"]
    assert calibrate.main(["--data", str(data), *args, "--out-dir", str(tmp_path / "r")]) == 2
    assert "synthetic" in capsys.readouterr().err
    assert not (tmp_path / "r").exists() or not list((tmp_path / "r").glob("calibration-*"))


@pytest.mark.parametrize("extra", [[], ["--train", "x.jsonl"], ["--data", "a.jsonl", "--train", "b.jsonl", "--test", "c.jsonl"]])
def test_it_needs_data_or_train_and_test(extra, capsys):
    assert calibrate.main([*extra, "--dataset-name", "n", "--dataset-version", "v"]) == 2
    assert "either --data, or both" in capsys.readouterr().err


def test_thresholds_must_be_between_0_and_1(data, tmp_path, capsys):
    assert calibrate.main(["--data", str(data), *BASE, "--thresholds", "0.5,1.5", "--out-dir", str(tmp_path / "r")]) == 2
    assert "between 0 and 1" in capsys.readouterr().err


def test_running_it_leaves_the_thresholds_file_untouched(data, tmp_path):
    from pathlib import Path

    f = Path(__file__).parent.parent.parent / "src" / "recognition" / "letterController.ts"
    before = f.read_bytes()
    assert calibrate.main(["--data", str(data), *BASE, "--out-dir", str(tmp_path / "r")]) == 0
    assert f.read_bytes() == before
    assert sorted(p.suffix for p in (tmp_path / "r").iterdir()) == [".json", ".md"]  # it writes its own report and nothing else


def test_names_are_optional_and_the_shipped_augmentation_is_the_default(data, tmp_path, capsys):
    out = tmp_path / "r"
    assert calibrate.main(["--data", str(data), "--alphabet", "arsl", "--allow-synthetic", "--out-dir", str(out)]) == 0
    text = capsys.readouterr().out
    assert "# Confidence calibration: arsl unspecified" in text  # file name arsl.jsonl, version unspecified
    assert "augmentation (training side only): " in text and "none" not in text.split("augmentation (training side only): ")[1].split(",")[0]
    assert calibrate.main(["--data", str(data), "--alphabet", "arsl", "--augment", "none", "--allow-synthetic", "--out-dir", str(out)]) == 0
    assert "augmentation (training side only): none" in capsys.readouterr().out


def test_the_wrong_alphabet_gets_a_hint_with_the_working_command(data, tmp_path, capsys):
    assert calibrate.main(["--data", str(data), "--allow-synthetic", "--out-dir", str(tmp_path / "r")]) == 2
    err = capsys.readouterr().err
    assert "--alphabet arsl" in err and "python ml/calibrate.py --data ml/data/arsl21l.jsonl --alphabet arsl" in err


def test_the_readme_has_the_exact_working_command():
    from pathlib import Path

    text = (Path(__file__).parent.parent / "README.md").read_text(encoding="utf-8")
    assert "python ml/calibrate.py --data ml/data/arsl21l.jsonl --alphabet arsl" in text
    assert "same predictions as the row above" in text


def test_identical_high_threshold_rows_are_marked():
    truth, pred = ["a"] * 6, ["a", "a", "a", "a", "b", "a"]
    conf = [1.0, 1.0, 1.0, 1.0, 0.6, 0.7]
    res = {"models": {"knn": {"truth": truth, "pred": pred, "conf": conf}}}
    table = cal.build(res, [0.0, 0.8, 0.9, 0.99])
    md = cal.markdown(table, {"knn": "a vote share"}, "test")
    assert md.count("same predictions as the row above") == 2  # 0.90 and 0.99 repeat 0.80
    assert "A threshold between two such rows changes nothing" in md
