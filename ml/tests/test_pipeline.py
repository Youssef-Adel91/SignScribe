"""Pipeline mechanics on SYNTHETIC data. Nothing here says anything about accuracy on real hands."""
import json
import subprocess
import sys
from pathlib import Path

import pytest

from signscribe_ml import dataset, knn, motion, synth
from signscribe_ml.dataset import DatasetError, parse_take, read_takes

ML = Path(__file__).parent.parent


@pytest.fixture()
def data(tmp_path):
    p = tmp_path / "takes.jsonl"
    synth.write_jsonl(p, synth.static_takes() + synth.dynamic_takes())
    return p


def test_reads_and_summarises(data):
    takes, sha = read_takes(data)
    s = dataset.summary(takes)
    assert s["synthetic"] and s["signers"] == 2 and len(sha) == 64
    assert set(s["per_label"]) == set("ABCDEJZ")


@pytest.mark.parametrize(
    "mutate,msg",
    [
        (lambda t: t.pop("label"), "missing field 'label'"),
        (lambda t: t.update(label="AB"), "one letter"),
        (lambda t: t.update(v=2), "version"),
        (lambda t: t.update(frames=[]), "at least one frame"),
        (lambda t: t["frames"][0].update(lm=t["frames"][0]["lm"][:20]), "21 landmarks"),
        (lambda t: t.update(hand="both"), "hand"),
    ],
)
def test_bad_takes_are_rejected_with_a_clear_message(mutate, msg):
    t = synth.static_takes(labels="A", signers=("s",), takes_per=1)[0]
    mutate(t)
    with pytest.raises(DatasetError, match=msg):
        parse_take(t, 3)


def test_duplicate_ids_and_bad_json_are_rejected(tmp_path):
    t = synth.static_takes(labels="A", signers=("s",), takes_per=1)[0]
    p = tmp_path / "a.jsonl"
    p.write_text(json.dumps(t) + "\n" + json.dumps(t) + "\n")
    with pytest.raises(DatasetError, match="same id"):
        read_takes(p)
    p.write_text("{nope\n")
    with pytest.raises(DatasetError, match="not valid JSON"):
        read_takes(p)


def test_two_signers_use_leave_one_signer_out(data):
    takes, _ = read_takes(data)
    ev = knn.evaluate(takes, 3)
    assert ev["method"] == "leave-one-signer-out" and ev["groups"] == 2


def test_one_signer_one_session_says_it_is_optimistic():
    takes = [parse_take(t) for t in synth.static_takes(signers=("only",), takes_per=5)]
    ev = knn.evaluate(takes, 3)
    assert "optimistic" in ev["method"]


def test_frames_of_one_take_never_straddle_train_and_test():
    takes = [parse_take(t) for t in synth.static_takes(signers=("only",), takes_per=5)]
    _, groups = knn.make_folds(takes)
    X, y, tk = knn.build_samples(takes)
    by_take = {}
    for ti in set(tk):
        by_take[ti] = {groups[ti]}
    assert all(len(g) == 1 for g in by_take.values())


def test_a_mirrored_left_hander_looks_like_a_right_hander():
    rng_take = synth.static_takes(labels="A", signers=("s",), takes_per=1, frames=1, sigma=0.0)[0]
    left = json.loads(json.dumps(rng_take))
    left["hand"] = "left"
    for f in left["frames"]:
        f["lm"] = [[1 - x, y, z] for x, y, z in f["lm"]]
    from signscribe_ml.features import static_features

    r = static_features(rng_take["frames"][0]["lm"], 640, 480, False)
    l = static_features(left["frames"][0]["lm"], 640, 480, True)
    assert max(abs(a - b) for a, b in zip(r, l)) < 1e-9


def run(script, *args):
    return subprocess.run([sys.executable, str(ML / script), *args], capture_output=True, text=True)


def test_synthetic_data_is_refused_without_the_flag(data, tmp_path):
    r = run("train_knn.py", "--data", str(data), "--out", str(tmp_path / "m.json"))
    assert r.returncode == 2 and "synthetic" in r.stderr
    assert not (tmp_path / "m.json").exists()


def test_train_knn_writes_a_valid_marked_model_and_a_report(data, tmp_path):
    out = tmp_path / "letters.json"
    r = run("train_knn.py", "--data", str(data), "--out", str(out), "--allow-synthetic", "--tune")
    assert r.returncode == 0, r.stderr
    m = json.loads(out.read_text())
    assert m["type"] == "knn" and m["meta"]["synthetic"] is True and m["features"] == "hand60-v1"
    assert len(m["vectors"]) == len(m["y"]) and all(len(v) == 60 for v in m["vectors"])
    rep = out.with_suffix(".report.md").read_text()
    assert "SYNTHETIC DATA" in rep and "leave-one-signer-out" in rep
    v = run("validate_model.py", str(out))
    assert v.returncode == 0 and "WARNING" in v.stdout


def test_train_dollar_writes_templates(data, tmp_path):
    out = tmp_path / "motion.json"
    r = run("train_dollar.py", "--data", str(data), "--out", str(out), "--allow-synthetic")
    assert r.returncode == 0, r.stderr
    m = json.loads(out.read_text())
    assert m["type"] == "dollarP" and {t["label"] for t in m["templates"]} == {"J", "Z"}
    assert run("validate_model.py", str(out)).returncode == 0


def test_validator_rejects_a_broken_model(tmp_path):
    p = tmp_path / "bad.json"
    p.write_text(json.dumps({"format": "signscribe-model", "version": 1, "type": "knn", "features": "hand60-v1", "labels": ["A"], "vectors": [[0] * 59], "y": [0], "k": 0, "meta": {}}))
    r = run("validate_model.py", str(p))
    assert r.returncode == 1 and "need at least 2 labels" in r.stdout


def test_max_per_class_caps_the_stored_samples(data, tmp_path):
    takes, sha = read_takes(data)
    m = knn.export_model(takes, 3, 5, sha, None, True)
    from collections import Counter

    assert max(Counter(m["y"]).values()) <= 5


def test_motion_templates_classify_their_own_shape(data):
    takes, _ = read_takes(data)
    ev = motion.evaluate(takes, 8)
    assert set(ev["truth"]) == {"J", "Z"}
