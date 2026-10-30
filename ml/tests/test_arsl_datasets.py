"""The flat-folder picture import, the landmark-CSV import, the ArSL21L alphabet and the rule that minors are only counted.

All data here is GENERATED to look like the described file layouts. It says nothing about the real datasets or about accuracy."""
import csv
import json
import sys
from pathlib import Path

import numpy as np
import pytest

from signscribe_ml import evaluation, images
from signscribe_ml import landmark_csv as lc
from signscribe_ml.alphabet import load_alphabet
from signscribe_ml.dataset import parse_take, read_takes

ROOT = Path(__file__).resolve().parents[2]
ARSL = load_alphabet("arsl")
CLASSES = "ain al aleff bb dal dha dhad fa gaaf ghain ha haa jeem kaaf khaa la laam meem nun ra saad seen sheen ta taa thaa thal toot waw ya yaa zay".split()


# ---------------------------------------------------------------- the alphabet
def test_arsl_has_the_32_dataset_classes_and_is_marked_unreviewed_with_open_questions():
    assert ARSL.static == tuple(CLASSES) and len(ARSL.labels) == 32 and ARSL.dynamic == ()
    assert ARSL.reviewed is False
    todo = {c for t in ARSL.todo for c in t["classes"]}
    assert {"ta", "taa", "toot", "ha", "haa", "ya", "yaa"} <= todo


def test_the_ambiguous_classes_have_no_arabic_letter_and_nothing_resolves_to_them_by_a_guess():
    for c in ["ta", "taa", "toot", "ha", "haa", "ya", "yaa", "dha", "dhad"]:
        assert ARSL.display[c] is None, c
    for ch in "تطةهحيىظض":  # Arabic letters of the unsettled classes: never resolved
        assert ARSL.resolve(ch) is None
    assert ARSL.resolve("Space") is None and ARSL.resolve("Delete") is None and ARSL.resolve("Finish") is None
    assert ARSL.resolve("ع") == "ain" and ARSL.resolve("AIN") == "ain" and ARSL.resolve("alef") == "aleff"


def test_every_class_name_resolves_to_itself_and_every_alias_to_a_real_class():
    for c in CLASSES:
        assert ARSL.resolve(c) == c
    assert all(v in ARSL.labels for v in ARSL.aliases.values())


def test_a_take_may_carry_a_class_name_as_its_label():
    raw = {"v": 1, "id": "a", "label": "ain", "kind": "static", "signer": "s", "session": "x", "hand": "right", "width": 10, "height": 10, "frames": [{"t": 0, "lm": [[0.1, 0.1, 0]] * 21}]}
    assert parse_take(raw, 0, ARSL.labels).label == "ain"
    with pytest.raises(Exception, match="alphabet"):
        parse_take({**raw, "label": "ayn"}, 0, ARSL.labels)


# ---------------------------------------------------------------- flat folder of pictures
class Fake:
    def __call__(self, path):
        if "_bb_7" in path.name:
            return None
        return images.Detection([[0.5 + 0.01 * i, 0.5 + 0.02 * i, 0.0] for i in range(21)], 640, 480)


def flat(tmp_path, names):
    root = tmp_path / "ArSL21L"
    root.mkdir()
    for n in names:
        (root / n).write_bytes(b"x")
    return root


NAMES = [
    "1001_46_F_ain_0.jpg",
    "1001_46_F_ain_1.jpg",
    "1001_46_F_bb_0.jpg",
    "1002_12_M_ain_0.jpg",  # a 12 year old
    "1002_12_M_bb_7.jpg",
    "1003_30_F_la_0.jpg",
    "1003_30_F_xx_0.jpg",  # a class that is not in the alphabet
    "1001_46_F_ain_0.txt",  # a YOLO label file
    "readme.md",
]
RX = dict(label_regex=r"_([a-z]+)_\d+\.jpg$", person_regex=r"^(\d+)_", age_regex=r"^\d+_(\d+)_")


