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

## ArSL: the three datasets on your machine (ArSL21L pictures, ASLAD landmark CSV, ArSL_dataset.csv)
Everything below runs on your computer; the repository never holds a picture or a landmark file (`ml/data/` and `datasets/` are git-ignored: keep the datasets and the `.jsonl` files outside any commit and check `git status` first). The label set is `config/alphabets/arsl.json`: the **32 ArSL21L class names** (`ain`, `al`, `aleff`, ... `zay`) as ids. It is marked `reviewed: false`; its `todo` list holds the Arabic mappings nobody has decided (`ta`/`taa`/`toot`, `ha`/`haa`, `ya`/`yaa`, and `dha`/`dhad`, `al`/`la`), and the importers never guess them.

    # once
    pip install -r ml/requirements.txt -r ml/requirements-import.txt
    npm run models                                     # public/models/hand_landmarker.task

    # 1. ArSL21L: a FLAT folder of pictures named <person>_<age>_<sex>_<class>_<n>.jpg (nothing is moved, copied or written there)
    python ml/import_images.py --images /path/to/ArSL21L --out ml/data/arsl21l.jsonl \
        --alphabet arsl --dataset-name ArSL21L --source arsl21l \
        --label-regex '_([a-z]+)_\d+\.jpg$' --person-regex '^(\d+)_' --age-regex '^\d+_(\d+)_'

    # 2. the landmark CSVs: FIRST look at the header and one row, then import. These two files were not inspected for this repository
    head -c 600 /path/to/ASLAD.csv                     # which column is the image name, which are the coordinates?
    python ml/import_landmarks_csv.py --csv /path/to/ASLAD.csv --out ml/data/aslad.jsonl \
        --alphabet arsl --dataset-name ASLAD --source aslad \
        --layout xyz-interleaved --name-column "image name"
    python ml/import_landmarks_csv.py --csv /path/to/ArSL_dataset.csv --out ml/data/arsl_dataset_csv.jsonl \
        --alphabet arsl --dataset-name ArSL_dataset --source arsl-dataset-csv \
        --layout xy-interleaved --label-column "<the class column>"

    # 3. evaluate (leave-one-person-out for ArSL21L; real numbers come only from this script)
    python ml/evaluate.py --data ml/data/arsl21l.jsonl --alphabet arsl \
        --dataset-name ArSL21L --dataset-version "<as published>" --augment all --augment-ablation --results-md docs/MODEL_RESULTS.md

    # 4. optional: the CSV files hold a WHOLE source out (they have no person ids). One file alone is refused; two files give leave-one-source-out
    python ml/evaluate.py --data ml/data/aslad.jsonl ml/data/arsl_dataset_csv.jsonl --alphabet arsl \
        --dataset-name "ASLAD + ArSL_dataset" --dataset-version "<as published>" --results-md docs/MODEL_RESULTS.md

What the importers do and do not know:
- **ArSL21L**: `--label-regex` reads the class from the file name, `--person-regex` the person (here `1001`, 50 persons), `--age-regex` the age. The age is used only to mark persons **under 18** (`minor: true`); it is not stored. The import report says "Persons found: 50, of which under 18: 7" and nothing else about them, and **`evaluate.py` never prints or stores a result for any person** (no per-person accuracy, no person id, in the report or the JSON): the 7 are counted, they are inside the pooled numbers and the mean over persons, and the worst-person and best-person numbers cover the other persons only. Pictures with no hand are skipped and counted; YOLO `.txt` files are ignored because they are not pictures.
- **Landmark CSVs**: the file is read with the column layout **you** choose (`--layout`: `xyz-interleaved` = x0 y0 z0 x1 ..., `xyz-grouped` = all x, then all y, then all z; `xy-*` when there is no z). The importer then **measures** whether that layout gives a hand (no finger bone longer than 2.2 palm lengths) for each possible layout, prints the numbers in `<out>.import.md`, and stops if your layout does not fit (use `--force` to override). By default the first 63 (or 42) columns are the coordinates: pass `--coords` if they are not. The picture size is not in the file: `--width/--height` (default 1000x1000, a square) are an **assumption** and are written into the report. A file with no z stores z = 0; do not mix such a file with data that has z. If the only class column is a number, pass `--numeric-label-names` (the class name of 0, 1, 2 ... in order): the numbering is **not assumed**, and if the file name column is also given the two are cross-checked. Classes that are not in `arsl.json` (`Space`, `Delete`, `Finish`, or an Arabic letter that is still in the `todo`) are skipped and counted, never guessed.
- **Never mix** `arsl21l.jsonl` with the CSV files in one `--data` (some takes have a person, some do not: the split would fall back to holding a whole dataset out; `evaluate.py` prints a notice).
- The CSV files are tagged with `--source` and never with a person; two signers in ASLAD are not known to the tool.
- Big files: `--max-per-class N` on the CSV importer keeps N random rows per class (fixed seed, stated in the report) so a 190k-row file stays quick to evaluate.
- **Do not copy an ArSL model into `public/models/` yet.** The spelling screens write the first character of a label, so `ain` would be written as `A`. ArSL in the app needs more work (labels that are names, the Arabic letter to show, an Arabic word list, right-to-left text): see `docs/MODEL_RESULTS.md` and `docs/WHATS_LEFT.md`.

`takes.jsonl` comes from the in-app collection mode (`/?collect=1`), format in `docs/DATASET.md`.

## Rules
- **No accuracy number is ever typed by hand.** Each training run writes `<model>.report.md` with the numbers it measured, the method (leave-one-signer-out when there are 2+ signers) and the dataset hash. Quote that file, nothing else.
- `docs/MODEL_RESULTS.md` is filled only by `evaluate.py --results-md`, which refuses synthetic and same-person runs.
- Models trained on generated data are marked `"synthetic": true` and the scripts refuse to write them without `--allow-synthetic`. They exist only to test the pipeline.
- The feature function exists twice (`signscribe_ml/features.py` and `src/recognition/features.ts`) and must stay identical: `ml/tests/golden_features.json` is checked by both test suites. Same for `$P` (`signscribe_ml/dollar.py`, `src/recognition/dollarP.ts`, golden file `golden_dollar.json`).
- Never split the frames of one take between training and test (they are almost identical and would inflate the result). The scripts group by take, session and signer.
