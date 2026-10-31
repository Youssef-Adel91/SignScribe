"""The 'none' class: takes of everything that is not a letter (hand moving, relaxed hand, hand in the command zone).
GENERATED data: proves the format and the plumbing, nothing about how well a model separates real 'none' from letters."""
import json

import pytest

import export_arsl
import validate_model
from signscribe_ml import evaluation, synth
from signscribe_ml.alphabet import NONE_TAGS, REJECT_LABEL, load_alphabet
from signscribe_ml.dataset import DatasetError, parse_take, summary

ARSL = load_alphabet("arsl")


def take(label="none", kind="static", **extra):
    t = synth.static_takes(labels=["ain"], signers=("p1",), takes_per=1, frames=2, seed=4)[0]
    t.update(label=label, kind=kind, **extra)
    return t


def test_none_is_a_label_of_every_alphabet_without_being_in_any_file():
    assert REJECT_LABEL == "none"
    assert REJECT_LABEL not in ARSL.labels and REJECT_LABEL not in load_alphabet("asl").labels
    assert parse_take(take(), 0, list(ARSL.labels)).label == "none"


@pytest.mark.parametrize("tag", NONE_TAGS)
def test_each_tag_is_accepted(tag):
    parse_take(take(tag=tag), 0, list(ARSL.labels))


def test_a_bad_tag_and_a_moving_none_take_are_refused():
    with pytest.raises(DatasetError, match="tag"):
        parse_take(take(tag="waving"), 0, list(ARSL.labels))
    dyn = take(kind="dynamic")
    dyn["frames"] = dyn["frames"] * 5
    with pytest.raises(DatasetError, match="static"):
        parse_take(dyn, 0, list(ARSL.labels))


def test_other_unknown_labels_are_still_refused():
    with pytest.raises(DatasetError, match="label must be"):
        parse_take(take(label="nothing"), 0, list(ARSL.labels))


def write(path, rows):
    path.write_text("".join(json.dumps(r) + "\n" for r in rows), encoding="utf-8")


def dataset(tmp_path):
    rows = []
    for p in ("p1", "p2", "p3"):
        for t in synth.static_takes(labels=["ain", "bb", "dal"], signers=(p,), takes_per=2, frames=2, seed=3):
            t.update(person=p, id=f"{p}-{t['id']}")
            rows.append(t)
        for tag in NONE_TAGS:
            n = synth.static_takes(labels=["ain"], signers=(p,), takes_per=1, frames=2, seed=9)[0]
            n.update(label="none", tag=tag, person=p, id=f"{p}-none-{tag}")
            rows.append(n)
    f = tmp_path / "d.jsonl"
    write(f, rows)
    return f


def test_the_none_class_trains_and_is_evaluated_like_any_other(tmp_path):
    from signscribe_ml.dataset import read_takes

    takes, _ = read_takes(str(dataset(tmp_path)), list(ARSL.labels))
    assert summary(takes)["takes"] == 3 * (6 + 4)
    res = evaluation.run(takes, ("knn",), k=3)
    assert "none" in res["labels"]


def test_an_exported_model_with_none_passes_the_alphabet_check(tmp_path):
    out = tmp_path / "m"
    assert export_arsl.main(["--data", str(dataset(tmp_path)), "--out-dir", str(out), "--allow-synthetic", "--max-per-class", "6"]) == 0
    for name in ("letters-arsl-mlp.json", "letters-arsl-knn.json"):
        m = json.loads((out / name).read_text())
        assert "none" in m["labels"]
        assert [e for e in validate_model.check(m) if not e.startswith("WARNING")] == []
        assert validate_model.check_alphabet(m, "arsl") == []