def test_flat_folder_labels_persons_and_ages_come_from_the_file_names_without_moving_anything(tmp_path):
    root = flat(tmp_path, NAMES)
    before = sorted(p.name for p in root.iterdir())
    takes, st = images.import_folder(root, ARSL, Fake(), "arsl21l", **RX)
    assert sorted(p.name for p in root.iterdir()) == before  # nothing moved or written
    got = {(t["label"], t["person"]) for t in takes}
    assert got == {("ain", "1001"), ("bb", "1001"), ("ain", "1002"), ("la", "1003")}
    assert st.persons == {"1001", "1002", "1003"}
    assert st.ignored_folders == [("xx", 1)]
    assert st.letter("bb").no_hand == 1
    assert st.unmatched_files == 0  # .txt and .md are not pictures, so they are not even looked at


def test_ages_only_mark_minors_and_are_never_stored(tmp_path):
    takes, st = images.import_folder(flat(tmp_path, NAMES), ARSL, Fake(), "arsl21l", **RX)
    by_person = {t["person"]: t["minor"] for t in takes}
    assert by_person == {"1001": False, "1002": True, "1003": False}
    assert "46" not in json.dumps(takes) and "12" not in {k for t in takes for k in t if k.isdigit()}
    assert not any("age" in t for t in takes)
    assert st.minors == {"1002"}


def test_the_import_report_gives_minors_as_a_count_and_never_names_one(tmp_path):
    takes, st = images.import_folder(flat(tmp_path, NAMES), ARSL, Fake(), "arsl21l", **RX)
    rep = images.report_markdown(st, ARSL, {})
    assert "Persons found: 3, of which under 18: 1" in rep
    assert "1002" not in rep and "1001" not in rep


def test_a_picture_whose_name_does_not_match_the_label_regex_is_counted_and_skipped(tmp_path):
    root = flat(tmp_path, ["1001_46_F_ain_0.jpg", "weird name.jpg"])
    takes, st = images.import_folder(root, ARSL, Fake(), "s", **RX)
    assert len(takes) == 1 and st.unmatched_files == 1
    assert "did not match --label-regex" in images.report_markdown(st, ARSL, {})


def test_pictures_in_sub_folders_still_work_without_a_label_regex(tmp_path):
    (tmp_path / "ain").mkdir()
    (tmp_path / "ain" / "1001_46_F_ain_0.jpg").write_bytes(b"x")
    takes, st = images.import_folder(tmp_path, ARSL, Fake(), "s", person_regex=r"^ain/(\d+)_")
    assert [t["label"] for t in takes] == ["ain"] and takes[0]["person"] == "1001"


def test_cli_flat_folder_end_to_end(tmp_path):
    import import_images

    root = flat(tmp_path, NAMES)
    out = tmp_path / "o" / "arsl21l.jsonl"
    argv = ["--images", str(root), "--out", str(out), "--alphabet", "arsl", "--source", "arsl21l", "--label-regex", RX["label_regex"], "--person-regex", RX["person_regex"], "--age-regex", RX["age_regex"]]
    assert import_images.main(argv, detector=Fake()) == 0
    takes, _ = read_takes(out, ARSL.labels)
    assert len(takes) == 5 and {t.person for t in takes} == {"1001", "1002", "1003"}
    assert {t.person for t in takes if t.minor} == {"1002"}


# ---------------------------------------------------------------- the landmark CSV
def hand_row(seed=0, z=True, grouped=False):
    """21 plausible landmarks (palm length about 0.18, finger bones about 0.07), picture units, flattened."""
    rng = np.random.default_rng(seed)
    pts = [(0.5, 0.8, 0.0)]
    for f in range(5):
        x = 0.4 + 0.05 * f
        for j in range(1, 5):
            pts.append((x + rng.normal(0, 0.003), 0.8 - 0.18 - 0.07 * (j - 1) + rng.normal(0, 0.003), rng.normal(0, 0.005)))
    pts[9] = (0.5, 0.62, 0.0)
    dims = 3 if z else 2
    if grouped:
        return [p[d] for d in range(dims) for p in pts]
    return [p[d] for p in pts for d in range(dims)]


def write_csv(path, rows, header):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if header:
            w.writerow(header)
        w.writerows(rows)


def aslad_like(path, per_class=4, grouped=False, numeric_order=None):
    """63 coordinates + 26 angles + a number + an image name like 'ain (5191).jpg' (GENERATED, shape as described)."""
    rows = []
    order = numeric_order or CLASSES
    for ci, c in enumerate(order[:6]):
        for k in range(per_class):
            rows.append(hand_row(ci * 100 + k, True, grouped) + [0.1] * 26 + [CLASSES.index(c) if numeric_order is None else ci, f"{c} ({5000 + k}).jpg"])
    write_csv(path, rows, [f"c{i}" for i in range(63)] + [f"a{i}" for i in range(26)] + ["label", "image name"])
    return rows


