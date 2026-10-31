"""Controls (space, done = static hand shapes; delete, cancel = strokes of the index fingertip) next to the letters and the 'none' class.
GENERATED data: proves the format, the arithmetic and the guards, not how well any model separates real controls from real letters."""
import json
import math
import random

import numpy as np
import pytest

import evaluate
import export_arsl
from signscribe_ml import controls_report as cr
from signscribe_ml import synth
from signscribe_ml.alphabet import AlphabetError, load_alphabet
from signscribe_ml.dataset import read_takes

ARSL = load_alphabet("arsl")
PEOPLE = ("p1", "p2", "p3")


def test_the_arsl_file_has_four_controls_two_static_and_two_dynamic():
    assert ARSL.controls == {"ctl_space": "space", "ctl_done": "done", "ctl_delete": "delete", "ctl_cancel": "cancel"}
    assert {k: ARSL.control_kind(k) for k in ARSL.controls} == {"ctl_space": "static", "ctl_done": "static", "ctl_delete": "dynamic", "ctl_cancel": "dynamic"}
    assert len(ARSL.letters) == 32 and ARSL.control_kind("ain") is None
    assert not any(l.startswith("ctl_") for l in ARSL.letters)


def test_the_file_rules_match_the_browser(tmp_path):
    from signscribe_ml.alphabet import _controls

    assert _controls({"a": "finish"}, ["a", "b"], "x") == {"a": "done"}
    with pytest.raises(AlphabetError, match="not a label"):
        _controls({"zz": "space"}, ["a"], "x")
    with pytest.raises(AlphabetError, match="space, delete, cancel, done"):
        _controls({"a": "jump"}, ["a"], "x")
    with pytest.raises(AlphabetError, match="two classes"):
        _controls({"a": "space", "b": "space"}, ["a", "b"], "x")


# ---------------------------------------------------------------- the arithmetic
def raw(truth, pred, conf):
    return {"truth": truth, "pred": pred, "conf": conf}


def test_static_report_counts_confusion_and_false_triggers():
    truth = ["ctl_space"] * 4 + ["ain"] * 4 + ["none"] * 4
    pred = ["ctl_space", "ctl_space", "ain", "ctl_done"] + ["ain", "ain", "ain", "ctl_space"] + ["none", "ctl_space", "ctl_done", "ain"]
    conf = [0.9, 0.9, 0.9, 0.9] + [0.9, 0.9, 0.9, 0.9] + [0.9, 0.9, 0.4, 0.9]
    r = cr.static_report(raw(truth, pred, conf), ARSL, 0.6)
    sp = r["controls"]["ctl_space"]
    assert sp["frames"] == 4 and sp["recall"] == 0.5
    assert sp["as_letter"] == 0.25 and sp["as_other_control"] == 0.25 and sp["as_none"] == 0
    assert r["letters_shown_as_a_control"] == 0.25  # one of four letter frames
    assert r["false_control_on_letters"]["ctl_space"] == 0.25
    # none frames: one shown as ctl_space (0.9), one as ctl_done at 0.4 is below the confidence limit, one as a letter
    assert r["none_frames"] == 4 and r["none_shown_as_a_control"] == 0.25
    assert r["false_control_on_none"] == {"ctl_space": 0.25, "ctl_done": 0.0}
    assert r["none_shown_as_a_letter"] == 0.25


def test_an_alphabet_without_controls_has_no_report():
    assert cr.static_report(raw(["A"], ["A"], [1.0]), load_alphabet("asl"), 0.6) is None
    assert cr.dynamic_report([], load_alphabet("asl")) is None


# ---------------------------------------------------------------- generated recordings
def strokes(label, i):
    """delete = a swipe to the left, cancel = a swipe down; plain shapes with a little wobble"""
    pts = []
    for s in range(40):
        t = s / 39
        x, y = (0.7 - 0.4 * t, 0.5) if label == "ctl_delete" else (0.5, 0.2 + 0.5 * t)
        pts.append((x + 0.003 * math.sin(i + s), y + 0.003 * math.cos(2 * i + s)))
    return pts


