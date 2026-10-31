#!/usr/bin/env python3
"""Import hand landmarks that are already in a CSV file (ASLAD landmark CSV, ArSL_dataset.csv ...) as takes in our dataset format.

    python ml/import_landmarks_csv.py --csv PATH/aslad.csv --out ml/data/aslad.jsonl --alphabet arsl --source aslad \\
        --layout xyz-interleaved --name-column "image name"

Rows are tagged with --source (never with a person). Read ml/README.md first: the column layout and the coordinate frame of
these files were not checked, so the importer measures whether the layout you chose gives a hand, and says what it assumed."""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from signscribe_ml import landmark_csv as lc  # noqa: E402
from signscribe_ml.alphabet import AlphabetError, load_alphabet  # noqa: E402
from signscribe_ml.dataset import parse_take  # noqa: E402


def main(argv=None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--csv", required=True)
    ap.add_argument("--out", required=True, help="takes JSONL to write")
    ap.add_argument("--source", required=True, help="a tag for this file, e.g. aslad or arsl-dataset-csv (goes into every take; evaluation can hold a source out)")
    ap.add_argument("--layout", required=True, choices=list(lc.LAYOUTS), help="how the coordinates are laid out in a row: x0 y0 z0 x1 ... (interleaved) or all x, then all y, then all z (grouped); xy-* when there is no depth")
    ap.add_argument("--alphabet", help="config/alphabets/<name>.json (default: the active one)")
    ap.add_argument("--coords", help="the coordinate columns: 0-62, or a list, or header names (default: the first 63 / 42 columns)")
    ap.add_argument("--header", default="auto", choices=["auto", "yes", "no"])
    ap.add_argument("--delimiter", default=",", help="the column separator, for example ';'")
    ap.add_argument("--skip-rows", type=int, default=0, help="drop this many leading lines first (a line that is not data, such as a row of column numbers)")
    ap.add_argument("--decimal-comma", action="store_true", help="the numbers are written 0,53 (usual in files that separate columns with ';')")
    ap.add_argument("--name-column", help="column (a number from 0, or a header name) with a file name that carries the class, e.g. 'ain (5191).jpg'")
    ap.add_argument("--name-regex", default=r"^(.+?)\s*\(\d+\)", help="regular expression for the class inside that name (group 1)")
    ap.add_argument("--label-column", help="column (a number from 0, or a header name) with the class itself: a class name or an Arabic letter (resolved through the alphabet's aliases)")
    ap.add_argument("--numeric-label-column", help="column with a class number. With a name column too, the numbering is learned from the names and must be one to one (the report lists it)")
    ap.add_argument("--numeric-label-names", help="comma-separated class names for 0, 1, 2 ... (needed when the number is the only label; the order is NOT known, so it is never assumed). Cross-checked against --name-column when both are given")
    ap.add_argument("--strip-class-suffix", metavar="REGEX", help="OPT-IN: remove this from a class name that is not in the alphabet when what is left IS a class, so 'haa+' and 'haa++' are imported as 'haa' (example: '\\++$'). Off by default: do not use it until it is confirmed what the suffixes mean. The report lists what was merged")
    ap.add_argument("--hand", default="right", choices=["right", "left"])
    ap.add_argument("--width", type=int, default=1000, help="ASSUMED picture width (the aspect ratio is not in the file)")
    ap.add_argument("--height", type=int, default=1000, help="ASSUMED picture height")
    ap.add_argument("--max-per-class", type=int, default=0, help="keep at most this many rows per class (random, fixed seed); 0 = all")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--dataset-name", default="")
    ap.add_argument("--force", action="store_true", help="import even if the layout does not look like a hand or the numeric labels disagree")
    ap.add_argument("--overwrite", action="store_true")
    a = ap.parse_args(argv)
    out = Path(a.out)
    if out.exists() and not a.overwrite:
        print(f"error: {out} exists (use --overwrite)", file=sys.stderr)
        return 2
    try:
        alphabet = load_alphabet(a.alphabet)
        takes, stats = lc.import_csv(
            a.csv, alphabet, a.source, a.layout, a.name_column, a.name_regex, a.label_column, a.numeric_label_column,
            [s.strip() for s in a.numeric_label_names.split(",")] if a.numeric_label_names else None,
            a.coords, a.header, a.delimiter, a.hand, a.width, a.height, a.max_per_class, a.seed, a.dataset_name, a.force,
            skip_rows=a.skip_rows, decimal_comma=a.decimal_comma, strip_suffix=a.strip_class_suffix,
        )
    except (lc.CsvError, AlphabetError, OSError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    if not alphabet.reviewed:
        print(f"warning: alphabet '{alphabet.id}' is not reviewed yet (config/alphabets/{alphabet.id}.json, see its 'todo')", file=sys.stderr)
    for t in takes:
        parse_take(t, 0, alphabet.labels)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("".join(json.dumps(t, separators=(",", ":")) + "\n" for t in sorted(takes, key=lambda t: t["id"])), encoding="utf-8")
    rep = lc.report_markdown(stats, alphabet, {"command": "python ml/import_landmarks_csv.py " + " ".join(argv), "alphabet": alphabet.id, "dataset": a.dataset_name or "(not named)", "source": a.source, "assumed picture size": f"{a.width}x{a.height}", "output": str(out)})
    out.with_suffix(".import.md").write_text(rep, encoding="utf-8")
    print(rep)
    return 0 if takes else 1


if __name__ == "__main__":
    raise SystemExit(main())