def run_csv(path, **kw):
    base = dict(alphabet=ARSL, source="aslad", layout="xyz-interleaved", name_column="image name")
    base.update(kw)
    return lc.import_csv(path, **base)


def test_csv_is_imported_with_a_source_tag_and_never_a_person(tmp_path):
    f = tmp_path / "a.csv"
    aslad_like(f)
    takes, st = run_csv(f)
    assert len(takes) == 24 and set(st.per_label) == set(CLASSES[:6])
    assert all(t["source"] == "aslad" and "person" not in t and t["kind"] == "static" and len(t["frames"]) == 1 for t in takes)
    for t in takes:
        parse_take(t, 0, ARSL.labels)
    assert st.layout_check["xyz-interleaved"]["rows"] == 24


def test_the_layout_is_checked_by_measuring_bones_not_assumed(tmp_path):
    f = tmp_path / "a.csv"
    aslad_like(f, grouped=True)  # the file is x...,y...,z... but the user says interleaved
    with pytest.raises(lc.CsvError, match="do not look like a hand.*xyz-grouped fits better"):
        run_csv(f, layout="xyz-interleaved")
    takes, st = run_csv(f, layout="xyz-grouped")
    assert len(takes) == 24 and st.layout_check["xyz-grouped"]["implausible_share"] == 0.0
    assert st.layout_check["xyz-interleaved"]["implausible_share"] > 0.9
    takes, _ = run_csv(f, layout="xyz-interleaved", force=True)  # an explicit override is allowed
    assert takes


def test_without_depth_z_is_zero_and_the_report_says_the_files_are_not_comparable(tmp_path):
    f = tmp_path / "b.csv"
    rows = [hand_row(i, z=False) + [0.2] * 10 + ["ain" if i % 2 else "Space"] for i in range(10)]
    write_csv(f, rows, [f"c{i}" for i in range(42)] + [f"e{i}" for i in range(10)] + ["class"])
    takes, st = lc.import_csv(f, ARSL, "arsl-dataset-csv", "xy-interleaved", label_column="class")
    assert len(takes) == 5 and all(p[2] == 0.0 for t in takes for p in t["frames"][0]["lm"])
    assert st.ignored == {"Space": 5}  # not a letter: skipped and counted, never guessed
    rep = lc.report_markdown(st, ARSL, {})
    assert "no depth" in rep and "| Space | 5 |" in rep
    assert "tagged with `source`, never with a person" in rep


def test_a_numeric_label_alone_needs_its_class_names_and_is_cross_checked_with_the_file_name(tmp_path):
    f = tmp_path / "a.csv"
    aslad_like(f)
    with pytest.raises(lc.CsvError, match="numeric-label-names"):
        lc.import_csv(f, ARSL, "s", "xyz-interleaved", numeric_label_column="label")
    takes, _ = lc.import_csv(f, ARSL, "s", "xyz-interleaved", numeric_label_column="label", numeric_label_names=CLASSES)
    assert len(takes) == 24
    wrong = list(reversed(CLASSES))  # a numbering that disagrees with the names in the file
    with pytest.raises(lc.CsvError, match="disagrees"):
        lc.import_csv(f, ARSL, "s", "xyz-interleaved", name_column="image name", numeric_label_column="label", numeric_label_names=wrong)


def test_columns_by_header_name_and_header_detection(tmp_path):
    f = tmp_path / "a.csv"
    aslad_like(f)
    takes, _ = run_csv(f, coords=",".join(f"c{i}" for i in range(63)))
    assert len(takes) == 24
    with pytest.raises(lc.CsvError, match="needs 63 coordinate columns"):
        run_csv(f, coords="0-5")
    nohead = tmp_path / "n.csv"
    write_csv(nohead, [hand_row(i) + ["ain"] for i in range(3)], None)
    t, _ = lc.import_csv(nohead, ARSL, "s", "xyz-interleaved", label_column="63")
    assert len(t) == 3


