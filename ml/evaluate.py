#!/usr/bin/env python3
"""Leave-one-person-out (or source/signer/session) evaluation of the static-letter recognisers, k-NN against a small MLP.

    python ml/evaluate.py --data takes.jsonl --dataset-name ASL-Alphabet --dataset-version 2024-03 --out-dir ml/reports

Never prints a random-split accuracy as the result. With a single person/source it refuses unless --allow-optimistic,
and then labels the number as not generalising.
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from signscribe_ml import evaluation as ev  # noqa: E402
from signscribe_ml.alphabet import AlphabetError, load_alphabet  # noqa: E402
from signscribe_ml.augment import parse_augment  # noqa: E402
from signscribe_ml.dataset import DatasetError  # noqa: E402
from signscribe_ml.folds import FoldError  # noqa: E402


def main(argv=None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", nargs="+", required=True, help="one or more takes JSONL files (from import_images.py or the collection mode)")
    ap.add_argument("--alphabet", help="config/alphabets/<name>.json (default: the active one in config/alphabet.json)")
    ap.add_argument("--dataset-name", required=True, help="name of the dataset, written into the report")
    ap.add_argument("--dataset-version", required=True, help="version/date of the dataset as published, written into the report")
    ap.add_argument("--models", default="knn,mlp")
    ap.add_argument("--k", type=int, default=5, help="k-NN neighbours (fixed, not tuned on the held-out group)")
    ap.add_argument("--group-by", default="auto", choices=["auto", "person", "source", "signer", "session"])
    ap.add_argument("--augment", default="none", help="comma list of rotate,scale,mirror (or all/none): applied to training data only")
    ap.add_argument("--augment-copies", type=int, default=2)
    ap.add_argument("--augment-ablation", action="store_true", help="also run without augmentation on the same folds and report both")
    ap.add_argument("--min-confidence", type=float, default=ev.DEFAULT_MIN_CONFIDENCE)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out-dir", default="ml/reports")
    ap.add_argument("--results-md", help="append this run to this Markdown file (e.g. docs/MODEL_RESULTS.md); refused for synthetic data")
    ap.add_argument("--allow-synthetic", action="store_true", help="pipeline tests only")
    ap.add_argument("--allow-optimistic", action="store_true", help="allow the same-person fallback (labelled as optimistic)")
    a = ap.parse_args(argv)
    try:
        alphabet = load_alphabet(a.alphabet)
        takes, sha = ev.read_many(a.data, alphabet)
        prov = ev.provenance(["ml/evaluate.py", *argv], a.dataset_name, a.dataset_version, sha, takes, alphabet)
        if prov["synthetic"] and not a.allow_synthetic:
            raise ev.EvaluationError("the data contains synthetic takes; pass --allow-synthetic to test the pipeline")
        with_person = sum(1 for t in takes if t.person)
        if 0 < with_person < len(takes):
            print(
                f"notice: {with_person} of {len(takes)} takes have a person id and the rest do not, so person ids cannot be used for the split "
                "(it falls back to the source, which holds a WHOLE dataset out). To evaluate by person, pass only the files that have person ids.",
                file=sys.stderr,
            )
        aug = parse_augment(a.augment, a.augment_copies)
        models = tuple(m.strip() for m in a.models.split(",") if m.strip())
        runs = [("with augmentation", aug)] if aug.enabled else [("no augmentation", parse_augment("none"))]
        if a.augment_ablation and aug.enabled:
            runs.append(("no augmentation", parse_augment("none")))
        results = []
        for label, cfg in runs:
            r = ev.run(takes, models, a.k, cfg, a.seed, a.group_by, a.allow_optimistic)
            results.append((label, r))
    except (DatasetError, AlphabetError, FoldError, ev.EvaluationError, ValueError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    text = []
    for label, r in results:
        text.append(f"## {label}\n\n" + ev.markdown(r, prov, a.min_confidence))
    body = "\n".join(text)
    out = Path(a.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    stem = f"eval-{''.join(c if c.isalnum() or c in '-_.' else '_' for c in a.dataset_name)}-{prov['date'][:10]}"
    md_path, js_path = out / f"{stem}.md", out / f"{stem}.json"
    md_path.write_text(f"# Evaluation: {a.dataset_name} {a.dataset_version}\n\n{body}", encoding="utf-8")

    def strip(r):  # raw per-sample arrays make the JSON large; the metrics are what matter
        return {**r, "models": {m: {k: v for k, v in d.items() if k not in ("truth", "pred", "conf", "second", "conf2", "group")} for m, d in r["models"].items()}}

    js_path.write_text(json.dumps({"provenance": prov, "runs": [{"name": n, **strip(r)} for n, r in results]}, indent=1), encoding="utf-8")
    print(body)
    print(f"wrote {md_path} and {js_path}")
    if a.results_md:
        if prov["synthetic"] or not all(r["generalises"] for _, r in results):
            print("not appended to the results file: synthetic or same-person run", file=sys.stderr)
        else:
            p = Path(a.results_md)
            old = p.read_text(encoding="utf-8") if p.exists() else ""
            p.write_text(old.rstrip("\n") + f"\n\n---\n\n## {a.dataset_name} {a.dataset_version} ({prov['date'][:10]})\n\n{body}", encoding="utf-8")
            print(f"appended to {p}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
