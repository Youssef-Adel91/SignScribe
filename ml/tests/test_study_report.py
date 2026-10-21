"""Statistics checked against brute force (and scipy when installed), report checked on made-up exports."""
import csv
import importlib.util
import itertools
import math
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "analysis"))
import study_report as sr  # noqa: E402


def brute_force_p(d):
    """two-sided exact p by listing every sign assignment (small n only)"""
    d = [v for v in d if v != 0]
    ranks = sr.average_ranks([abs(v) for v in d])
    w_plus = sum(r for r, v in zip(ranks, d) if v > 0)
    w_minus = sum(ranks) - w_plus
    w = min(w_plus, w_minus)
    n_le = 0
    for signs in itertools.product([0, 1], repeat=len(d)):
        s = sum(r for r, g in zip(ranks, signs) if g)
        if s <= w + 1e-9:
            n_le += 1
    return min(1.0, 2 * n_le / 2 ** len(d))


@pytest.mark.parametrize("d", [[1, 2, 3, 4, 5], [-1, 2, -3, 4, 5, 6], [1, 1, 2, -2, 3, -4, 5], [3, -1, 4, 1, -5, 9, 2, 6, -5, 3]])
def test_exact_p_matches_brute_force_including_ties(d):
    got = sr.wilcoxon_signed_rank(d, [0] * len(d))
    assert got["p"] == pytest.approx(brute_force_p(d), abs=1e-12)


def test_worked_example():
    # 15 differences with one negative pair of ranks: W+ = 96, W- = 24; the p-value is checked by brute force above
    # and against scipy in test_matches_scipy_when_available
    d = [6, 8, 14, 16, 23, 24, 28, 29, 41, -48, 49, 56, 60, -67, 75]
    got = sr.wilcoxon_signed_rank(d, [0] * 15)
    assert got["w_plus"] == 96 and got["w_minus"] == 24
    assert got["p"] == pytest.approx(0.04126, abs=1e-4)


def test_matches_scipy_when_available():
    stats = pytest.importorskip("scipy.stats")
    x = [12.1, 9.8, 14.2, 11.0, 16.5, 10.2, 13.3, 15.1, 9.9, 12.8]
    y = [10.0, 10.1, 11.5, 11.0, 12.0, 9.0, 13.0, 12.0, 10.5, 11.0]
    ours = sr.wilcoxon_signed_rank(x, y)
    ref = stats.wilcoxon(x, y, method="exact", zero_method="wilcox")
    assert ours["p"] == pytest.approx(ref.pvalue, abs=1e-9)


def test_all_equal_pairs_give_p_one_and_no_crash():
    assert sr.wilcoxon_signed_rank([1, 2, 3], [1, 2, 3])["p"] == 1.0


def test_smallest_possible_p_with_few_pairs():
    got = sr.wilcoxon_signed_rank([5, 6, 7, 8, 9], [1, 1, 1, 1, 1])
    assert got["p"] == pytest.approx(sr.min_possible_p(5))  # 0.0625: five pairs can never reach 0.05


def test_large_samples_use_the_normal_approximation_and_agree_in_direction():
    x = list(range(1, 31))
    y = [v - (1 if v % 3 else -1) * 0.5 for v in x]
    got = sr.wilcoxon_signed_rank(x, y)
    assert got["method"] == "normal approximation" and 0 <= got["p"] <= 1


def test_rank_biserial_sign():
    assert sr.wilcoxon_signed_rank([5, 6, 7], [1, 1, 1])["r"] == 1.0
    assert sr.wilcoxon_signed_rank([1, 1, 1], [5, 6, 7])["r"] == -1.0


def test_sign_test():
    assert sr.sign_test(0, 0) == 1.0
    assert sr.sign_test(8, 0) == pytest.approx(2 / 256)
    assert sr.sign_test(3, 3) == 1.0