def test_max_per_class_is_random_but_repeatable(tmp_path):
    f = tmp_path / "a.csv"
    aslad_like(f, per_class=10)
    a, st = run_csv(f, max_per_class=3, seed=1)
    b, _ = run_csv(f, max_per_class=3, seed=1)
    assert len(a) == 18 and [t["id"] for t in a] == [t["id"] for t in b] and st.dropped_by_cap == 42


def test_csv_cli_end_to_end(tmp_path, capsys):
    import import_landmarks_csv

    f = tmp_path / "a.csv"
    aslad_like(f)
    out = tmp_path / "o.jsonl"
    code = import_landmarks_csv.main(["--csv", str(f), "--out", str(out), "--alphabet", "arsl", "--source", "aslad", "--layout", "xyz-interleaved", "--name-column", "image name"])
    assert code == 0 and "assumed picture size" in capsys.readouterr().out
    assert len(read_takes(out, ARSL.labels)[0]) == 24
    assert import_landmarks_csv.main(["--csv", str(f), "--out", str(out), "--source", "x", "--layout", "xyz-interleaved", "--name-column", "image name"]) == 2  # exists
    assert import_landmarks_csv.main(["--csv", str(f), "--out", str(tmp_path / "z.jsonl"), "--source", "x", "--layout", "xyz-interleaved"]) == 2  # no class column


# ---------------------------------------------------------------- evaluation: persons, and minors only as counts
def people(n_adults=4, n_minors=2):
    out = []
    for i in range(n_adults + n_minors):
        minor = i >= n_adults
        for ci, c in enumerate(["ain", "bb", "dal"]):
            for k in range(3):
                lm = hand_row(ci * 10 + k + i * 100)
                lm = [[lm[j * 3], lm[j * 3 + 1], lm[j * 3 + 2]] for j in range(21)]
                # each class gets its own shape so the model can learn it
                lm = [[x + 0.05 * ci * (j % 4), y, z] for j, (x, y, z) in enumerate(lm)]
                out.append(parse_take({"v": 1, "id": f"{i}-{c}-{k}", "label": c, "kind": "static", "signer": f"p{i}", "session": "a", "hand": "right", "width": 640, "height": 480, "synthetic": True, "person": f"p{i}", "minor": minor, "source": "arsl21l", "frames": [{"t": 0, "lm": lm}]}, 0, ARSL.labels))
    return out


def test_evaluation_holds_out_whole_persons_and_counts_minors(tmp_path):
    takes = people()
    res = evaluation.run(takes, ("knn",), k=3)
    assert res["method"] == "leave-one-person-out" and res["n_groups"] == 6 and res["n_minor_groups"] == 2
    m = res["models"]["knn"]["metrics"]
    assert m["groups_total"] == 6 and m["groups_in_min_max"] == 4  # the worst and best person are looked for among the 4 adults only
    assert m["samples"] == 6 * 9  # everybody's pictures are in the pooled numbers


def test_no_per_person_result_and_no_person_id_reaches_a_report(tmp_path):
    import evaluate

    takes = people()
    f = tmp_path / "t.jsonl"
    f.write_text("".join(json.dumps({"v": 1, "id": t.id, "label": t.label, "kind": "static", "signer": t.signer, "session": "a", "hand": "right", "width": 640, "height": 480, "synthetic": True, "person": t.person, "minor": t.minor, "source": "arsl21l", "frames": [{"t": 0, "lm": t.frames[0][1]}]}) + "\n" for t in takes))
    out = tmp_path / "r"
    assert evaluate.main(["--data", str(f), "--alphabet", "arsl", "--dataset-name", "GEN", "--dataset-version", "0", "--models", "knn,mlp", "--allow-synthetic", "--out-dir", str(out)]) == 0
    md = next(out.glob("*.md")).read_text()
    js = next(out.glob("*.json")).read_text()
    assert "2 of them are persons under 18" in md and "count" in md
    for bad in ("p0", "p4", "p5", "per_group_accuracy", "group_sizes"):
        assert bad not in md and bad not in js, bad
    runs = json.loads(js)["runs"]
    assert runs[0]["n_minor_groups"] == 2 and "groups" not in runs[0]


