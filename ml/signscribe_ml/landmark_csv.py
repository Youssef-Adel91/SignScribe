"""Hand landmarks that already exist as CSV rows (ASLAD, ArSL_dataset.csv ...) -> takes in our dataset format.

Nobody checked what these files contain in this repository: the column layout, the coordinate frame (picture units, pixels,
wrist-relative ...), whether there is a depth value, the signers. So nothing is assumed silently: the layout is chosen by
the person who runs the import, the importer then MEASURES whether the chosen layout gives a hand (bone lengths) and says so,
and the report prints what it assumed. Rows are tagged with a `source`, never with a `person`.
"""
from __future__ import annotations

import csv
import hashlib
import random
import re
import statistics
from dataclasses import dataclass, field
from pathlib import Path

from .alphabet import Alphabet

LAYOUTS = {
    "xyz-interleaved": (63, 3, True),  # x0 y0 z0 x1 y1 z1 ... (21 landmarks)
    "xyz-grouped": (63, 3, False),  # x0..x20 y0..y20 z0..z20
    "xy-interleaved": (42, 2, True),  # x0 y0 x1 y1 ...
    "xy-grouped": (42, 2, False),  # x0..x20 y0..y20
}
# MediaPipe hand: thumb 1-4, index 5-8, middle 9-12, ring 13-16, pinky 17-20, all from the wrist 0; palm links
BONES = [(0, 1), (1, 2), (2, 3), (3, 4), (0, 5), (5, 6), (6, 7), (7, 8), (0, 9), (9, 10), (10, 11), (11, 12), (0, 13), (13, 14), (14, 15), (15, 16), (0, 17), (17, 18), (18, 19), (19, 20), (5, 9), (9, 13), (13, 17)]
PLAUSIBLE_MAX_BONE = 2.2  # no bone of a real hand is more than about this many wrist-to-middle-knuckle lengths long


class CsvError(ValueError):
    pass


def assemble(values, layout: str):
    """63 or 42 numbers -> 21 landmarks [x, y, z] (z = 0 when the file has no depth)."""
    n, dims, interleaved = LAYOUTS[layout]
    if len(values) != n:
        raise CsvError(f"layout {layout} needs {n} numbers, got {len(values)}")
    out = []
    for i in range(21):
        c = [values[i * dims + d] if interleaved else values[d * 21 + i] for d in range(dims)]
        out.append([c[0], c[1], c[2] if dims == 3 else 0.0])
    return out


def _dist(a, b):
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5


def hand_score(lm) -> float | None:
    """Longest bone divided by the wrist-to-middle-knuckle distance (2D). Small and steady for a real hand. None if undefined."""
    ref = _dist(lm[0], lm[9])
    if not ref > 1e-9:
        return None
    return max(_dist(lm[a], lm[b]) for a, b in BONES) / ref


