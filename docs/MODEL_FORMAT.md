# Model files

Both are JSON, written by `ml/` and loaded by the browser from `public/models/` (`letters-knn.json`, `motion-dollar.json`). A missing file is normal (the app says "No letter model yet"); a broken file is reported with a plain message. `ml/validate_model.py` and `src/recognition/*` (`parseKnnModel`, `parseDollarModel`) enforce the same rules.

## `letters-knn.json` (static letters)
| Field | Meaning |
| ----- | ------- |
| `format`, `version`, `type` | `"signscribe-model"`, `1`, `"knn"` |
| `features` | `"hand60-v1"`: 20 landmarks (wrist dropped) x 3, relative to the wrist and divided by the wrist to middle-knuckle distance; x mirrored for left-handed signers. Defined twice, in `ml/signscribe_ml/features.py` and `src/recognition/features.ts`, and checked against each other by `ml/tests/golden_features.json` |
| `k` | neighbours that vote |
| `labels` | the letters in the model |
| `vectors`, `y` | stored samples (60 numbers each, 4 decimals) and the index into `labels` for each |
| `meta` | `trainedAt`, `datasetSha256` (exact data it came from), `takes`, `signers`, `synthetic`, `evaluation` |

Recognition: each of the k nearest samples votes for its letter with weight `1/(distance + 1e-6)`. **Confidence is the winner's share of the votes. It is not a probability of being right.** Whether a given threshold (`LETTER` in `src/recognition/letterController.ts`) is a good one is only known by measuring on real data.

## `motion-dollar.json` (signs that move)
`type: "dollarP"`, `landmark` (which landmark's path, default 8 = index tip), `n` (points after resampling, 32), `templates` (`label` + recorded path). The algorithm is the one in `dollarpy` (the $P point-cloud recognizer used in the labs): resample, scale to a unit box, centre, greedy cloud matching; score `(2 - distance) / 2`, clamped at 0. Ported to Python (`ml/signscribe_ml/dollar.py`, tested against `dollarpy` itself) and TypeScript (`src/recognition/dollarP.ts`, tested against the Python golden file).

## `meta.evaluation` and the `.report.md`
Written by the training script from what it measured, with the method (`leave-one-signer-out`, `leave-one-session-out` or an explicitly optimistic 5-fold) and the dataset hash. Nothing is typed by hand. A model with `"synthetic": true` is for pipeline tests only; `tests/models-guard.test.ts` fails if one sits in `public/models/` (set `ALLOW_SYNTHETIC_MODEL=1` to try the pipeline locally).