def test_all_groups_minor_gives_no_worst_or_best(tmp_path):
    takes = people(n_adults=0, n_minors=3)
    m = evaluation.run(takes, ("knn",), k=3)["models"]["knn"]["metrics"]
    assert m["min_group_accuracy"] is None and m["max_group_accuracy"] is None and m["pooled_accuracy"] is not None


# ---------------------------------------------------------------- the two real files, as described (GENERATED rows of the same shape)
ARSL_DATASET_NAMES = "3ayn 7a2 9af Alef Ba2 Chin DDad Dal Delete Fa2 Finish Ghayn Ha2 Jim Kaf Kha2 Lam Mim Noon Ra2 SSad Sin Space TTa2 TTha2 Ta2 Tha2 Thal Waw Ya2 Zayn".split()


def arsl_dataset_like(path, per_class=3, decimal_comma=False, extra=None):
    """Semicolon-delimited, header 'Sign;x0;y0;x1;y1;...', 90 columns (Sign + 42 coordinates + 47 other features)."""
    header = ["Sign"] + [f"{a}{i}" for i in range(21) for a in "xy"] + [f"f{i}" for i in range(47)]
    assert len(header) == 90
    rows = []
    for ci, name in enumerate(ARSL_DATASET_NAMES):
        for k in range(per_class + (extra or {}).get(name, 0)):
            vals = hand_row(ci * 50 + k, z=False) + [0.25] * 47
            rows.append([name] + [(f"{v:.5f}".replace(".", ",") if decimal_comma else f"{v:.5f}") for v in vals])
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(header)
        w.writerows(rows)
    return len(rows)


def test_arsl_dataset_csv_semicolon_header_names_and_42_xy_columns(tmp_path):
    f = tmp_path / "ArSL_dataset.csv"
    n = arsl_dataset_like(f, extra={"Space": 4, "Delete": 2, "Finish": 1})
    takes, st = lc.import_csv(f, ARSL, "arsl-dataset-csv", "xy-interleaved", label_column="Sign", coords="1-42", delimiter=";", header_mode="yes")
    assert st.rows == n and st.bad_rows == 0
    mapped = {"ain", "gaaf", "aleff", "bb", "sheen", "dal", "fa", "ghain", "jeem", "kaaf", "khaa", "laam", "meem", "nun", "ra", "saad", "seen", "thaa", "thal", "waw", "zay"}
    assert set(st.per_label) == mapped and all(v == 3 for v in st.per_label.values()) and len(takes) == 21 * 3
    # not letters, and the letters whose id is still undecided, are skipped and counted, never guessed
    assert st.ignored["Space"] == 3 + 4 and st.ignored["Delete"] == 3 + 2 and st.ignored["Finish"] == 3 + 1
    assert {k for k in st.ignored} == {"7a2", "Ha2", "DDad", "TTa2", "TTha2", "Ta2", "Ya2", "Space", "Delete", "Finish"}
    assert all(t["source"] == "arsl-dataset-csv" and "person" not in t for t in takes)
    assert all(p[2] == 0.0 for t in takes for p in t["frames"][0]["lm"])  # no depth in this file
    rep = lc.report_markdown(st, ARSL, {})
    assert "| Space | 7 |" in rep and "| Delete | 5 |" in rep and "| Finish | 4 |" in rep


def test_the_first_42_columns_after_sign_are_the_coordinates_and_the_other_columns_are_ignored(tmp_path):
    f = tmp_path / "ArSL_dataset.csv"
    arsl_dataset_like(f)
    with pytest.raises(lc.CsvError, match="do not look like a hand|numeric"):
        lc.import_csv(f, ARSL, "s", "xy-interleaved", label_column="Sign", coords="0-41", delimiter=";", header_mode="yes")  # off by one: Sign is column 0
    takes, st = lc.import_csv(f, ARSL, "s", "xy-interleaved", label_column="Sign", coords="x0-y20".replace("x0-y20", ",".join(f"{a}{i}" for i in range(21) for a in "xy")), delimiter=";", header_mode="yes")
    assert len(takes) == 63  # the same by header names


def test_a_decimal_comma_needs_its_flag_and_the_error_says_so(tmp_path):
    f = tmp_path / "c.csv"
    arsl_dataset_like(f, decimal_comma=True)
    with pytest.raises(lc.CsvError, match="decimal-comma"):
        lc.import_csv(f, ARSL, "s", "xy-interleaved", label_column="Sign", coords="1-42", delimiter=";", header_mode="yes")
    takes, st = lc.import_csv(f, ARSL, "s", "xy-interleaved", label_column="Sign", coords="1-42", delimiter=";", header_mode="yes", decimal_comma=True)
    assert len(takes) == 63 and st.bad_rows == 0


