"""Tests for the alphabet config, picture import, grouping, augmentation, MLP and the evaluation.

Everything here uses GENERATED data or fake detectors: it proves the logic, it says nothing about accuracy on real hands."""
import json
import math
import struct
import zlib
from pathlib import Path

import numpy as np
import pytest

from signscribe_ml import augment, dataset, evaluation, images, knn, synth
from signscribe_ml.alphabet import AlphabetError, load_alphabet
from signscribe_ml.dataset import DatasetError, parse_take, read_takes
from signscribe_ml.features import static_features
from signscribe_ml.folds import FoldError, make_groups
from signscribe_ml.mlp import MLP

ROOT = Path(__file__).resolve().parents[2]


# ---------------------------------------------------------------- hands for geometry tests
def hand(open_fingers: bool):
    """21 landmarks: wrist, then 5 fingers x (MCP, PIP, DIP, TIP). Open = tips far from the wrist, fist = tips curled back."""
    lm = [[0.5, 0.8, 0.0]]
    for f in range(5):
        x = 0.38 + 0.06 * f
        base = 0.62 - 0.01 * (f == 0)
        lm += [[x, base, 0.0], [x, base - 0.07, -0.01], [x + 0.005, base - (0.12 if open_fingers else 0.04), -0.015], [x + 0.01, base - (0.17 if open_fingers else 0.0), -0.02]]
    lm[9] = [0.5, 0.62, 0.0]  # middle finger MCP straight above the wrist: a usable scale
    return lm


def extended(lm):
    wx, wy = lm[0][0], lm[0][1]
    d = lambda i: math.hypot(lm[i][0] - wx, lm[i][1] - wy)
    return [d(4 * f + 4) > d(4 * f + 2) for f in range(5)]  # tip farther than PIP


def pairwise(lm, w, h):
    p = np.array([[x * w, y * h] for x, y, _ in lm])
    return np.linalg.norm(p[:, None] - p[None], axis=2)


# ---------------------------------------------------------------- alphabet config
def test_active_alphabet_is_read_from_the_config_file_not_from_code():
    a = load_alphabet()
    assert a.id == "asl" and len(a.static) == 24 and a.dynamic == ("J", "Z")
    assert a.kind_of("J") == "dynamic" and a.kind_of("A") == "static"


def test_another_alphabet_can_be_selected_and_the_arabic_one_is_marked_unreviewed():
    ar = load_alphabet("arsl")
    assert not ar.reviewed and len(ar.labels) == 32 and "ain" in ar.labels and ar.resolve("ع") == "ain"


def test_unknown_alphabet_and_bad_configs_are_rejected(tmp_path):
    with pytest.raises(AlphabetError, match="no alphabet"):
        load_alphabet("nope")
    (tmp_path / "alphabets").mkdir()
    (tmp_path / "alphabet.json").write_text('{"active":"x"}')
    (tmp_path / "alphabets" / "x.json").write_text(json.dumps({"static": ["A", "A"]}))
    with pytest.raises(AlphabetError, match="twice"):
        load_alphabet("x", tmp_path)
    (tmp_path / "alphabets" / "x.json").write_text(json.dumps({"static": ["a b"]}))
    with pytest.raises(AlphabetError, match="1 to 16 characters"):
        load_alphabet("x", tmp_path)


def test_folder_names_resolve_by_label_alias_or_case(tmp_path):
    (tmp_path / "alphabets").mkdir()
    (tmp_path / "alphabet.json").write_text('{"active":"x"}')
    (tmp_path / "alphabets" / "x.json").write_text(json.dumps({"static": ["ع", "B"], "aliases": {"Ain": "ع"}}))
    a = load_alphabet(None, tmp_path)
    assert a.resolve("ع") == "ع" and a.resolve("ain") == "ع" and a.resolve("b") == "B" and a.resolve("zzz") is None


def test_the_reader_checks_labels_against_the_alphabet_not_a_fixed_list():
    t = synth.static_takes(labels="A", signers=("s",), takes_per=1)[0]
    t["label"] = "J"
    assert parse_take(t, 1).label == "J"
    with pytest.raises(DatasetError, match="alphabet"):
        parse_take(t, 1, labels=["A", "B"])
    t["label"] = "ain"
    with pytest.raises(DatasetError, match="alphabet"):
        parse_take(t, 1)
    assert parse_take(t, 1, labels=load_alphabet("arsl").labels).label == "ain"


