"""docs/MODEL_RESULTS.md: appending the result of a real run, removing one that is not valid, and keeping the first lines honest.

Nobody types a number into that file: evaluate.py appends a whole section written from what it measured. This module only moves
sections around. A section is `---`, a blank line, `## <dataset> <version> (<date>)` and its body."""
from __future__ import annotations

import re
from pathlib import Path

NO_RESULTS = (
    "**There are no results yet.** Nothing here is an estimate, a guess or a number from generated data. "
    "A result is added by `ml/evaluate.py --results-md docs/MODEL_RESULTS.md` on real data, and by nothing else."
)
SECTION = re.compile(r"^---\n\n## (.+)\n", re.M)
RESULTS_HEAD = re.compile(r"^## Results\s*\n", re.M)


def _split(text: str):
    """(head including '## Results', [(title, body)])"""
    m = RESULTS_HEAD.search(text)
    if not m:
        return text.rstrip("\n") + "\n\n## Results\n\n", []
    head, tail = text[: m.end()], text[m.end() :]
    marks = list(SECTION.finditer(tail))
    secs = []
    for i, mk in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(tail)
        secs.append((mk.group(1).strip(), tail[mk.start() : end].rstrip("\n") + "\n"))
    return head, secs


def titles(text: str) -> list:
    return [t for t, _ in _split(text)[1]]


def _status(secs) -> str:
    if not secs:
        return NO_RESULTS
    names = "; ".join(t for t, _ in secs)
    return (
        "**Produced by `ml/evaluate.py` runs on real data, one section per run** (below: " + names + "). "
        "Nobody types a number into this file. A run on generated data, a same-person split or a split whose held-out groups have classes the training groups lack is refused by the script and cannot appear here."
    )


def _rebuild(head: str, secs) -> str:
    # the first status paragraph (old or new wording) is replaced by one that matches what the file now holds
    head = re.sub(r"<!-- status:start -->.*?<!-- status:end -->", "STATUS", head, flags=re.S)
    if "STATUS" not in head:
        head = re.sub(r"^\*\*(?:There are no results yet\.|Produced by `ml/evaluate\.py`)[^\n]*$", "STATUS", head, count=1, flags=re.M)
    status = _status(secs)
    head = head.replace("STATUS", status, 1) if "STATUS" in head else head
    head = head.replace("(none yet)\n", "")
    body = "".join("\n" + b for _, b in secs) if secs else "\n(none yet)\n"
    return head.rstrip("\n") + "\n" + body


def normalise(text: str) -> str:
    head, secs = _split(text)
    return _rebuild(head, secs)


def append_section(text: str, title: str, body: str) -> str:
    head, secs = _split(text)
    secs = [(t, b) for t, b in secs if t != title]  # the same run again replaces the old one
    secs.append((title, f"---\n\n## {title}\n\n{body.strip()}\n"))
    return _rebuild(head, secs)


def remove_section(text: str, needle: str):
    """(new text, titles removed). The needle is matched inside the section titles."""
    head, secs = _split(text)
    removed = [t for t, _ in secs if needle in t]
    return _rebuild(head, [(t, b) for t, b in secs if needle not in t]), removed


def update_file(path, fn) -> list:
    p = Path(path)
    old = p.read_text(encoding="utf-8") if p.exists() else ""
    new = fn(old)
    p.write_text(new, encoding="utf-8")
    return titles(new)
