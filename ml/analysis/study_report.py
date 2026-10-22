#!/usr/bin/env python3
"""Turns the study exports (trials / scores / comparison / profile / session CSV) into a Markdown report.

    python ml/analysis/study_report.py --dir exports/ --out docs/reports/study.md

Pure Python (csv, statistics). Every number comes from the files; nothing is assumed. Paired tests are
Wilcoxon signed-rank (exact up to 25 pairs, normal approximation with tie and continuity correction above),
the choice for small samples of ordinal / skewed data. The report says how many participants it used, how
many it left out and why, and warns when the sample is too small to conclude anything.
"""
from __future__ import annotations

import argparse
import csv
import math
import statistics
import sys
from collections import Counter, defaultdict
from pathlib import Path

DIMENSIONS = ["satisfaction", "engagement", "usability"]
# the two reverse-worded items (a high answer = LOW satisfaction / engagement) and the items they are checked against
REVERSE_CHECKS = [("sat3", ["sat1", "sat2"]), ("eng3", ["eng1", "eng2"])]
INCONSISTENT_BY = 3  # points apart on the 1..5 scale
EXACT_UP_TO = 25


# ---------------------------------------------------------------- statistics
def average_ranks(values):
    order = sorted(range(len(values)), key=lambda i: values[i])
    ranks = [0.0] * len(values)
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and values[order[j + 1]] == values[order[i]]:
            j += 1
        r = (i + j) / 2 + 1
        for k in range(i, j + 1):
            ranks[order[k]] = r
        i = j + 1
    return ranks


def normal_cdf(z):
    return 0.5 * (1 + math.erf(z / math.sqrt(2)))


def wilcoxon_signed_rank(x, y):
    """Two-sided paired test of x against y. Pairs with equal values are dropped (as is usual).

    Returns dict(n, w_plus, w_minus, p, method, r) where r is the matched-pairs rank-biserial correlation
    ((W+ - W-) / (W+ + W-), positive when x tends to be larger).
    """
    d = [a - b for a, b in zip(x, y) if a != b]
    n = len(d)
    if n == 0:
        return {"n": 0, "w_plus": 0.0, "w_minus": 0.0, "p": 1.0, "method": "no differences", "r": 0.0}
    ranks = average_ranks([abs(v) for v in d])
    w_plus = sum(r for r, v in zip(ranks, d) if v > 0)
    w_minus = sum(r for r, v in zip(ranks, d) if v < 0)
    total = w_plus + w_minus
    r_bis = (w_plus - w_minus) / total
    w = min(w_plus, w_minus)
    if n <= EXACT_UP_TO:
        # exact: count the sign assignments whose rank sum is <= w (ranks doubled so they are integers)
        doubled = [int(round(2 * r)) for r in ranks]
        counts = {0: 1}
        for r in doubled:
            nxt = dict(counts)
            for s, c in counts.items():
                nxt[s + r] = nxt.get(s + r, 0) + c
            counts = nxt
        below = sum(c for s, c in counts.items() if s <= round(2 * w))
        p = min(1.0, 2 * below / 2**n)
        method = "exact"
    else:
        mean = n * (n + 1) / 4
        ties = Counter(abs(v) for v in d)
        var = n * (n + 1) * (2 * n + 1) / 24 - sum(t**3 - t for t in ties.values()) / 48
        z = (abs(w - mean) - 0.5) / math.sqrt(var) if var > 0 else 0.0
        p = min(1.0, 2 * (1 - normal_cdf(z)))
        method = "normal approximation"
    return {"n": n, "w_plus": w_plus, "w_minus": w_minus, "p": p, "method": method, "r": r_bis}


def sign_test(a, b):
    """Exact two-sided sign test on counts a vs b (ties already left out)."""
    n = a + b
    if n == 0:
        return 1.0
    k = min(a, b)
    return min(1.0, 2 * sum(math.comb(n, i) for i in range(k + 1)) / 2**n)


def min_possible_p(n):
    return 2 / 2**n if n else 1.0


# ---------------------------------------------------------------- reading
def read_csv(path: Path):
    if not path.exists():
        return []
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def find(dir_: Path, stem: str):
    """The newest export file whose name starts with signscribe-<stem>."""
    files = sorted(dir_.glob(f"signscribe-{stem}-*.csv"))
    return files[-1] if files else dir_ / f"signscribe-{stem}.csv"


def f(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------- analysis
def per_participant(trials):
    """participant -> mode -> dict of per-trial lists."""
    out = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))
    for t in trials:
        p, m = t["participant"], t["mode"]
        out[p][m]["seconds"].append(float(t["duration_ms"]) / 1000)
        out[p][m]["errors"].append(float(t["errors"]))
        out[p][m]["attempts"].append(float(t["attempts"]))
        out[p][m]["success"].append(1.0 if t["success"] == "true" else 0.0)
        out[p][m]["gaveup"].append(1.0 if t["ended_by"] == "gaveup" else 0.0)
    return out