def aslad_like_file(path, per_class=4, order=None, counter_first_line=True, delimiter=","):
    """No real header: the first line is a run of column numbers (4096, 4097, ...), then 63 interleaved coordinates in 0..1,
    26 angles, the class number and last the image name like 'ain (5191).jpg'. Class 0 is ain; the rest of the numbering here is generated."""
    order = order or ["ain", "al", "aleff", "bb", "dal", "fa"]
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=delimiter)
        if counter_first_line:
            w.writerow(range(4096, 4096 + 91))
        for num, c in enumerate(order):
            for k in range(per_class):
                w.writerow([f"{v:.6f}" for v in hand_row(num * 40 + k)] + [f"{0.3:.4f}"] * 26 + [num, f"{c} ({5000 + k}).jpg"])
    return len(order) * per_class


ASLAD_ARGS = dict(header_mode="no", skip_rows=1, coords="0-62", name_column="90", numeric_label_column="89")


def test_aslad_like_file_no_header_columns_by_index_and_the_numbering_is_learned_from_the_names(tmp_path):
    f = tmp_path / "aslad.csv"
    n = aslad_like_file(f)
    takes, st = lc.import_csv(f, ARSL, "aslad", "xyz-interleaved", **ASLAD_ARGS)
    assert len(takes) == n and st.rows == n and st.bad_rows == 0
    assert set(st.per_label) == {"ain", "al", "aleff", "bb", "dal", "fa"}
    assert st.learned_numbers == {0: "ain", 1: "al", 2: "aleff", 3: "bb", 4: "dal", 5: "fa"}  # learned, not assumed
    assert st.layout_check["xyz-interleaved"]["implausible_share"] == 0.0
    assert all("person" not in t and t["source"] == "aslad" for t in takes)
    rep = lc.report_markdown(st, ARSL, {})
    assert "0 = ain" in rep and "Class numbers learned" in rep


def test_the_line_of_column_numbers_is_dropped_by_skip_rows_or_recognised_on_its_own(tmp_path):
    f = tmp_path / "aslad.csv"
    n = aslad_like_file(f)
    # without --skip-rows and with --header no that line would be read as a row of data: it is not (it has no class name) and is counted
    _, st = lc.import_csv(f, ARSL, "aslad", "xyz-interleaved", header_mode="no", coords="0-62", name_column="90", numeric_label_column="89")
    assert st.rows == n + 1
    takes, st = lc.import_csv(f, ARSL, "aslad", "xyz-interleaved", header_mode="auto", coords="0-62", name_column="90", numeric_label_column="89")
    assert st.rows == n and len(takes) == n  # 4096, 4097, ... in a row is a counter, so auto takes it for the header line


def test_a_numbering_that_disagrees_with_the_names_is_refused(tmp_path):
    f = tmp_path / "aslad.csv"
    aslad_like_file(f)
    text = f.read_text().replace("ain (5000).jpg", "bb (5000).jpg")  # one row whose number 0 now sits next to the name bb
    f.write_text(text)
    with pytest.raises(lc.CsvError, match="one to one"):
        lc.import_csv(f, ARSL, "aslad", "xyz-interleaved", **ASLAD_ARGS)
    takes, _ = lc.import_csv(f, ARSL, "aslad", "xyz-interleaved", force=True, **ASLAD_ARGS)
    assert takes