def layout_check(rows, dims: int, sample: int = 500) -> dict:
    """For each layout with `dims` coordinates per landmark: the share of sampled rows that do NOT look like a hand."""
    out = {}
    pick = rows[:: max(1, len(rows) // sample)][:sample]
    for name, (n, d, _) in LAYOUTS.items():
        if d != dims:
            continue
        bad, scores = 0, []
        for r in pick:
            s = hand_score(assemble(r, name))
            if s is None or s > PLAUSIBLE_MAX_BONE:
                bad += 1
            else:
                scores.append(s)
        out[name] = {"implausible_share": bad / len(pick) if pick else 1.0, "median_longest_bone": statistics.median(scores) if scores else None, "rows": len(pick)}
    return out


def parse_columns(spec: str | None, header, default_count: int) -> list[int]:
    """`0-62`, `0,1,2`, or header names; None = the first `default_count` columns."""
    if not spec:
        return list(range(default_count))
    cols: list[int] = []
    for tok in (t.strip() for t in spec.split(",") if t.strip()):
        m = re.fullmatch(r"(\d+)-(\d+)", tok)
        if m:
            cols += list(range(int(m.group(1)), int(m.group(2)) + 1))
        elif tok.isdigit():
            cols.append(int(tok))
        elif header and tok in header:
            cols.append(header.index(tok))
        else:
            raise CsvError(f"column '{tok}' is not a number and not in the header")
    return cols


def column_index(spec: str | None, header) -> int | None:
    if spec is None:
        return None
    if spec.isdigit():
        return int(spec)
    if header and spec in header:
        return header.index(spec)
    raise CsvError(f"column '{spec}' is not a number and not in the header")


@dataclass
class CsvStats:
    rows: int = 0
    bad_rows: int = 0  # rows with a missing or non-numeric coordinate
    per_label: dict = field(default_factory=dict)
    ignored: dict = field(default_factory=dict)  # class name -> rows
    no_label: int = 0
    dropped_by_cap: int = 0
    layout: str = ""
    layout_check: dict = field(default_factory=dict)
    coord_ranges: dict = field(default_factory=dict)
    label_conflicts: list = field(default_factory=list)
    learned_numbers: dict = field(default_factory=dict)  # number -> class, learned from a file-name column; checked to be one-to-one
    skipped_header_lines: int = 0
    merged: dict = field(default_factory=dict)  # original class name -> rows merged into its base class by --strip-class-suffix


def to_float(text: str, decimal_comma: bool = False) -> float:
    """float(), optionally with a decimal comma ('0,53') for files that use ';' between columns."""
    return float(text.strip().replace(",", ".") if decimal_comma else text)


def read_csv(path, header_mode: str = "auto", coord_cols=None, delimiter: str = ",", skip_rows: int = 0, decimal_comma: bool = False):
    """(header or None, rows as lists of strings).

    `skip_rows` drops that many leading lines first (for example a line of column numbers that is not data). A first line made
    of consecutive whole numbers (4096, 4097, 4098 ...) is also taken for such a line in `auto` mode: it is a counter, not a row."""
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = [r for r in csv.reader(f, delimiter=delimiter) if r]
    rows = rows[skip_rows:]
    if not rows:
        raise CsvError("the file is empty")
    first = rows[0]

    def numeric(r, cols):
        try:
            [to_float(r[c], decimal_comma) for c in cols]
            return True
        except (ValueError, IndexError):
            return False

    def counter(r):
        try:
            v = [int(x) for x in r]
        except ValueError:
            return False
        return len(v) >= 10 and all(b - a == 1 for a, b in zip(v, v[1:]))

    probe = coord_cols if coord_cols else list(range(min(len(first), 6)))
    has_header = header_mode == "yes" or (header_mode == "auto" and (not numeric(first, probe) or counter(first)))
    return (first, rows[1:]) if has_header else (None, rows)


def import_csv(
    path,
    alphabet: Alphabet,
    source: str,
    layout: str,
    name_column: str | None = None,
    name_regex: str = r"^(.+?)\s*\(\d+\)",
    label_column: str | None = None,
    numeric_label_column: str | None = None,
    numeric_label_names: list | None = None,
    coords: str | None = None,
    header_mode: str = "auto",
    delimiter: str = ",",
    hand: str = "right",
    width: int = 1000,
    height: int = 1000,
    max_per_class: int = 0,
    seed: int = 0,
    dataset_name: str = "",
    force: bool = False,
    now: str | None = None,
    skip_rows: int = 0,
    decimal_comma: bool = False,
    strip_suffix: str | None = None,
):
    """Returns (takes as dicts, stats). Rows whose class is not a label of the alphabet are counted, not imported."""
    import datetime

    if layout not in LAYOUTS:
        raise CsvError(f"layout must be one of {', '.join(LAYOUTS)}")
    n, dims, _ = LAYOUTS[layout]
    if not (name_column or label_column or numeric_label_column):
        raise CsvError("say where the class is: --name-column (a file name such as 'ain (5191).jpg'), --label-column (a class name or an Arabic letter) or --numeric-label-column with --numeric-label-names")
    if numeric_label_column and not (name_column or label_column) and not numeric_label_names:
        raise CsvError("a numeric label needs --numeric-label-names (the class name of 0, 1, 2 ... in order), because the order is not known")
    first_pass = read_csv(path, header_mode, parse_columns(coords, None, n) if coords and not re.search(r"[A-Za-z]", coords) else None, delimiter, skip_rows, decimal_comma)
    header, rows = first_pass
    cols = parse_columns(coords, header, n)
    if len(cols) != n:
        raise CsvError(f"layout {layout} needs {n} coordinate columns, --coords gives {len(cols)}")
    iname, ilabel, inum = column_index(name_column, header), column_index(label_column, header), column_index(numeric_label_column, header)
    rx = re.compile(name_regex) if name_column else None
    sufrx = re.compile(strip_suffix) if strip_suffix else None
    stats = CsvStats(layout=layout)

    numbers, meta = [], []
    for i, r in enumerate(rows):
        stats.rows += 1
        try:
            vals = [to_float(r[c], decimal_comma) for c in cols]
        except (ValueError, IndexError):
            stats.bad_rows += 1
            continue
        names = []
        if iname is not None:
            m = rx.search(r[iname].strip()) if iname < len(r) else None
            if m:
                names.append(("name", m.group(1)))
        if ilabel is not None and ilabel < len(r) and r[ilabel].strip():
            names.append(("label", r[ilabel].strip()))
        num = None
        if inum is not None and inum < len(r):
            try:
                num = int(float(r[inum]))
            except ValueError:
                num = None
            if num is not None and numeric_label_names:
                if 0 <= num < len(numeric_label_names):
                    names.append(("number", numeric_label_names[num]))
        numbers.append(vals)
        meta.append((i, r[iname].strip() if iname is not None and iname < len(r) else "", names, num))
    if not numbers:
        raise CsvError("no row has numeric coordinates in those columns: check --coords, --header and --skip-rows" + (", and --decimal-comma if the numbers look like 0,53" if delimiter != "," else ""))

    stats.layout_check = layout_check(numbers, dims)
    chosen = stats.layout_check[layout]
    best = min(stats.layout_check.values(), key=lambda v: v["implausible_share"])
    if not force and chosen["implausible_share"] > 0.5:
        alt = min(stats.layout_check, key=lambda k: stats.layout_check[k]["implausible_share"])
        raise CsvError(
            f"with layout {layout} {chosen['implausible_share'] * 100:.0f}% of the sampled rows do not look like a hand (a finger bone longer than {PLAUSIBLE_MAX_BONE} palm lengths). "
            + (f"Layout {alt} fits better ({stats.layout_check[alt]['implausible_share'] * 100:.0f}% implausible). " if alt != layout and stats.layout_check[alt]["implausible_share"] < chosen["implausible_share"] else "")
            + "Check --layout and --coords, or pass --force to import anyway."
        )
    wrist_x = [assemble(r, layout)[0][0] for r in numbers[:2000]]
    allx = [p[0] for r in numbers[:500] for p in assemble(r, layout)]
    ally = [p[1] for r in numbers[:500] for p in assemble(r, layout)]
    stats.coord_ranges = {"x": (min(allx), max(allx)), "y": (min(ally), max(ally)), "wrist_x_spread": (max(wrist_x) - min(wrist_x)) if wrist_x else 0.0}

    # a class NUMBER next to a class NAME in the file: learn the numbering from the names (never assumed) and require it to be one-to-one
    if inum is not None and (iname is not None or ilabel is not None) and not numeric_label_names:
        seen: dict = {}
        for _, _, names, num in meta:
            if sufrx is not None:
                names = [(src, sufrx.sub("", v) if alphabet.resolve(v) is None else v) for src, v in names]
            cls = next((alphabet.resolve(v) for _, v in names if alphabet.resolve(v) is not None), None)
            if num is not None and cls is not None:
                seen.setdefault(num, set()).add(cls)
        bad = {k: sorted(v) for k, v in seen.items() if len(v) > 1}
        classes_numbers: dict = {}
        for k, v in seen.items():
            for c in v:
                classes_numbers.setdefault(c, set()).add(k)
        bad_classes = {c: sorted(v) for c, v in classes_numbers.items() if len(v) > 1}
        if sufrx is not None:
            bad_classes = {}  # merging suffix classes makes several numbers one class on purpose
        if (bad or bad_classes) and not force:
            raise CsvError(f"the class numbers and the class names in the file do not match one to one (numbers with several names: {len(bad)}, names with several numbers: {len(bad_classes)}): the numbering is not what the names say. Check the columns or pass --force.")
        stats.learned_numbers = {k: sorted(v)[0] for k, v in sorted(seen.items()) if len(v) == 1}

    # the class of every row; when several sources of the class are given they must agree
    by_label: dict = {}
    for idx, (i, fname, names, num) in enumerate(meta):
        if sufrx is not None:
            # OPT-IN: a class such as 'haa++' is imported as its base class 'haa'. Off by default: nobody has confirmed what the suffixes mean
            fixed = []
            for src, v in names:
                base = sufrx.sub("", v)
                if base != v and alphabet.resolve(v) is None and alphabet.resolve(base) is not None:
                    stats.merged[v] = stats.merged.get(v, 0) + 1
                    v = base
                fixed.append((src, v))
            names = fixed
        resolved = {alphabet.resolve(v) for _, v in names if alphabet.resolve(v) is not None}
        unresolved = [v for _, v in names if alphabet.resolve(v) is None]
        if len(resolved) > 1:
            stats.label_conflicts.append(i)
            continue
        if not names:
            stats.no_label += 1
            continue
        if not resolved:
            key = unresolved[0]
            stats.ignored[key] = stats.ignored.get(key, 0) + 1
            continue
        by_label.setdefault(resolved.pop(), []).append(idx)
    if stats.label_conflicts and not force:
        raise CsvError(f"{len(stats.label_conflicts)} rows have a numeric label that disagrees with the class name in the file name: the numbering is not what --numeric-label-names says. Fix it or pass --force.")

    rng = random.Random(seed)
    takes = []
    now = now or datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    for label in sorted(by_label):
        idxs = by_label[label]
        if alphabet.kind_of(label) == "dynamic":
            continue
        if max_per_class and len(idxs) > max_per_class:
            stats.dropped_by_cap += len(idxs) - max_per_class
            idxs = sorted(rng.sample(idxs, max_per_class))
        for idx in idxs:
            i, fname, _, _ = meta[idx]
            lm = assemble(numbers[idx], layout)
            takes.append(
                {
                    "v": 1,
                    "id": hashlib.sha1(f"{dataset_name}|{source}|{i}|{fname}".encode("utf-8")).hexdigest()[:24],
                    "label": label,
                    "kind": "static",
                    "signer": f"src-{source}",
                    "session": source,
                    "hand": hand,
                    "width": width,
                    "height": height,
                    "createdAt": now,
                    "frames": [{"t": 0, "lm": [[round(v, 6) for v in p] for p in lm]}],
                    "source": source,
                }
            )
        stats.per_label[label] = len(idxs)
    return takes, stats


def sufrx_base(name: str) -> str:
    return name.rstrip("+")


def report_markdown(stats: CsvStats, alphabet: Alphabet, meta: dict) -> str:
    L = ["# Landmark CSV import report", ""]
    for k, v in meta.items():
        L.append(f"- {k}: {v}")
    L += ["", f"Rows read: {stats.rows}; rows with a missing or non-numeric coordinate: {stats.bad_rows}.", ""]
    L += ["## What was assumed, and what was measured", ""]
    L.append(f"- Column layout chosen by you: **{stats.layout}**. Share of sampled rows that do NOT look like a hand (a finger bone longer than {PLAUSIBLE_MAX_BONE} palm lengths) under each layout:")
    for name, v in stats.layout_check.items():
        med = f"{v['median_longest_bone']:.2f}" if v["median_longest_bone"] is not None else "n/a"
        L.append(f"  - {name}: {v['implausible_share'] * 100:.1f}% implausible, median longest bone / palm length {med} ({v['rows']} rows)" + (" <- chosen" if name == stats.layout else ""))
    r = stats.coord_ranges
    L.append(f"- Coordinates: x from {r['x'][0]:.3f} to {r['x'][1]:.3f}, y from {r['y'][0]:.3f} to {r['y'][1]:.3f}. Inside 0..1 usually means picture units; much bigger means pixels; around 0 means relative to the wrist. All three work for the features (they use differences and the palm length), but a picture-size aspect ratio is unknown: the width and height given on the command line are an ASSUMPTION.")
    if "xy" in stats.layout:
        L.append("- This file has no depth (z): z is stored as 0. A model trained on it is NOT comparable with one trained on data that has z, and the browser sends z.")
    L += ["", "| class | rows imported |", "| --- | --- |"]
    for l in alphabet.labels:
        L.append(f"| {l} | {stats.per_label.get(l, 0)} |")
    L += ["", f"**Total imported: {sum(stats.per_label.values())} rows.**", ""]
    if stats.learned_numbers:
        L.append("Class numbers learned from the names in the file (check them against what you know about the file): " + ", ".join(f"{k} = {v}" for k, v in list(stats.learned_numbers.items())[:40]) + (" ..." if len(stats.learned_numbers) > 40 else ""))
        L.append("")
    if stats.merged:
        L.append("Classes merged into their base class by --strip-class-suffix (check that this is what they are before using the result): " + ", ".join(f"{n} -> {sufrx_base(n)} ({c} rows)" for n, c in sorted(stats.merged.items())))
        L.append("")
    if stats.ignored:
        L += ["Classes skipped, with their row counts (not a label of this alphabet; nothing was guessed. Letters in the `todo` of the alphabet file are skipped until the team decides):", "", "| skipped class | rows |", "| --- | --- |"]
        for n, c in sorted(stats.ignored.items(), key=lambda kv: (-kv[1], kv[0])):
            L.append(f"| {n} | {c} |")
        L.append("")
    if stats.no_label:
        L.append(f"{stats.no_label} rows had no readable class and were skipped.")
    if stats.dropped_by_cap:
        L.append(f"{stats.dropped_by_cap} rows were left out by --max-per-class (random, fixed seed).")
    L.append("Every row is tagged with `source`, never with a person: nothing about who signed is known, so an evaluation can only hold a whole source out.")
    return "\n".join(L) + "\n"
