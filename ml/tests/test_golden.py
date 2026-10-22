"""The Python side of the golden-file checks shared with the TypeScript tests."""
import json
from pathlib import Path

import pytest

from signscribe_ml import dollar
from signscribe_ml.features import static_features

HERE = Path(__file__).parent


def test_feature_golden_file_is_current():
    g = json.loads((HERE / "golden_features.json").read_text())
    for c in g["cases"]:
        got = static_features(c["landmarks"], c["width"], c["height"], c["mirror"])
        assert got == pytest.approx(c["expected"], abs=1e-12)


def test_dollar_golden_file_is_current():
    g = json.loads((HERE / "golden_dollar.json").read_text())
    for c in g["cases"]:
        got = dollar.normalize(c["thin"])
        assert got == pytest.approx([tuple(p) for p in c["normalized"]], abs=1e-12)
    for p in g["pairs"]:
        a = dollar.normalize(g["cases"][p["a"]]["path"])
        b = dollar.normalize(g["cases"][p["b"]]["thin"])
        assert dollar.greedy_cloud_match(a, b) == pytest.approx(p["distance"], abs=1e-12)


def test_our_dollar_port_matches_dollarpy():
    dp = pytest.importorskip("dollarpy")
    g = json.loads((HERE / "golden_dollar.json").read_text())
    templates_ours = [(c["label"], c["path"]) for c in g["cases"]]
    templates_dp = [dp.Template(c["label"], [dp.Point(x, y, 1) for x, y in c["path"]]) for c in g["cases"]]
    recognizer = dp.Recognizer(templates_dp)
    for c in g["cases"]:
        name_dp, score_dp = recognizer.recognize([dp.Point(x, y, 1) for x, y in c["thin"]])
        name_ours, score_ours = dollar.recognize(c["thin"], templates_ours)
        assert name_dp == name_ours
        assert score_dp == pytest.approx(score_ours, abs=1e-9)


def test_golden_takes_are_accepted_by_the_python_reader():
    from signscribe_ml.dataset import read_takes

    takes, _ = read_takes(HERE / "golden_takes.jsonl")
    assert [t.kind for t in takes] == ["static", "dynamic"]


def test_golden_model_is_valid_and_predictions_are_current():
    import numpy as np

    from signscribe_ml import knn

    g = json.loads((HERE / "golden_model.json").read_text())
    m = g["model"]
    X = np.asarray(m["vectors"])
    y = [m["labels"][i] for i in m["y"]]
    for q in g["queries"]:
        f = static_features(q["landmarks"], q["width"], q["height"], False)
        label, conf, _ = knn.predict(X, y, np.asarray(f), m["k"])
        assert label == q["label"] and conf == pytest.approx(q["confidence"], abs=1e-12)
