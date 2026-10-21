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

`takes.jsonl` comes from the in-app collection mode (`/?collect=1`), format in `docs/DATASET.md`.

## Rules
- **No accuracy number is ever typed by hand.** Each training run writes `<model>.report.md` with the numbers it measured, the method (leave-one-signer-out when there are 2+ signers) and the dataset hash. Quote that file, nothing else.
- Models trained on generated data are marked `"synthetic": true` and the scripts refuse to write them without `--allow-synthetic`. They exist only to test the pipeline.
- The feature function exists twice (`signscribe_ml/features.py` and `src/recognition/features.ts`) and must stay identical: `ml/tests/golden_features.json` is checked by both test suites. Same for `$P` (`signscribe_ml/dollar.py`, `src/recognition/dollarP.ts`, golden file `golden_dollar.json`).
- Never split the frames of one take between training and test (they are almost identical and would inflate the result). The scripts group by take, session and signer.
