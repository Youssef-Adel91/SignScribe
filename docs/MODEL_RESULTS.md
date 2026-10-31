# Model results

**There are no results yet.** Nothing here is an estimate, a guess or a number from generated data. A result is added by `ml/evaluate.py --results-md docs/MODEL_RESULTS.md` on real data, and by nothing else.

## Rules
- Every number below is written by `ml/evaluate.py --results-md docs/MODEL_RESULTS.md`. Nobody types a number into this file. Each section states the exact command, the dataset name and version, the dataset hash, the date and the git commit.
- The script refuses to append a run on synthetic data, a same-person split, or a split whose held-out groups have classes the training groups lack (a CSV that covers 21 of 32 classes held out against a file that covers all 32 is not a valid result), so a section that exists is a leave-one-person/source/signer/session-out result on real data.
- To remove a section that should not be there (for example one written before that last rule existed): `python ml/results_md.py docs/MODEL_RESULTS.md --remove "<text in its title>"`. It also rewrites the first lines so they say what the file holds.
- The headline is always the held-out-group result (pooled and mean over groups, with worst and best group). A random split is never reported.
- Augmentation is shown against no augmentation on the same folds (`--augment-ablation`); it stays only if it does not hurt on the held-out groups.
- The k-NN number is the one that applies to the app (the browser loads the k-NN). The MLP is a comparison.
- Camera behaviour (fps, latency, how it feels) is not in this file: it needs a real camera and goes in `docs/DONE.md`.

## How to add a result
    python ml/import_images.py --images PATH --out ml/data/NAME.jsonl --dataset-name NAME --source SOURCE [--person-regex REGEX]
    python ml/evaluate.py --data ml/data/NAME.jsonl --dataset-name NAME --dataset-version VERSION --augment all --augment-ablation --results-md docs/MODEL_RESULTS.md

Pictures from a public dataset stay on your machine (`ml/data/` is ignored by git); only landmarks are written, and only counts and percentages reach this file. Check the dataset's licence before using it.

## Results
(none yet)
