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

### Windows (PowerShell), from the repository folder
The backtick at the end of a line continues the command. Replace the `D:\datasets\...` paths with yours. The `.jsonl` files go to `ml\data\` (git-ignored).

```powershell
# once
py -m venv .venv
.venv\Scripts\Activate.ps1                      # if PowerShell refuses: Set-ExecutionPolicy -Scope Process Bypass
pip install -r ml/requirements.txt -r ml/requirements-import.txt
npm ci
npm run models                                   # puts hand_landmarker.task into public\models

# 1. ArSL21L pictures: a flat folder <person>_<age>_<sex>_<class>_<n>.jpg (the folder is only read: nothing is moved or written there)
python ml/import_images.py `
  --images "D:\datasets\ArSL21L" --out ml\data\arsl21l.jsonl `
  --alphabet arsl --dataset-name ArSL21L --source arsl21l `
  --label-regex '_([a-z]+)_\d+\.jpg$' --person-regex '^(\d+)_' --age-regex '^\d+_(\d+)_'

# 2a. ArSL_dataset.csv: ';' between columns, header "Sign;x0;y0;x1;y1;...", the 42 coordinates are columns 1 to 42 (column 0 is Sign)
Get-Content "D:\datasets\ArSL_dataset.csv" -TotalCount 2          # look at the header and one row first
python ml/import_landmarks_csv.py `
  --csv "D:\datasets\ArSL_dataset.csv" --out ml\data\arsl_dataset_csv.jsonl `
  --alphabet arsl --dataset-name ArSL_dataset --source arsl-dataset-csv `
  --delimiter ';' --header yes --layout xy-interleaved --coords 1-42 --label-column Sign
#    if the numbers are written like 0,53 add:  --decimal-comma

# 2b. ASLAD-96K landmark CSV: no real header (the first line is column numbers), 63 interleaved coordinates 0..62,
#     26 angles 63..88, the class number in column 89, the image name ("ain (5191).jpg") in column 90
Get-Content "D:\datasets\ASLAD-96K\landmarks.csv" -TotalCount 3
python ml/import_landmarks_csv.py `
  --csv "D:\datasets\ASLAD-96K\landmarks.csv" --out ml\data\aslad.jsonl `
  --alphabet arsl --dataset-name ASLAD-96K --source aslad `
  --header no --skip-rows 1 --layout xyz-interleaved --coords 0-62 `
  --name-column 90 --numeric-label-column 89
#    optional, to keep it quick: --max-per-class 2000

# 3. read the three reports BEFORE evaluating: ml\data\*.import.md (per-class counts, skipped classes with their row counts,
#    "Class numbers learned" (must say 0 = ain), the layout check, the coordinate ranges, "Persons found: ..., of which under 18: ...")
Get-Content ml\data\arsl21l.import.md, ml\data\arsl_dataset_csv.import.md, ml\data\aslad.import.md

# 4. evaluate ArSL21L (leave-one-person-out); results are appended to docs\MODEL_RESULTS.md by the script and by nothing else
python ml/evaluate.py --data ml\data\arsl21l.jsonl --alphabet arsl `
  --dataset-name ArSL21L --dataset-version "as published" --augment all --augment-ablation --results-md docs\MODEL_RESULTS.md

# 5. optional: the two CSV files against each other (each file is one source: leave-one-source-out, a hard cross-dataset test)
python ml/evaluate.py --data ml\data\aslad.jsonl ml\data\arsl_dataset_csv.jsonl --alphabet arsl `
  --dataset-name "ASLAD-96K + ArSL_dataset" --dataset-version "as published" --results-md docs\MODEL_RESULTS.md
