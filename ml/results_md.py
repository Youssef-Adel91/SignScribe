#!/usr/bin/env python3
"""Tidy docs/MODEL_RESULTS.md without ever writing a number into it.

    python ml/results_md.py docs/MODEL_RESULTS.md --list
    python ml/results_md.py docs/MODEL_RESULTS.md --remove "ASLAD"      # drop every section whose title contains this
    python ml/results_md.py docs/MODEL_RESULTS.md --normalise           # make the first lines say what the file now holds
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from signscribe_ml import results_md as rm  # noqa: E402


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--remove", metavar="TEXT", help="remove every section whose title contains TEXT")
    ap.add_argument("--normalise", action="store_true")
    a = ap.parse_args(argv)
    p = Path(a.file)
    if not p.exists():
        print(f"error: {p} not found", file=sys.stderr)
        return 2
    text = p.read_text(encoding="utf-8")
    if a.remove:
        new, removed = rm.remove_section(text, a.remove)
        if not removed:
            print(f"no section title contains '{a.remove}'. Titles: {rm.titles(text)}", file=sys.stderr)
            return 1
        p.write_text(new, encoding="utf-8")
        print("removed: " + "; ".join(removed))
    elif a.normalise:
        p.write_text(rm.normalise(text), encoding="utf-8")
    print("sections now: " + ("; ".join(rm.titles(p.read_text(encoding="utf-8"))) or "(none)"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
