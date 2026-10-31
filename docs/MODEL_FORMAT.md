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

## Which file may be committed
The MLP JSON holds weights only and may be committed. No `*-knn.json` may be committed anywhere, with ONE exception: a generated test fixture under `tests/fixtures/` whose own JSON says `"meta": {"synthetic": true}` and that has at most 200 vectors (`tests/fixtures/arsl/letters-arsl-knn.json`); the pre-commit check and `tests/forbidden-files.test.ts` enforce it, also for `public/models/`. A **k-NN JSON stores real landmark samples** (`vectors`), so it is a copy of the training data: `public/models/*-knn.json` is git-ignored and refused by the pre-commit check (`npm run hooks:install`, `npm run check:staged`). The app still reads a local k-NN file as the fallback.

## Which file belongs to which alphabet
ASL: `letters-mlp.json` and `letters-knn.json` (the original names). Any other alphabet `<id>` from `config/alphabets/<id>.json`: `letters-<id>-mlp.json` and `letters-<id>-knn.json` (ArSL: `letters-arsl-*.json`). The browser reads the pair of the alphabet chosen on screen 03, the network first, the k-NN as fallback, and refuses a model that has a letter the alphabet does not have. Do not copy an ArSL model into `public/models/` under the ASL names.

## `letters-mlp.json` (static letters, small neural network)
Same file family, `type: "mlp"`, same `features` (`hand60-v1`). The browser tries this file first and falls back to `letters-knn.json` when it is missing, or broken (a console warning says why). With neither file the app says "No letter model yet".
| Field | Meaning |
| ----- | ------- |
| `labels` | the letters, in the order of the output layer |
| `standardize` | `mean` and `std` (60 numbers each, `std > 0`) applied to the features first |
| `layers` | list of `{w, b}`; `w[in][out]`, `b[out]`; 60-64-32-C is `[60x64, 64x32, 32xC]` |
| `meta` | as in the k-NN file, plus `network` (shape, optimiser, augmentation used) and `evaluation` (`null`, or the headline of an `evaluate.py` run made on exactly these takes) |

Forward pass: standardise, `x*w + b` per layer, ReLU between layers (not after the last), softmax. Written twice (`ml/signscribe_ml/mlp_model.py:forward`, `src/recognition/mlp.ts:mlpForward`) and checked against each other by `ml/tests/golden_mlp.json` (`tests/mlp.test.ts`, `ml/tests/test_mlp_model.py`; weights are rounded to 6 decimals in the file and the golden values are computed from the rounded file).

**Confidence is the softmax probability of the best letter.** That is a different kind of number from the k-NN vote share. The `LETTER` thresholds in `letterController.ts` were set for the k-NN and have **not** been tuned for this model: with a real camera, check them (Step 5 of `docs/MODEL_HANDOFF.md`) before trusting them.

## `motion-dollar.json` / `motion-arsl-dollar.json` (signs that move)
ASL: `motion-dollar.json` (J, Z). ArSL: `motion-arsl-dollar.json`, whose templates are the dynamic **controls** (`ctl_delete`, `ctl_cancel`): strokes of the index fingertip. Any other alphabet `<id>`: `motion-<id>-dollar.json`. The browser refuses templates whose label the alphabet does not have.

`type: "dollarP"`, `landmark` (which landmark's path, default 8 = index tip), `n` (points after resampling, 32), `templates` (`label` + recorded path). The algorithm is the one in `dollarpy` (the $P point-cloud recognizer used in the labs): resample, scale to a unit box, centre, greedy cloud matching; score `(2 - distance) / 2`, clamped at 0. Ported to Python (`ml/signscribe_ml/dollar.py`, tested against `dollarpy` itself) and TypeScript (`src/recognition/dollarP.ts`, tested against the Python golden file).

## `meta.evaluation` and the `.report.md`
Written by the training script from what it measured, with the method (`leave-one-signer-out`, `leave-one-session-out` or an explicitly optimistic 5-fold) and the dataset hash. Nothing is typed by hand. A model with `"synthetic": true` is for pipeline tests only; `tests/models-guard.test.ts` fails if one sits in `public/models/` (set `ALLOW_SYNTHETIC_MODEL=1` to try the pipeline locally).