```

Guards and extras (all opt-in or automatic refusals):
- **Class coverage**: leave-one-source-out (and session) is refused when a held-out source has classes the training sources do not (that is how an "13%" was produced from two files that cover 21 and 32 classes). Add `--shared-classes` to evaluate only on the classes every source has; the report states which ones were dropped.
- **Suffix classes** in ASLAD (`haa+`, `haa++` ...): skipped and counted by default. Once you confirm what they are, `import_landmarks_csv.py ... --strip-class-suffix "\++$"` imports them as the base class (only names that are not in the alphabet and whose stripped form is).
- **Your own webcam takes as a test only**: `python ml/evaluate.py --train ml/data/arsl21l.jsonl --test my-takes.jsonl --test-name "team webcam" --alphabet arsl`.
- **Browser model**: `python ml/export_mlp.py --data ml/data/arsl21l.jsonl --alphabet arsl --out ml/reports/letters-mlp.json` (trains on all persons; do not copy ArSL models into `public/models/` yet).
- **Clean `docs/MODEL_RESULTS.md`**: `python ml/results_md.py docs/MODEL_RESULTS.md --list`, then `--remove "TEXT IN THE TITLE"` for a section that is not a valid result.

Linux and macOS: the same commands with `\` instead of the backtick, `/` in paths, `head -n 2 FILE` instead of `Get-Content`, and `python3 -m venv .venv && . .venv/bin/activate`.

What the three files need, as checked on the real files:
- `ArSL_dataset.csv` (7,010 rows, 31 classes): `;` delimiter, header `Sign;x0;y0;...`, 90 columns; the coordinates are columns 1 to 42, x and y only (so z is stored as 0). Its class names are aliases of the ArSL21L ids in `config/alphabets/arsl.json` where the Arabic letter is certain from the name (`3ayn` = `ain`, `9af` = `gaaf`, `Chin` = `sheen`, `Jim` = `jeem` ... 21 classes). `7a2`, `Ha2`, `DDad`, `TTa2`, `TTha2`, `Ta2` and `Ya2` are **not** mapped (their id is still undecided: see `todo` in that file), and `Space`, `Delete` and `Finish` are not letters. All of these are skipped, and the report lists **how many rows each has**.
- `ASLAD-96K`: `--header no --skip-rows 1` drops the line of column numbers (4096, 4097, ...; `--header auto` recognises it too). The class comes from the image name in column 90; column 89 (the number) is only **cross-checked**: the importer learns the numbering from the names, requires it to be one to one, and prints it so you can confirm `0 = ain`.

What the importers do and do not know:
- **ArSL21L**: `--label-regex` reads the class from the file name, `--person-regex` the person (here `1001`, 50 persons), `--age-regex` the age. The age is used only to mark persons **under 18** (`minor: true`); it is not stored. The import report says "Persons found: 50, of which under 18: 7" and nothing else about them, and **`evaluate.py` never prints or stores a result for any person** (no per-person accuracy, no person id, in the report or the JSON): the 7 are counted, they are inside the pooled numbers and the mean over persons, and the worst-person and best-person numbers cover the other persons only. Pictures with no hand are skipped and counted; YOLO `.txt` files are ignored because they are not pictures.
- **Landmark CSVs**: the file is read with the column layout **you** choose (`--layout`: `xyz-interleaved` = x0 y0 z0 x1 ..., `xyz-grouped` = all x, then all y, then all z; `xy-*` when there is no z). The importer then **measures** whether that layout gives a hand (no finger bone longer than 2.2 palm lengths) for each possible layout, prints the numbers in `<out>.import.md`, and stops if your layout does not fit (use `--force` to override). By default the first 63 (or 42) columns are the coordinates: pass `--coords` if they are not. The picture size is not in the file: `--width/--height` (default 1000x1000, a square) are an **assumption** and are written into the report. A file with no z stores z = 0; do not mix such a file with data that has z. `--delimiter ';'`, `--header yes|no|auto`, `--skip-rows N` and `--decimal-comma` cover the odd shapes. If the only class column is a number, pass `--numeric-label-names` (the class name of 0, 1, 2 ... in order): the numbering is **not assumed**, and if the file name column is also given the two are cross-checked. Classes that are not in `arsl.json` (`Space`, `Delete`, `Finish`, or an Arabic letter that is still in the `todo`) are skipped and counted, never guessed.
- **Never mix** `arsl21l.jsonl` with the CSV files in one `--data` (some takes have a person, some do not: the split would fall back to holding a whole dataset out; `evaluate.py` prints a notice).
- The CSV files are tagged with `--source` and never with a person; two signers in ASLAD are not known to the tool.
- Big files: `--max-per-class N` on the CSV importer keeps N random rows per class (fixed seed, stated in the report) so a 190k-row file stays quick to evaluate.
- **ArSL model in the app**: copy a model as `public/models/letters-arsl-mlp.json` / `letters-arsl-knn.json` (never under the ASL names; the app reads the pair of the alphabet chosen on screen 03 and refuses a model with other letters). The spelling screens show the glyph from `config/alphabets/arsl.json`; classes whose Arabic letter is not confirmed show as `⟨id⟩`. Still missing: Arabic word list and sentence rules, tuned `LETTER` thresholds, Arabic read-aloud: `docs/KNOWN_ISSUES.md` #15-#19.

`takes.jsonl` comes from the in-app collection mode (`/?collect=1`), format in `docs/DATASET.md`.

## Rules
- **No accuracy number is ever typed by hand.** Each training run writes `<model>.report.md` with the numbers it measured, the method (leave-one-signer-out when there are 2+ signers) and the dataset hash. Quote that file, nothing else.
- `docs/MODEL_RESULTS.md` is filled only by `evaluate.py --results-md`, which refuses synthetic and same-person runs.
- Models trained on generated data are marked `"synthetic": true` and the scripts refuse to write them without `--allow-synthetic`. They exist only to test the pipeline.
- The feature function exists twice (`signscribe_ml/features.py` and `src/recognition/features.ts`) and must stay identical: `ml/tests/golden_features.json` is checked by both test suites. Same for `$P` (`signscribe_ml/dollar.py`, `src/recognition/dollarP.ts`, golden file `golden_dollar.json`).
- Never split the frames of one take between training and test (they are almost identical and would inflate the result). The scripts group by take, session and signer.