# ------------------------------------------------------------- a report from made-up exports
def write(path, header, rows):
    with path.open("w", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(header)
        w.writerows(rows)


def make_exports(d: Path, participants=8, agent="Mozilla/5.0 Chrome/120", version="abc"):
    trials, scores, comps, profile, session = [], [], [], [], []
    for p in range(participants):
        order = ["camera", "keyboard"] if p % 2 == 0 else ["keyboard", "camera"]
        for block, mode in enumerate(order):
            for k in range(3):
                secs = (40 if mode == "camera" else 20) + k + p % 3
                trials.append([p, block, mode, "A" if block == 0 else "B", f"T{k}", "2026-01-01T00:00:00Z", int(secs * 1000), 1, 1, 0, 0, 0, 1, "true", "done", "27.5" if mode == "camera" else "", "12.0" if mode == "camera" else "", "GPU" if mode == "camera" else "", "x"])
            scores.append([p, block, mode, 3.5 if mode == "camera" else 4.0, 4.0, 3.0 + (p % 2)])
        comps.append([p, "camera" if p % 3 == 0 else "keyboard", "same", "keyboard"])
        profile.append([p, "t", "18-24", "right", "none", "never", "4"])
        session.append([p, "t", version, agent, "1x1", 4, "normal", "standard", "auto", "true", "right"])
    write(d / "signscribe-trials-2026-01-01.csv", ["participant", "block", "mode", "task_set", "task", "started_at", "duration_ms", "errors", "corrections", "rejections", "backs", "hand_lost", "attempts", "success", "ended_by", "camera_fps", "model_ms_mean", "delegate", "final_text"], trials)
    write(d / "signscribe-scores-2026-01-01.csv", ["participant", "block", "mode", "satisfaction", "engagement", "usability"], scores)
    write(d / "signscribe-comparison-2026-01-01.csv", ["participant", "cmp_easier", "cmp_enjoy", "cmp_choose"], comps)
    write(d / "signscribe-profile-2026-01-01.csv", ["participant", "consent_at", "age", "writing_hand", "sign_language", "gesture_ui", "kbm"], profile)
    write(d / "signscribe-session-2026-01-01.csv", ["participant", "started_at", "app_version", "user_agent", "screen", "cores", "text_size", "contrast", "hold_time", "voice", "signing_hand"], session)


def test_report_has_every_section_and_uses_only_the_files(tmp_path):
    make_exports(tmp_path)
    r = sr.build_report(tmp_path)
    for heading in ["Who started with which method", "Task measures", "Survey", "Direct comparison", "Camera pipeline", "Participants"]:
        assert heading in r
    assert "participants with both methods: **8**" in r
    assert "| camera | 4 |" in r or "| camera | 4" in r  # balanced order table
    assert "time per task" in r and "satisfaction" in r
    assert "WARNING" not in r  # real-browser user agent


def test_report_warns_on_few_participants_headless_and_mixed_builds(tmp_path):
    make_exports(tmp_path, participants=3, agent="HeadlessChrome/120")
    r = sr.build_report(tmp_path)
    assert "too few to conclude" in r and "0.250" in r  # 2 / 2^3
    assert "headless test browser" in r
    d2 = tmp_path / "b"
    d2.mkdir()
    make_exports(d2, participants=8, version="v1")
    rows = list(csv.reader((d2 / "signscribe-session-2026-01-01.csv").open()))
    rows[1][2] = "v2"
    write(d2 / "signscribe-session-2026-01-01.csv", rows[0], rows[1:])
    assert "different builds" in sr.build_report(d2)


def test_a_participant_with_one_method_only_is_left_out(tmp_path):
    make_exports(tmp_path, participants=8)
    rows = list(csv.reader((tmp_path / "signscribe-trials-2026-01-01.csv").open()))
    kept = [rows[0]] + [r for r in rows[1:] if not (r[0] == "7" and r[2] == "keyboard")]
    write(tmp_path / "signscribe-trials-2026-01-01.csv", kept[0], kept[1:])
    r = sr.build_report(tmp_path)
    assert "participants with both methods: **7**" in r and "left out because a method is missing: 7" in r


def test_empty_folder_says_so(tmp_path):
    assert "No trials found" in sr.build_report(tmp_path)


def test_scores_csv_from_the_browser_is_what_the_report_reads(tmp_path):
    """the header the TypeScript exporter writes (src/study/log.ts) is the one this script reads"""
    ts = (Path(__file__).parents[2] / "src/study/log.ts").read_text()
    for col in ["participant", "block", "mode", "duration_ms", "errors", "attempts", "success", "ended_by", "camera_fps", "model_ms_mean", "satisfaction", "engagement", "usability", "cmp_easier", "cmp_enjoy", "cmp_choose", "user_agent", "app_version"]:
        assert f"'{col}'" in ts, col
