"""The neural network as a browser model: export, rules, the Python forward pass and the golden file the TypeScript side is checked against.
GENERATED data: this proves the arithmetic, not any accuracy."""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest

from signscribe_ml import knn, mlp_model, synth
from signscribe_ml.dataset import parse_take
from signscribe_ml.mlp import MLP

ML = Path(__file__).parent.parent
GOLDEN = json.loads((Path(__file__).parent / "golden_mlp.json").read_text())


def takes(labels="ABC", per=4):
    return [parse_take(t, 0, list("ABCDEF")) for t in synth.static_takes(labels=labels, signers=("s1", "s2"), takes_per=per, frames=3, seed=2)]


def trained():
    X, y, _ = knn.build_samples(takes())
    return MLP(epochs=8, seed=1).fit(X, y), X


def test_the_exported_model_follows_the_documented_format_and_passes_the_rules():
    net, _ = trained()
    m = mlp_model.export_model(net, "a" * 64, 24, 2, True)
    assert (m["format"], m["version"], m["type"], m["features"]) == ("signscribe-model", 1, "mlp", "hand60-v1")
    assert m["labels"] == ["A", "B", "C"]
    assert [len(L["w"]) for L in m["layers"]] == [60, 64, 32] and [len(L["b"]) for L in m["layers"]] == [64, 32, 3]  # 60-64-32-C
    assert len(m["standardize"]["mean"]) == len(m["standardize"]["std"]) == 60
    assert mlp_model.check(m) == []


@pytest.mark.parametrize(
    "mutate,msg",
    [
        (lambda m: m.update(type="knn"), "not a signscribe mlp"),
        (lambda m: m.update(features="other"), "features"),
        (lambda m: m["layers"][0].update(w=m["layers"][0]["w"][:59]), "60 rows"),
        (lambda m: m["layers"][1].update(b=[0.0]), "must all have"),
        (lambda m: m.update(labels=["A", "B"]), "outputs but there are 2 labels"),
        (lambda m: m["standardize"].update(std=[0.0] * 60), "positive"),
        (lambda m: m["standardize"].update(mean=[0.0]), "60 numbers"),
        (lambda m: m.update(layers=[]), "non-empty"),
    ],
)
def test_a_broken_model_is_refused_with_a_reason(mutate, msg):
    net, _ = trained()
    m = json.loads(json.dumps(mlp_model.export_model(net, "a" * 64, 24, 2, True)))
    mutate(m)
    assert any(msg in e for e in mlp_model.check(m)), mlp_model.check(m)


def test_the_forward_pass_from_the_json_matches_the_trained_network_up_to_the_stored_rounding():
    net, X = trained()
    m = mlp_model.export_model(net, "a" * 64, 24, 2, True)
    p = mlp_model.forward(m, X[:20])
    assert np.allclose(p, net.predict_proba(X[:20]), atol=1e-3)
    assert np.allclose(p.sum(axis=1), 1.0) and (p >= 0).all()


def test_the_golden_file_is_consistent_and_its_model_is_valid():
    assert mlp_model.check(GOLDEN["model"]) == [] and GOLDEN["model"]["meta"]["synthetic"] is True
    for c in GOLDEN["feature_cases"]:
        assert np.allclose(mlp_model.forward(GOLDEN["model"], [c["features"]])[0], c["probs"], atol=1e-12)
    from signscribe_ml.features import static_features

    for c in GOLDEN["landmark_cases"]:
        f = static_features(c["landmarks"], c["width"], c["height"], mirror_x=c["mirror"])
        assert np.allclose(f, c["features"], atol=1e-12) and np.allclose(mlp_model.forward(GOLDEN["model"], [f])[0], c["probs"], atol=1e-12)


def test_validate_model_accepts_it_and_warns_that_it_is_synthetic(tmp_path, capsys):
    import validate_model

    net, _ = trained()
    p = tmp_path / "m.json"
    p.write_text(json.dumps(mlp_model.export_model(net, "a" * 64, 24, 2, True)))
    assert validate_model.main(["x", str(p)]) == 0
    assert "WARNING: trained on synthetic data" in capsys.readouterr().out


def write_takes(path, ts):
    path.write_text("".join(json.dumps({"v": 1, "id": t.id, "label": t.label, "kind": "static", "signer": t.signer, "session": t.session, "hand": "right", "width": t.width, "height": t.height, "synthetic": True, "person": t.signer, "frames": [{"t": a, "lm": b} for a, b in t.frames]}) + "\n" for t in ts))


def test_the_export_script_trains_on_all_takes_refuses_synthetic_and_never_writes_the_takes(tmp_path):
    import export_mlp

    f = tmp_path / "t.jsonl"
    write_takes(f, takes())
    out = tmp_path / "m" / "letters-mlp.json"
    assert export_mlp.main(["--data", str(f), "--out", str(out), "--alphabet", "asl"]) == 2  # synthetic without the flag
    assert not out.exists()
    assert export_mlp.main(["--data", str(f), "--out", str(out), "--alphabet", "asl", "--allow-synthetic", "--augment", "rotate"]) == 0
    m = json.loads(out.read_text())
    assert mlp_model.check(m) == [] and m["meta"]["takes"] == 24 and m["meta"]["synthetic"] is True and len(m["meta"]["datasetSha256"]) == 64
    assert m["meta"]["evaluation"] is None
    rep = out.with_suffix(".report.md").read_text()
    assert "SYNTHETIC" in rep and "no accuracy is reported here" in rep
    assert "frames" not in out.read_text() and '"lm"' not in out.read_text()  # the takes themselves are not in the model


def test_an_evaluation_is_attached_only_when_it_was_made_on_exactly_these_takes(tmp_path):
    import evaluate, export_mlp

    f = tmp_path / "t.jsonl"
    ts = []
    for t in takes(per=3):
        ts.append(t)
    rows = [{"v": 1, "id": t.id, "label": t.label, "kind": "static", "signer": t.signer, "session": t.session, "hand": "right", "width": t.width, "height": t.height, "synthetic": True, "person": t.signer, "frames": [{"t": a, "lm": b} for a, b in t.frames]} for t in ts]
    f.write_text("".join(json.dumps(r) + "\n" for r in rows))
    rd = tmp_path / "r"
    assert evaluate.main(["--data", str(f), "--dataset-name", "G", "--dataset-version", "0", "--allow-synthetic", "--alphabet", "asl", "--models", "knn,mlp", "--out-dir", str(rd)]) == 0
    ej = next(rd.glob("*.json"))
    out = tmp_path / "m.json"
    assert export_mlp.main(["--data", str(f), "--out", str(out), "--alphabet", "asl", "--allow-synthetic", "--augment", "none", "--evaluation-json", str(ej)]) == 0
    ev = json.loads(out.read_text())["meta"]["evaluation"]
    assert ev["source"] == "ml/evaluate.py" and ev["method"].startswith("leave-one") and 0.0 <= ev["pooledAccuracy"] <= 1.0
    other = tmp_path / "o.jsonl"
    other.write_text(f.read_text() + json.dumps({**rows[0], "id": "extra"}) + "\n")
    assert export_mlp.main(["--data", str(other), "--out", str(tmp_path / "x.json"), "--alphabet", "asl", "--allow-synthetic", "--augment", "none", "--evaluation-json", str(ej)]) == 2