def test_person_and_source_are_optional_but_must_not_be_empty():
    t = synth.static_takes(labels="A", signers=("s",), takes_per=1)[0]
    assert parse_take(t).person is None and parse_take(t).source is None
    t.update(person="p1", source="cam-a")
    p = parse_take(t)
    assert (p.person, p.source) == ("p1", "cam-a")
    t["person"] = " "
    with pytest.raises(DatasetError, match="person"):
        parse_take(t)


# ---------------------------------------------------------------- picture import
def make_tree(tmp_path, spec):
    for rel in spec:
        p = tmp_path / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(b"x")
    return tmp_path


class Fake:
    """detector: hand found unless the file name contains 'nohand'; 'bad' files are unreadable."""

    def __call__(self, path):
        if "bad" in path.name:
            raise images.ImageUnreadable("broken")
        if "nohand" in path.name:
            return None
        return images.Detection(hand(True), 640, 480)


def test_import_counts_per_letter_and_skips_pictures_without_a_hand(tmp_path):
    root = make_tree(tmp_path / "ds", ["A/u1_1.jpg", "A/u1_2_nohand.jpg", "A/u2_1.jpg", "B/u1_1.jpg", "B/u1_bad.jpg", "Z/u1_1.jpg", "Extra/x.jpg", "notes.txt"])
    takes, st = images.import_folder(root, load_alphabet("asl"), Fake(), "src1", person_regex=r"(?P<person>u\d+)_")
    assert st.letter("A").images == 3 and st.letter("A").imported == 2 and st.letter("A").no_hand == 1
    assert st.letter("B").unreadable == 1 and st.letter("B").imported == 1
    assert st.no_hand == 1 and st.images == 5 and st.imported == 3
    assert st.dynamic_skipped == {"Z": 1}  # a still picture cannot show a moving letter
    assert st.ignored_folders == [("Extra", 1)]
    assert {t["person"] for t in takes} == {"u1", "u2"}
    for t in takes:  # every take passes the same checks as the training scripts
        parse_take(t, 0)
    assert all(t["source"] == "src1" and t["kind"] == "static" and len(t["frames"]) == 1 for t in takes)


def test_without_person_ids_the_source_is_recorded_and_ids_are_stable(tmp_path):
    root = make_tree(tmp_path / "ds", ["A/1.jpg", "B/2.jpg"])
    a, _ = images.import_folder(root, load_alphabet("asl"), Fake(), "cam-a", dataset_name="D")
    b, _ = images.import_folder(root, load_alphabet("asl"), Fake(), "cam-a", dataset_name="D")
    assert [t["id"] for t in a] == [t["id"] for t in b] and len({t["id"] for t in a}) == 2
    assert all("person" not in t and t["source"] == "cam-a" for t in a)


def test_pictures_not_matching_the_person_regex_are_counted_and_warned_about(tmp_path):
    root = make_tree(tmp_path / "ds", ["A/u1_1.jpg", "A/other.jpg"])
    takes, st = images.import_folder(root, load_alphabet("asl"), Fake(), "s", person_regex=r"(?P<person>u\d+)_")
    assert st.no_person_id == 1
    assert "WARNING" in images.report_markdown(st, load_alphabet("asl"), {})


def test_report_lists_every_letter_the_totals_and_the_missing_letters(tmp_path):
    root = make_tree(tmp_path / "ds", ["A/1.jpg", "A/2_nohand.jpg"])
    _, st = images.import_folder(root, load_alphabet("asl"), Fake(), "s")
    rep = images.report_markdown(st, load_alphabet("asl"), {"x": "y"})
    assert "| A | 2 | 1 | 1 | 0 |" in rep and "1 had no hand (50.0%)" in rep and "Letters with nothing imported: B" in rep


