"""An evaluation whose held-out group has classes no training group has is not a valid result; and the results file only changes through the tools.
Generated data: this proves the rules, not any accuracy."""
import json
from pathlib import Path

import pytest

from signscribe_ml import evaluation, results_md as rm, synth
from signscribe_ml.dataset import parse_take

ROOT = Path(__file__).resolve().parents[2]


def src_takes(source, labels, per=4, seed=3):
    out = []
    for t in synth.static_takes(labels=labels, signers=(source,), takes_per=per, frames=2, seed=seed):
        t.update(source=source, id=f"{source}-{t['id']}", session=source)
        out.append(parse_take(t, 0, list("ABCDEFGH")))
    return out


def test_a_held_out_source_with_classes_the_training_sources_lack_is_refused_and_says_which():
    takes = src_takes("aslad", "ABCD") + src_takes("csv", "ABC")  # aslad has D, csv has not
    with pytest.raises(evaluation.EvaluationError) as e:
        evaluation.run(takes, ("knn",), k=3)
    msg = str(e.value)
    assert "not valid" in msg and "held-out source 'aslad'" in msg and "D" in msg and "--shared-classes" in msg


def test_with_shared_classes_only_the_classes_every_source_has_are_evaluated_and_the_report_says_so():
    takes = src_takes("aslad", "ABCD") + src_takes("csv", "ABC")
    res = evaluation.run(takes, ("knn", "mlp"), k=3, shared_classes=True)
    assert res["restricted"] == {"classes_kept": 3, "classes_total": 4, "dropped": ["D"]}
    m = res["models"]["knn"]["metrics"]
    assert set(m["per_label"]) == {"A", "B", "C"}  # D is not evaluated at all
    assert m["samples"] == 2 * 3 * 4 * 2
    prov = {"synthetic": True, "command": "c", "date": "d", "git_commit": None, "dataset_name": "n", "dataset_version": "v", "dataset_sha256": "0" * 64, "alphabet": "asl", "takes": 1, "persons": 0, "sources": 2, "signers": 2, "python": "3", "numpy": "2"}
    md = evaluation.markdown(res, prov)
    assert "restricted to the 3 classes that every held-out group has, out of 4" in md and "not evaluated: D" in md


def test_the_augmented_copies_of_a_dropped_class_do_not_reach_training():
    from signscribe_ml.augment import parse_augment

    takes = src_takes("aslad", "ABCD") + src_takes("csv", "ABC")
    res = evaluation.run(takes, ("knn",), k=3, shared_classes=True, augment=parse_augment("rotate"))
    assert res["models"]["knn"]["metrics"]["samples"] == 2 * 3 * 4 * 2 and set(res["models"]["knn"]["truth"]) == {"A", "B", "C"}


def test_sources_that_cover_the_same_classes_are_fine_without_the_flag():
    res = evaluation.run(src_takes("a", "ABC") + src_takes("b", "ABC") + src_takes("c", "ABC"), ("knn",), k=3)
    assert res["method"] == "leave-one-source-out" and res["restricted"] is None


def test_the_groups_must_share_at_least_two_classes():
    with pytest.raises(evaluation.EvaluationError, match="share only"):
        evaluation.run(src_takes("a", "AB") + src_takes("b", "BC"), ("knn",), k=3, shared_classes=True)


def test_for_persons_the_message_never_contains_a_person_id():
    takes = []
    for i, labels in enumerate(["ABC", "ABC", "ABCD"]):
        for t in synth.static_takes(labels=labels, signers=(f"secret{i}",), takes_per=3, frames=2, seed=5):
            t.update(person=f"secret{i}", id=f"{i}-{t['id']}")
            takes.append(parse_take(t, 0, list("ABCDEFGH")))
    with pytest.raises(evaluation.EvaluationError) as e:
        evaluation.run(takes, ("knn",), k=3)
    assert "secret" not in str(e.value) and "a held-out group" in str(e.value)