def dyn_take(person, label, i):
    frames = []
    for f, (px, py) in enumerate(strokes(label, i)):
        lm = [[0.5, 0.8, 0.0] for _ in range(21)]
        lm[8] = [px, py, 0.0]
        lm[9] = [0.5, 0.6, 0.0]
        frames.append({"t": f * 33, "lm": lm})
    return {"v": 1, "id": f"{person}-{label}-d{i}", "label": label, "kind": "dynamic", "signer": person, "person": person, "session": "a", "hand": "right", "width": 640, "height": 480, "synthetic": True, "frames": frames}


def none_take(person, tag, i, moving):
    base = synth.static_takes(labels=["ain"], signers=(person,), takes_per=1, frames=2, seed=40 + i)[0]
    frames = []
    r = random.Random(i)
    for f in range(30):
        lm = [list(p) for p in base["frames"][0]["lm"]]
        if moving:  # the fingertip wanders a long way: the app would try to match this path
            lm[8] = [0.3 + 0.4 * r.random(), 0.3 + 0.4 * r.random(), 0.0]
        frames.append({"t": f * 50, "lm": lm})
    base.update(label="none", tag=tag, person=person, id=f"{person}-none-{tag}-{i}", frames=frames)
    return base


def dataset(tmp_path, people=PEOPLE):
    rows = []
    for p in people:
        for t in synth.static_takes(labels=["ain", "bb", "ctl_space", "ctl_done"], signers=(p,), takes_per=3, frames=3, seed=5):
            t.update(person=p, id=f"{p}-{t['id']}")
            rows.append(t)
        for lab in ("ctl_delete", "ctl_cancel"):
            rows += [dyn_take(p, lab, i) for i in range(3)]
        rows += [none_take(p, "relaxed", 1, False), none_take(p, "moving", 2, True), none_take(p, "command-zone", 3, False)]
    f = tmp_path / "d.jsonl"
    f.write_text("".join(json.dumps(r) + "\n" for r in rows), encoding="utf-8")
    return f


def test_dynamic_report_leaves_a_person_out_and_counts_false_triggers(tmp_path):
    takes, _ = read_takes(str(dataset(tmp_path)), ARSL.labels)
    r = cr.dynamic_report(takes, ARSL)
    assert r["groups"] == 3 and "person" in r["method"]
    for k in ("ctl_delete", "ctl_cancel"):
        assert r["controls"][k]["takes"] == 9 and r["controls"][k]["recall"] >= 0.8  # two clearly different strokes
    assert r["none_takes"] == 9
    # relaxed and command-zone none takes hardly move: the app's gate keeps them out; only the wandering ones are tried
    assert r["none_passed_the_gate"] == 3
    assert set(r["none_triggered"]) == {"ctl_delete", "ctl_cancel"}


def test_one_person_cannot_be_left_out():
    from signscribe_ml.dataset import parse_take

    takes = [parse_take(dyn_take("p1", "ctl_delete", i), 0, ARSL.labels) for i in range(3)]
    r = cr.dynamic_report(takes, ARSL)
    assert "only one person" in r["not_evaluated"] and "recall" not in json.dumps(r["controls"])


# ---------------------------------------------------------------- the command
def run_eval(tmp_path, capsys, extra=()):
    data = dataset(tmp_path)
    out = tmp_path / "r"
    code = evaluate.main(["--data", str(data), "--alphabet", "arsl", "--dataset-name", "GEN", "--dataset-version", "0", "--allow-synthetic", "--models", "knn", "--out-dir", str(out), *extra])
    return code, capsys.readouterr().out, out