def test_cli_writes_a_valid_file_and_refuses_to_overwrite(tmp_path):
    import import_images

    root = make_tree(tmp_path / "ds", ["A/1.jpg", "B/1.jpg", "B/2_nohand.jpg"])
    out = tmp_path / "o" / "t.jsonl"
    assert import_images.main(["--images", str(root), "--out", str(out), "--dataset-name", "T"], detector=Fake()) == 0
    takes, _ = read_takes(out)
    assert len(takes) == 2 and out.with_suffix(".import.md").exists()
    assert import_images.main(["--images", str(root), "--out", str(out)], detector=Fake()) == 2


def blank_png(path, w=64, h=48):
    raw = b"".join(b"\x00" + b"\x80\x80\x80" * w for _ in range(h))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


def test_real_mediapipe_finds_no_hand_in_a_blank_picture(tmp_path):
    pytest.importorskip("mediapipe")
    model = ROOT / "public" / "models" / "hand_landmarker.task"
    if not model.exists():
        pytest.skip("run `npm run models` to get hand_landmarker.task")
    (tmp_path / "A").mkdir()
    blank_png(tmp_path / "A" / "blank.png")
    (tmp_path / "A" / "broken.png").write_bytes(b"not a picture")
    try:
        det = images.MediaPipeDetector(str(model))
    except SystemExit as e:
        pytest.skip(f"MediaPipe cannot run here: {e}")
    try:
        takes, st = images.import_folder(tmp_path, load_alphabet("asl"), det, "s")
    finally:
        det.close()
    assert takes == [] and st.letter("A").no_hand == 1 and st.letter("A").unreadable == 1


# ---------------------------------------------------------------- grouping
def tk(label, person=None, source=None, signer="s", session="a"):
    t = synth.static_takes(labels=label, signers=(signer,), takes_per=1)[0]
    t["session"] = session
    if person:
        t["person"] = person
    if source:
        t["source"] = source
    return parse_take(t)


def test_person_beats_source_beats_signer_beats_session():
    both = [tk("A", "p1", "x"), tk("A", "p2", "x")]
    assert make_groups(both)[0] == "leave-one-person-out"
    only_source = [tk("A", source="x"), tk("A", source="y")]
    assert make_groups(only_source)[0] == "leave-one-source-out"
    signers = [tk("A", signer="s1"), tk("A", signer="s2")]
    assert make_groups(signers)[0] == "leave-one-signer-out"
    sessions = [tk("A", session="a"), tk("A", session="b")]
    assert make_groups(sessions)[0] == "leave-one-session-out"


def test_a_partly_missing_person_field_is_not_used():
    method, _, ok = make_groups([tk("A", "p1", "x"), tk("A", None, "y")])
    assert method == "leave-one-source-out" and ok


def test_one_person_only_falls_back_to_the_optimistic_split_and_says_so():
    method, groups, ok = make_groups([tk("A", "p1"), tk("A", "p1")])
    assert not ok and "optimistic" in method
    with pytest.raises(FoldError, match="cannot group by person"):
        make_groups([tk("A", "p1"), tk("A", "p1")], group_by="person")


# ---------------------------------------------------------------- augmentation
RNG = np.random.default_rng(3)


@pytest.mark.parametrize("deg", [-15, -7.5, 0, 9, 15])
def test_rotation_keeps_the_shape_exactly(deg):
    lm = hand(True)
    r = augment.rotate_landmarks(lm, 1280, 720, deg)
    assert np.allclose(pairwise(lm, 1280, 720), pairwise(r, 1280, 720), atol=1e-9)
    assert [p[2] for p in r] == [p[2] for p in lm]
    assert r[0] == lm[0]  # the wrist does not move


def test_rotation_turns_the_hand_by_the_asked_angle_and_never_more_than_the_bound():
    lm = hand(True)
    ang = lambda h: math.degrees(math.atan2((h[9][1] - h[0][1]) * 720, (h[9][0] - h[0][0]) * 1280))
    for deg in (-15, 5, 15):
        assert math.isclose(ang(augment.rotate_landmarks(lm, 1280, 720, deg)) - ang(lm), deg, abs_tol=1e-9)
    cfg = augment.AugmentConfig(rotate=True)
    for i in range(200):
        f = augment.augmented_features(lm, 1280, 720, "right", np.random.default_rng(i), cfg)
        base = static_features(lm, 1280, 720)
        # the wrist-to-middle-knuckle direction of the features is the hand's angle: it moved at most ROT_MAX_DEG
        a1, a0 = math.degrees(math.atan2(f[3 * 8 + 1], f[3 * 8])), math.degrees(math.atan2(base[3 * 8 + 1], base[3 * 8]))
        assert abs(a1 - a0) <= augment.ROT_MAX_DEG + 1e-6