def test_cli_commands_for_the_two_real_files(tmp_path, capsys):
    import import_landmarks_csv

    a = tmp_path / "ArSL_dataset.csv"
    arsl_dataset_like(a, extra={"Space": 2})
    out_a = tmp_path / "a.jsonl"
    code = import_landmarks_csv.main(["--csv", str(a), "--out", str(out_a), "--alphabet", "arsl", "--source", "arsl-dataset-csv", "--delimiter", ";", "--header", "yes", "--layout", "xy-interleaved", "--coords", "1-42", "--label-column", "Sign"])
    out = capsys.readouterr().out
    assert code == 0 and "| Space | 5 |" in out and len(read_takes(out_a, ARSL.labels)[0]) == 63

    b = tmp_path / "aslad.csv"
    aslad_like_file(b)
    out_b = tmp_path / "b.jsonl"
    code = import_landmarks_csv.main(["--csv", str(b), "--out", str(out_b), "--alphabet", "arsl", "--source", "aslad", "--header", "no", "--skip-rows", "1", "--layout", "xyz-interleaved", "--coords", "0-62", "--name-column", "90", "--numeric-label-column", "89"])
    assert code == 0 and "0 = ain" in capsys.readouterr().out
    # the two sources can be held out one against the other
    takes, _ = read_takes(out_b, ARSL.labels)
    assert {t.source for t in takes} == {"aslad"} and not any(t.person for t in takes)
    # a delimiter that is not the file's gives a clear error
    assert import_landmarks_csv.main(["--csv", str(a), "--out", str(tmp_path / "x.jsonl"), "--alphabet", "arsl", "--source", "s", "--header", "yes", "--layout", "xy-interleaved", "--coords", "1-42", "--label-column", "Sign"]) == 2
    assert "error" in capsys.readouterr().err


# ---------------------------------------------------------------- ASLAD classes with suffixes (haa+, haa++): not merged unless asked
def test_suffix_classes_are_skipped_and_counted_by_default_and_never_merged_silently(tmp_path):
    f = tmp_path / "aslad.csv"
    aslad_like_file(f, per_class=3, order=["ain", "haa", "haa+", "haa++"])
    takes, st = lc.import_csv(f, ARSL, "aslad", "xyz-interleaved", **ASLAD_ARGS)
    assert st.per_label == {"ain": 3, "haa": 3} and len(takes) == 6
    assert st.ignored == {"haa+": 3, "haa++": 3} and st.merged == {}
    assert "| haa+ | 3 |" in lc.report_markdown(st, ARSL, {})


def test_the_opt_in_option_imports_them_as_the_base_class_and_says_so(tmp_path):
    f = tmp_path / "aslad.csv"
    aslad_like_file(f, per_class=3, order=["ain", "haa", "haa+", "haa++"])
    takes, st = lc.import_csv(f, ARSL, "aslad", "xyz-interleaved", strip_suffix=r"\++$", **ASLAD_ARGS)
    assert st.per_label == {"ain": 3, "haa": 9} and st.merged == {"haa+": 3, "haa++": 3} and st.ignored == {}
    rep = lc.report_markdown(st, ARSL, {})
    assert "merged into their base class" in rep and "haa+ -> haa (3 rows)" in rep and "haa++ -> haa (3 rows)" in rep
    assert all(t["label"] in ("ain", "haa") for t in takes)


def test_the_option_only_touches_names_that_are_not_classes_already_and_needs_a_real_base(tmp_path):
    f = tmp_path / "aslad.csv"
    aslad_like_file(f, per_class=2, order=["ain", "zzz+"])  # zzz is not a class: stays skipped
    takes, st = lc.import_csv(f, ARSL, "aslad", "xyz-interleaved", strip_suffix=r"\++$", **ASLAD_ARGS)
    assert st.per_label == {"ain": 2} and st.ignored == {"zzz+": 2} and st.merged == {}


def test_cli_option_for_the_suffix_classes(tmp_path, capsys):
    import import_landmarks_csv

    f = tmp_path / "aslad.csv"
    aslad_like_file(f, per_class=2, order=["ain", "haa", "haa+"])
    base = ["--csv", str(f), "--alphabet", "arsl", "--source", "aslad", "--header", "no", "--skip-rows", "1", "--layout", "xyz-interleaved", "--coords", "0-62", "--name-column", "90", "--numeric-label-column", "89"]
    assert import_landmarks_csv.main([*base, "--out", str(tmp_path / "a.jsonl")]) == 0
    assert "haa+" in capsys.readouterr().out and len(read_takes(tmp_path / "a.jsonl", ARSL.labels)[0]) == 4
    assert import_landmarks_csv.main([*base, "--out", str(tmp_path / "b.jsonl"), "--strip-class-suffix", "\\++$"]) == 0
    assert "haa+ -> haa" in capsys.readouterr().out and len(read_takes(tmp_path / "b.jsonl", ARSL.labels)[0]) == 6
