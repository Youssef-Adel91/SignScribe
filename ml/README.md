# SignScribe ML tooling (Python)

Training and evaluation for the two recognizers, written in Python to match what the labs used (MediaPipe, dollarpy).
The browser app only **consumes** the JSON model files these scripts write. See `docs/MODEL_HANDOFF.md` for the whole procedure.

| Recognizer | For | Script | Model file |
| ---------- | --- | ------ | ---------- |
| k-NN on 60 landmark features | static letters | `train_knn.py` | `public/models/letters-knn.json` |
| $P point cloud (dollarpy's algorithm) | letters that move (J, Z) | `train_dollar.py` | `public/models/motion-dollar.json` |

    python -m venv .venv && . .venv/bin/activate
    pip install -r ml/requirements.txt
    python -m pytest ml/tests            # pipeline tests, synthetic data only
    python ml/train_knn.py --data takes.jsonl --out public/models/letters-knn.json
    python ml/train_dollar.py --data takes.jsonl --out public/models/motion-dollar.json
    python ml/validate_model.py public/models/letters-knn.json

### Whole-alphabet pipeline (pictures -> honest evaluation -> model)
The letters come from `config/alphabets/*.json` (never from code). Pick the alphabet with `--alphabet asl|arsl` or edit `config/alphabet.json`.

    pip install -r ml/requirements-import.txt          # MediaPipe, only for the import (Linux also needs libegl1 libgles2)
    npm run models                                     # downloads public/models/hand_landmarker.task
    python ml/import_images.py --images PATH/TO/DATASET --out ml/data/asl.jsonl --dataset-name NAME --source SOURCE [--person-regex '(?P<person>user\d+)_']
    python ml/evaluate.py --data ml/data/asl.jsonl --dataset-name NAME --dataset-version VERSION --augment all --augment-ablation --results-md docs/MODEL_RESULTS.md
    python ml/train_knn.py --data ml/data/asl.jsonl --out public/models/letters-knn.json --augment all

| Script | What it does |
| ------ | ------------ |
| `import_images.py` | pictures -> takes (MediaPipe Hands). Per-letter counts, how many had no hand, folders that were ignored. Writes `<out>.import.md` |
| `evaluate.py` | leave-one-person-out (else source, signer, session), k-NN and a small MLP on the same folds, per-letter precision/recall, the 10 worst letter pairs, what the app would show at each confidence threshold, with and without augmentation. Refuses a same-person split |
| `train_knn.py` | writes the browser's model JSON (format unchanged) and a report; `--augment` adds rotated/stretched/mirrored copies to the stored samples |

The MLP is only for comparison: the browser still loads the k-NN JSON (`docs/MODEL_FORMAT.md`). If the MLP clearly wins on real data, adding a model type to the format and a small forward pass in TypeScript is the next step and needs a decision from the team.

`takes.jsonl` comes from the in-app collection mode (`/?collect=1`), format in `docs/DATASET.md`.

## Rules
- **No accuracy number is ever typed by hand.** Each training run writes `<model>.report.md` with the numbers it measured, the method (leave-one-signer-out when there are 2+ signers) and the dataset hash. Quote that file, nothing else.
- `docs/MODEL_RESULTS.md` is filled only by `evaluate.py --results-md`, which refuses synthetic and same-person runs.
- Models trained on generated data are marked `"synthetic": true` and the scripts refuse to write them without `--allow-synthetic`. They exist only to test the pipeline.
- The feature function exists twice (`signscribe_ml/features.py` and `src/recognition/features.ts`) and must stay identical: `ml/tests/golden_features.json` is checked by both test suites. Same for `$P` (`signscribe_ml/dollar.py`, `src/recognition/dollarP.ts`, golden file `golden_dollar.json`).
- Never split the frames of one take between training and test (they are almost identical and would inflate the result). The scripts group by take, session and signer.