def paired_row(label, pairs, unit="", digits=2):
    xs = [a for a, _ in pairs]
    ys = [b for _, b in pairs]
    if not pairs:
        return f"| {label} | 0 | n/a | n/a | n/a | n/a | n/a |"
    t = wilcoxon_signed_rank(xs, ys)
    med = lambda v: f"{statistics.median(v):.{digits}f}{unit}"
    p = f"{t['p']:.3f}" if t["n"] else "n/a"
    return f"| {label} | {len(pairs)} | {med(xs)} | {med(ys)} | {p} ({t['method']}) | {t['r']:+.2f} | {t['n']} |"


def answer_quality(survey_rows):
    """Surveys that look careless: every answer the same (straight-lining), or a reverse-worded item that
    contradicts the positively worded items about the same thing by 3 points or more."""
    flags = {}
    for r in survey_rows:
        key = (r["participant"], r["mode"])
        values = {k: int(v) for k, v in r.items() if k not in ("participant", "block", "mode") and v not in ("", None)}
        why = []
        if len(values) >= 10 and len(set(values.values())) == 1:
            why.append("all answers identical")
        for rev, pos in REVERSE_CHECKS:
            if rev in values and all(p in values for p in pos):
                flipped = 6 - values[rev]
                if abs(flipped - statistics.mean(values[p] for p in pos)) >= INCONSISTENT_BY:
                    why.append(f"{rev} contradicts {'/'.join(pos)}")
        if why:
            flags[key] = why
    return flags