def test_the_same_scale_on_both_axes_changes_nothing_because_features_divide_by_hand_size():
    lm = hand(True)
    base = static_features(lm, 1280, 720)
    for s in (0.8, 1.3):
        assert np.allclose(static_features(augment.stretch_landmarks(lm, 1280, 720, s, s), 1280, 720), base, atol=1e-9)


def test_different_x_and_y_scales_change_distances_by_at_most_their_ratio():
    lm = hand(True)
    lo, hi = 1 - augment.ASPECT_RANGE, 1 + augment.ASPECT_RANGE
    d0 = pairwise(lm, 1280, 720)
    d1 = pairwise(augment.stretch_landmarks(lm, 1280, 720, lo, hi), 1280, 720)
    mask = d0 > 1e-9
    ratio = d1[mask] / d0[mask]
    assert ratio.min() >= lo - 1e-9 and ratio.max() <= hi + 1e-9


def test_a_mirrored_picture_has_exactly_the_features_of_the_other_hand_flag():
    lm = hand(True)
    assert np.allclose(static_features(augment.mirror_landmarks(lm), 1280, 720), static_features(lm, 1280, 720, mirror_x=True), atol=1e-9)
    assert np.allclose(pairwise(augment.mirror_landmarks(lm), 1280, 720), pairwise(lm, 1280, 720), atol=1e-9)
    twice = augment.mirror_landmarks(augment.mirror_landmarks(lm))
    assert np.allclose(twice, lm)


@pytest.mark.parametrize("open_fingers", [True, False])
def test_augmentation_never_changes_which_fingers_are_extended(open_fingers):
    """A proxy for 'the label keeps its meaning': an open hand stays open and a fist stays a fist, in every random draw."""
    lm = hand(open_fingers)
    want = extended(lm)
    assert want == [open_fingers] * 5
    cfg = augment.AugmentConfig(rotate=True, scale=True, mirror=True)
    for i in range(300):
        rng = np.random.default_rng(i)
        cur = augment.rotate_landmarks(lm, 1280, 720, float(rng.uniform(-15, 15)))
        cur = augment.stretch_landmarks(cur, 1280, 720, 1 + float(rng.uniform(-0.08, 0.08)), 1 + float(rng.uniform(-0.08, 0.08)))
        assert extended(cur) == want
        assert augment.augmented_features(lm, 1280, 720, "right", np.random.default_rng(i), cfg) is not None


def test_augmented_samples_are_deterministic_static_only_and_counted():
    takes = [parse_take(t) for t in synth.static_takes(labels="AB", signers=("s",), takes_per=2, frames=3) + synth.dynamic_takes(signers=("s",), takes_per=1)]
    cfg = augment.AugmentConfig(rotate=True, scale=True, mirror=True, copies=2)
    X1, y1, t1 = augment.augmented_samples(takes, cfg, 5)
    X2, _, _ = augment.augmented_samples(takes, cfg, 5)
    X3, _, _ = augment.augmented_samples(takes, cfg, 6)
    assert X1.shape == (4 * 3 * 2, 60) and np.array_equal(X1, X2) and not np.array_equal(X1, X3)
    assert all(takes[i].kind == "static" for i in t1) and all(takes[i].label == l for i, l in zip(t1, y1))
    assert augment.augmented_samples(takes, augment.AugmentConfig(), 0)[0].shape == (0, 60)


def test_parse_augment():
    assert not augment.parse_augment("none").enabled
    assert augment.parse_augment("rotate,mirror").describe().startswith("rotate+mirror")
    assert augment.parse_augment("all").scale
    with pytest.raises(ValueError):
        augment.parse_augment("blur")