def test_evaluate_reports_the_controls_next_to_the_letters(tmp_path, capsys):
    code, text, out = run_eval(tmp_path, capsys)
    assert code == 0
    assert "### Controls" in text
    assert "Static controls, knn" in text and "ctl_space" in text and "ctl_done" in text
    assert "'none' frames shown as a control (false trigger)" in text
    assert "letter frames shown as a control" in text
    assert "Dynamic controls ($1" in text and "ctl_delete" in text and "ctl_cancel" in text
    assert "static letter takes" in text
    j = json.loads(next(out.glob("eval-*.json")).read_text())
    ctl = j["runs"][0]["controls"]
    assert set(ctl["static"]["knn"]["controls"]) == {"ctl_space", "ctl_done"}
    assert set(ctl["dynamic"]["controls"]) == {"ctl_delete", "ctl_cancel"}


def test_the_controls_report_names_no_person(tmp_path, capsys):
    _, text, out = run_eval(tmp_path, capsys)
    blob = text + next(out.glob("eval-*.json")).read_text() + next(out.glob("eval-*.md")).read_text()
    assert not any(p in blob.replace("per-person", "") for p in ("p1", "p2", "p3"))


def test_the_report_comes_with_the_train_test_run_too(tmp_path, capsys):
    data = dataset(tmp_path)
    mine = tmp_path / "mine.jsonl"
    rows = [json.loads(l) for l in data.read_text().splitlines()]
    mine_rows = []
    for r in rows:
        if r["person"] == "p3":
            r["id"] = "mine-" + r["id"]
            mine_rows.append(r)
    train_rows = [r for r in rows if r["person"] != "p3"]
    mine.write_text("".join(json.dumps(r) + "\n" for r in mine_rows))
    train = tmp_path / "train.jsonl"
    train.write_text("".join(json.dumps(r) + "\n" for r in train_rows))
    code = evaluate.main(["--train", str(train), "--test", str(mine), "--alphabet", "arsl", "--dataset-name", "GEN", "--dataset-version", "0", "--allow-synthetic", "--models", "knn", "--out-dir", str(tmp_path / "r2")])
    assert code == 0
    assert "### Controls" in capsys.readouterr().out


def test_a_single_person_is_still_refused(tmp_path, capsys):
    data = dataset(tmp_path, people=("p1",))
    assert evaluate.main(["--data", str(data), "--alphabet", "arsl", "--dataset-name", "G", "--dataset-version", "0", "--allow-synthetic", "--models", "knn", "--out-dir", str(tmp_path / "r")]) == 2
    assert "only one" in capsys.readouterr().err


def test_an_alphabet_without_controls_gets_no_controls_section(tmp_path, capsys):
    rows = []
    for p in PEOPLE:
        for t in synth.static_takes(labels="ABC", signers=(p,), takes_per=3, frames=3, seed=5):
            t.update(person=p, id=f"{p}-{t['id']}")
            rows.append(t)
    f = tmp_path / "a.jsonl"
    f.write_text("".join(json.dumps(r) + "\n" for r in rows))
    assert evaluate.main(["--data", str(f), "--alphabet", "asl", "--dataset-name", "G", "--dataset-version", "0", "--allow-synthetic", "--models", "knn", "--out-dir", str(tmp_path / "r")]) == 0
    assert "### Controls" not in capsys.readouterr().out


def test_the_export_writes_the_dollar_model_when_there_are_dynamic_takes(tmp_path):
    data = dataset(tmp_path)
    out = tmp_path / "m"
    assert export_arsl.main(["--data", str(data), "--out-dir", str(out), "--allow-synthetic", "--max-per-class", "6"]) == 0
    m = json.loads((out / "motion-arsl-dollar.json").read_text())
    assert m["type"] == "dollarP" and {t["label"] for t in m["templates"]} == {"ctl_delete", "ctl_cancel"}
    letters = json.loads((out / "letters-arsl-mlp.json").read_text())
    assert "ctl_space" in letters["labels"] and "ctl_done" in letters["labels"] and "ctl_delete" not in letters["labels"]
