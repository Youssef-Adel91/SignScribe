"""Writes the evaluation report next to a model. This is the only place accuracy numbers come from."""
from __future__ import annotations

from .dataset import summary


def fmt(x):
    return "n/a" if x is None else f"{x * 100:.1f}%"


def write_report(path, title, takes, sha, ev, m, extra_lines=()):
    s = summary(takes)
    lines = [f"# {title}", ""]
    if s["synthetic"]:
        lines += [
            "> **SYNTHETIC DATA. This run only tests the pipeline. The numbers below say nothing about real hands and must not be quoted.**",
            "",
        ]
    lines += [
        f"- dataset sha256: `{sha}`",
        f"- takes: {s['takes']}, signers: {s['signers']}, sessions: {s['sessions']}",
        f"- evaluation method: **{ev['method']}** ({ev['groups']} held-out groups)",
        f"- samples evaluated: {m['samples']}",
        f"- k: {ev['k']}",
        *extra_lines,
        "",
        (f"**Accuracy on held-out groups ({ev['method']}): {fmt(m['accuracy'])}**" if ev.get("generalises", True) else f"**Same-person accuracy: {fmt(m['accuracy'])} (optimistic, NOT a result for new people)**"),
        "",
        "| letter | support | precision | recall |",
        "| ------ | ------- | --------- | ------ |",
    ]
    for l, v in m["per_label"].items():
        lines.append(f"| {l} | {v['support']} | {fmt(v['precision'])} | {fmt(v['recall'])} |")
    lines += ["", "Most frequent confusions (true -> predicted: count):", ""]
    lines += [f"- {a} -> {b}: {c}" for (a, b), c in m["top_confusions"]] or ["- none"]
    lines += [
        "",
        "Reading this: with a single signer the result only shows how repeatable that person is. Quote results for new people only when the method is leave-one-signer-out with several signers.",
        "",
    ]
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