def build_report(dir_: Path, exclude_flagged: bool = False) -> str:
    trials = read_csv(find(dir_, "trials"))
    scores = read_csv(find(dir_, "scores"))
    survey = read_csv(find(dir_, "survey"))
    flagged = answer_quality(survey)
    comps = read_csv(find(dir_, "comparison"))
    profiles = read_csv(find(dir_, "profile"))
    sessions = read_csv(find(dir_, "session"))
    out = ["# Comparison study: camera hand signs vs keyboard and mouse", ""]
    if not trials:
        return "\n".join(out + ["No trials found in this folder. Export the CSV files from the study console first."]) + "\n"

    pp = per_participant(trials)
    complete = sorted(p for p in pp if {"camera", "keyboard"} <= set(pp[p]) and all(len(pp[p][m]["seconds"]) >= 1 for m in ("camera", "keyboard")))
    left_out = sorted(set(pp) - set(complete))
    out += [
        f"- files read from `{dir_}`; trials: {len(trials)}, participants with both methods: **{len(complete)}**"
        + (f", left out because a method is missing: {', '.join(left_out)}" if left_out else ""),
    ]
    agents = {s.get("user_agent", "") for s in sessions}
    if any("HeadlessChrome" in a for a in agents):
        out += ["", "> **WARNING: some sessions were recorded in a headless test browser. That is test data, not people. Do not quote this report.**"]
    versions = {s.get("app_version", "") for s in sessions}
    if len(versions) > 1:
        out += ["", f"> Warning: the sessions ran on different builds of the app ({', '.join(sorted(v for v in versions if v))}). Check that the changes between them do not affect the task."]
    n = len(complete)
    if n < 6:
        out += ["", f"> **{n} participant(s) with both methods is too few to conclude anything.** With {n} pairs the smallest p-value a Wilcoxon test can give is {min_possible_p(n):.3f}. Read the numbers as a pilot."]
    elif n % 4:
        out += ["", f"> {n} participants is not a multiple of 4, so the order of the methods is not fully balanced (see the table below)."]

    # order balance
    first = Counter()
    by_p_block = {}
    for t in trials:
        by_p_block.setdefault(t["participant"], {})[t["block"]] = t["mode"]
    for p in complete:
        first[by_p_block[p].get("0", "?")] += 1
    out += ["", "## Who started with which method", "", "| first method | participants |", "| --- | --- |"]
    out += [f"| {m} | {c} |" for m, c in sorted(first.items())]

    # task measures: per participant the median of their trials per method
    out += ["", "## Task measures (median of each person's trials, then median over people)", "",
            "Paired Wilcoxon signed-rank, camera vs keyboard. r = matched-pairs rank-biserial (positive: camera larger). `n used` = pairs with a difference.", "",
            "| measure | pairs | camera | keyboard | p | r | n used |", "| --- | --- | --- | --- | --- | --- | --- |"]
    def pairs_for(key, agg=statistics.median):
        return [(agg(pp[p]["camera"][key]), agg(pp[p]["keyboard"][key])) for p in complete]
    out.append(paired_row("time per task (s)", pairs_for("seconds"), " s", 1))
    out.append(paired_row("errors per task", pairs_for("errors"), "", 1))
    out.append(paired_row("attempts per task", pairs_for("attempts"), "", 1))
    out.append(paired_row("success rate", pairs_for("success", statistics.mean), "", 2))
    gave = {m: sum(sum(pp[p][m]["gaveup"]) for p in pp) for m in ("camera", "keyboard")}
    out += ["", f"Trials where the participant gave up: camera {int(gave['camera'])}, keyboard {int(gave['keyboard'])}."]

    # survey
    if scores:
        by = defaultdict(dict)
        for r in scores:
            by[r["participant"]][r["mode"]] = r
        both = [p for p in complete if {"camera", "keyboard"} <= set(by.get(p, {}))]
        if exclude_flagged:
            both = [p for p in both if (p, "camera") not in flagged and (p, "keyboard") not in flagged]
        out += ["", "## Survey", "",
                "Dimensions: mean of the items of each dimension, 1 = strongly disagree, 5 = strongly agree; the two reverse-worded items are flipped first. SUS: System Usability Scale, 0 to 100 (Brooke, 1996).", "",
                "| measure | pairs | camera | keyboard | p | r | n used |", "| --- | --- | --- | --- | --- | --- | --- |"]
        for d in DIMENSIONS:
            pairs = [(f(by[p]["camera"][d]), f(by[p]["keyboard"][d])) for p in both]
            pairs = [(a, b) for a, b in pairs if a is not None and b is not None]
            out.append(paired_row(d, pairs, "", 2))
        if any("sus" in by[p]["camera"] for p in both):
            pairs = [(f(by[p]["camera"].get("sus")), f(by[p]["keyboard"].get("sus"))) for p in both]
            pairs = [(a, b) for a, b in pairs if a is not None and b is not None]
            out.append(paired_row("SUS (0-100)", pairs, "", 1))
        out += ["", ("Surveys with careless-looking answers were EXCLUDED from this table (--exclude-flagged)." if exclude_flagged else "All surveys are included in this table (use --exclude-flagged to leave out the ones listed below).")]
        if flagged:
            out += ["", "### Answers that look careless", ""] + [f"- participant {p}, {m}: {'; '.join(w)}" for (p, m), w in sorted(flagged.items())]
            out += ["", "A flag is a reason to look at the survey, not proof. Decide before reading the results whether flagged surveys are excluded, and say which you chose."]
    # direct comparison
    if comps:
        out += ["", "## Direct comparison (asked once, after both methods)", "", "| question | camera | no difference | keyboard | sign test p (camera vs keyboard) |", "| --- | --- | --- | --- | --- |"]
        labels = {"cmp_easier": "easier to use", "cmp_enjoy": "enjoyed more", "cmp_choose": "would choose next time"}
        for key, label in labels.items():
            c = Counter(r.get(key, "") for r in comps)
            out.append(f"| {label} | {c['camera']} | {c['same']} | {c['keyboard']} | {sign_test(c['camera'], c['keyboard']):.3f} |")
    # camera performance
    fps = [f(t["camera_fps"]) for t in trials if t["mode"] == "camera" and t.get("camera_fps")]
    infer = [f(t["model_ms_mean"]) for t in trials if t["mode"] == "camera" and t.get("model_ms_mean")]
    if fps:
        out += ["", "## Camera pipeline during the camera trials (measured on the participants' own computers)", "",
                f"- trials with measurements: {len(fps)}; frames per second: median {statistics.median(fps):.1f} (min {min(fps):.1f}, max {max(fps):.1f}); hand model time per frame: median {statistics.median(infer):.1f} ms"]
    # who took part
    if profiles:
        out += ["", "## Participants", ""]
        for key, label in [("age", "age group"), ("sign_language", "sign language"), ("gesture_ui", "gesture interfaces before"), ("writing_hand", "writing hand")]:
            c = Counter(r.get(key, "") for r in profiles)
            out.append(f"- {label}: " + ", ".join(f"{k} {v}" for k, v in sorted(c.items())))
    out += ["", "## Reading this report", "",
            "- These participants are not necessarily the people the product is for (see docs/STUDY.md). Say so when you report results.",
            "- A p-value from few participants is weak evidence either way. Report effect sizes and the raw numbers, not only p.",
            "- The camera method only measures what the build could do at the time (for example picture cards before a letter model exists).", ""]
    return "\n".join(out)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dir", required=True, type=Path, help="folder with the exported CSV files")
    ap.add_argument("--out", type=Path, help="write the Markdown here (default: print)")
    ap.add_argument("--exclude-flagged", action="store_true", help="leave surveys that look careless out of the survey table")
    a = ap.parse_args(argv)
    report = build_report(a.dir, a.exclude_flagged)
    if a.out:
        a.out.parent.mkdir(parents=True, exist_ok=True)
        a.out.write_text(report, encoding="utf-8")
        print(f"wrote {a.out}")
    else:
        sys.stdout.write(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