# ---------------------------------------------------------------- k-NN (batch) and MLP
def test_batch_knn_gives_the_same_vote_as_the_one_at_a_time_version():
    rng = np.random.default_rng(1)
    Xtr = rng.normal(size=(120, 60))
    ytr = list(rng.choice(list("ABCD"), 120))
    Xte = rng.normal(size=(15, 60))
    best, share, _, _ = knn.predict_batch(Xtr, ytr, Xte, 5, chunk=4)
    for i, x in enumerate(Xte):
        lab, c, ranked = knn.predict(Xtr, ytr, x, 5)
        assert lab == best[i] and math.isclose(c, share[i], rel_tol=1e-6)


def separable(n=40, seed=0):
    rng = np.random.default_rng(seed)
    centres = rng.normal(0, 3, (3, 60))
    X = np.vstack([c + rng.normal(0, 0.4, (n, 60)) for c in centres])
    return X, [l for l in "ABC" for _ in range(n)]


def test_mlp_learns_a_separable_problem_and_is_deterministic():
    X, y = separable()
    m1, m2 = MLP(epochs=30, seed=1).fit(X, y), MLP(epochs=30, seed=1).fit(X, y)
    pred, conf, second, c2 = m1.predict(X)
    assert np.mean([a == b for a, b in zip(pred, y)]) > 0.98
    assert np.array_equal(m1.predict_proba(X), m2.predict_proba(X))
    assert np.allclose(m1.predict_proba(X).sum(axis=1), 1) and (conf >= c2).all()


# ---------------------------------------------------------------- evaluation
def people_dataset(persons=("p1", "p2", "p3"), labels="ABC", per=3, frames=2):
    out = []
    for i, p in enumerate(persons):
        for t in synth.static_takes(labels=labels, signers=(p,), takes_per=per, frames=frames, seed=7):
            t["person"] = p
            t["id"] = f"{p}-{t['id']}"
            out.append(parse_take(t))
    return out


def test_every_person_is_held_out_once_and_both_models_share_the_folds():
    res = evaluation.run(people_dataset(), ("knn", "mlp"), k=3)
    assert res["method"] == "leave-one-person-out" and res["n_groups"] == 3 and res["n_minor_groups"] == 0
    a, b = res["models"]["knn"], res["models"]["mlp"]
    assert a["group"] == b["group"] and a["truth"] == b["truth"] and len(a["truth"]) == 3 * 3 * 3 * 2
    assert a["metrics"]["groups_total"] == 3 and "per_group_accuracy" not in a["metrics"]


def test_leakage_canary_a_held_out_person_never_reaches_training():
    """p2 signs A and B with the shapes p1 uses for B and A. A model trained only on p1 must get p2 wrong every time."""
    p1 = people_dataset(("p1",), "AB", per=3, frames=2)
    swap = {"A": "B", "B": "A"}
    p2 = []
    for t in p1:
        raw = {"v": 1, "id": "p2-" + t.id, "label": swap[t.label], "kind": "static", "signer": "p2", "session": "a", "hand": "right", "width": t.width, "height": t.height, "synthetic": True, "person": "p2", "frames": [{"t": f[0], "lm": f[1]} for f in t.frames]}
        p2.append(parse_take(raw))
    for aug in (None, augment.AugmentConfig(rotate=True, scale=True, mirror=True)):
        res = evaluation.run(p1 + p2, ("knn", "mlp"), k=3, augment=aug)
        for m in ("knn", "mlp"):
            assert res["models"][m]["metrics"]["pooled_accuracy"] == 0.0, (m, aug)


def test_a_single_person_is_refused_unless_asked_and_then_labelled_optimistic():
    one = people_dataset(("p1",), per=5)
    with pytest.raises(evaluation.EvaluationError, match="only one"):
        evaluation.run(one)
    res = evaluation.run(one, ("knn",), allow_optimistic=True)
    assert not res["generalises"]
    prov = {"synthetic": False, "command": "c", "date": "d", "git_commit": None, "dataset_name": "n", "dataset_version": "v", "dataset_sha256": "0" * 64, "alphabet": "asl", "takes": 1, "persons": 1, "sources": 0, "signers": 1, "python": "3", "numpy": "2"}
    md = evaluation.markdown(res, prov)
    assert "NOT A RESULT FOR NEW PEOPLE" in md and "SAME-PERSON" in md