def test_cli_refuses_then_accepts_with_the_flag(tmp_path, capsys):
    import evaluate

    f = tmp_path / "t.jsonl"
    rows = []
    for t in src_takes("aslad", "ABCD") + src_takes("csv", "ABC"):
        rows.append({"v": 1, "id": t.id, "label": t.label, "kind": "static", "signer": t.signer, "session": t.session, "hand": "right", "width": t.width, "height": t.height, "synthetic": True, "source": t.source, "frames": [{"t": a, "lm": b} for a, b in t.frames]})
    f.write_text("".join(json.dumps(r) + "\n" for r in rows))
    base = ["--data", str(f), "--dataset-name", "GEN", "--dataset-version", "0", "--allow-synthetic", "--out-dir", str(tmp_path / "r"), "--models", "knn", "--alphabet", "asl"]
    assert evaluate.main(base) == 2
    assert "not valid" in capsys.readouterr().err
    assert evaluate.main([*base, "--shared-classes"]) == 0


# ---------------------------------------------------------------- docs/MODEL_RESULTS.md
OLD_TEMPLATE = (ROOT / "docs" / "MODEL_RESULTS.md").read_text(encoding="utf-8")
SEC = "---\n\n## {t}\n\n- command: `python ml/evaluate.py ...`\n- pooled accuracy line written by the script\n"


def old_file_with_two_sections():
    """What an earlier evaluate.py left: the template, with sections simply appended after '(none yet)'."""
    return OLD_TEMPLATE.rstrip("\n") + "\n\n" + SEC.format(t="ArSL21L as published (2026-10-30)") + "\n" + SEC.format(t="ASLAD-96K + ArSL_dataset as published (2026-10-30)")


def test_the_template_says_there_are_no_results_and_a_section_can_be_listed_added_and_replaced():
    assert "There are no results yet" in OLD_TEMPLATE and rm.titles(OLD_TEMPLATE) == []
    one = rm.append_section(OLD_TEMPLATE, "ArSL21L v1 (2026-10-30)", "body A")
    assert rm.titles(one) == ["ArSL21L v1 (2026-10-30)"] and "(none yet)" not in one
    assert "There are no results yet" not in one and "Produced by `ml/evaluate.py` runs on real data" in one and "ArSL21L v1" in one.split("## Results")[0]
    again = rm.append_section(one, "ArSL21L v1 (2026-10-30)", "body B")
    assert rm.titles(again) == ["ArSL21L v1 (2026-10-30)"] and "body B" in again and "body A" not in again


def test_an_invalid_section_is_removed_and_the_first_lines_are_rewritten_to_match():
    text = old_file_with_two_sections()
    assert rm.titles(text) == ["ArSL21L as published (2026-10-30)", "ASLAD-96K + ArSL_dataset as published (2026-10-30)"]
    new, removed = rm.remove_section(text, "ASLAD-96K")
    assert removed == ["ASLAD-96K + ArSL_dataset as published (2026-10-30)"]
    assert rm.titles(new) == ["ArSL21L as published (2026-10-30)"]
    assert "ASLAD" not in new and "There are no results yet" not in new and "(none yet)" not in new
    assert "Produced by `ml/evaluate.py` runs on real data" in new and "ArSL21L as published" in new.split("## Rules")[0]
    # nothing but moving text: no digit that was not in the sections is introduced
    assert new.count("pooled accuracy line written by the script") == 1


def test_removing_everything_gives_the_empty_template_back_and_a_missing_title_removes_nothing():
    only = rm.append_section(OLD_TEMPLATE, "X (d)", "b")
    empty, removed = rm.remove_section(only, "X")
    assert removed == ["X (d)"] and "There are no results yet" in empty and "(none yet)" in empty and rm.titles(empty) == []
    assert rm.remove_section(only, "nothing like this")[1] == []


def test_the_results_tool_cli(tmp_path, capsys):
    import results_md

    f = tmp_path / "R.md"
    f.write_text(old_file_with_two_sections(), encoding="utf-8")
    assert results_md.main([str(f), "--remove", "ASLAD-96K"]) == 0
    assert "removed: ASLAD-96K" in capsys.readouterr().out and "ASLAD" not in f.read_text()
    assert results_md.main([str(f), "--remove", "nope"]) == 1
    assert results_md.main([str(tmp_path / "missing.md"), "--list"]) == 2