def test_metrics_precision_recall_and_worst_pairs_on_known_predictions():
    o = {"truth": list("AAAABBBC"), "pred": list("AABAABBA"), "conf": [0.9] * 8, "second": ["B"] * 8, "conf2": [0.1] * 8, "group": ["g"] * 8}
    m = evaluation.metrics(o, list("ABC"))
    assert m["pooled_accuracy"] == 5 / 8
    assert m["per_label"]["A"] == {"support": 4, "precision": 3 / 5, "recall": 3 / 4}
    assert m["per_label"]["C"]["recall"] == 0.0 and m["per_label"]["C"]["precision"] is None
    assert list(m["worst_pairs"])[0] == "A/B" and m["worst_pairs"]["A/B"]["total"] == 2


def test_selective_view_counts_only_confident_frames():
    o = {"truth": list("AAAA"), "pred": list("AABB"), "conf": [0.9, 0.7, 0.55, 0.2], "second": ["B"] * 4, "conf2": [0.1] * 4, "group": ["g"] * 4}
    s = evaluation.metrics(o, list("AB"))["selective"]
    assert s[0.6] == {"coverage": 0.5, "accuracy_when_shown": 1.0} and s[0.5]["coverage"] == 0.75


def test_evaluate_cli_refuses_synthetic_and_writes_provenance(tmp_path):
    import evaluate

    f = tmp_path / "t.jsonl"
    rows = []
    for t in people_dataset():
        rows.append({"v": 1, "id": t.id, "label": t.label, "kind": "static", "signer": t.signer, "session": "a", "hand": "right", "width": t.width, "height": t.height, "synthetic": True, "person": t.person, "frames": [{"t": a, "lm": b} for a, b in t.frames]})
    f.write_text("".join(json.dumps(r) + "\n" for r in rows))
    base = ["--data", str(f), "--dataset-name", "GEN", "--dataset-version", "0", "--out-dir", str(tmp_path / "r")]
    assert evaluate.main(base) == 2
    res_md = tmp_path / "RESULTS.md"
    assert evaluate.main([*base, "--allow-synthetic", "--augment", "all", "--augment-ablation", "--results-md", str(res_md)]) == 0
    assert not res_md.exists()  # synthetic runs never reach the results file
    js = json.loads(next((tmp_path / "r").glob("*.json")).read_text())
    assert js["provenance"]["dataset_name"] == "GEN" and js["provenance"]["command"].startswith("python ml/evaluate.py")
    assert [r["name"] for r in js["runs"]] == ["with augmentation", "no augmentation"]
    md = next((tmp_path / "r").glob("*.md")).read_text()
    assert "SYNTHETIC DATA" in md and "leave-one-person-out" in md and "10 worst letter pairs" in md


def test_the_default_threshold_matches_the_browser():
    ts = (ROOT / "src" / "recognition" / "letterController.ts").read_text()
    assert f"minConfidence: {evaluation.DEFAULT_MIN_CONFIDENCE}," in ts


def test_train_knn_keeps_the_browser_model_format_with_augmentation(tmp_path):
    import train_knn
    from validate_model import check

    f = tmp_path / "t.jsonl"
    rows = [{"v": 1, "id": t.id, "label": t.label, "kind": "static", "signer": t.signer, "session": "a", "hand": "right", "width": t.width, "height": t.height, "synthetic": True, "person": t.person, "frames": [{"t": a, "lm": b} for a, b in t.frames]} for t in people_dataset()]
    f.write_text("".join(json.dumps(r) + "\n" for r in rows))
    out = tmp_path / "m.json"
    assert train_knn.main(["--data", str(f), "--out", str(out), "--allow-synthetic", "--augment", "rotate,mirror"]) == 0
    model = json.loads(out.read_text())
    assert [e for e in check(model) if not e.startswith("WARNING")] == []
    assert model["meta"]["evaluation"]["method"] == "leave-one-person-out" and len(model["vectors"]) > 3 * 3 * 3 * 2
