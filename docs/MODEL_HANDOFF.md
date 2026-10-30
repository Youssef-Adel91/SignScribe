# Model handoff: how to collect data, train and install the letter model

For Youssef and the team. Everything the app needs around the model is built and tested **with generated data only**. Nobody has yet recorded a real hand for this project, so **no accuracy exists**. The model itself is yours to build, and these steps are how.

## What exists
| Piece | Where | State |
| ----- | ----- | ----- |
| Collection mode (`/?collect=1`) | `src/collect/` | built; tested with synthetic hands; **not tried on a real camera** |
| Dataset format | `docs/DATASET.md` | documented, read by both languages |
| k-NN trainer, evaluation, export | `ml/train_knn.py` | built; pipeline tested on generated data |
| $P trainer (moving letters J, Z) | `ml/train_dollar.py` | built; ported from dollarpy and tested against it |
| Model loader + recogniser interface | `src/recognition/` | built; Python-written model verified to give the same answers in TypeScript |
| Letter hold / confirm logic | `src/recognition/letterController.ts` | built; thresholds are **guesses** until real data |
| Wizard of Oz letters (`/?woz=1`) | `src/dev/WozPanel.tsx` | built; lets a facilitator type letters for a study with no model |

## Decisions you must make first
1. **Which fingerspelling alphabet?** Say ASL or ArSL, then set `config/alphabet.json` (and check the label file in `config/alphabets/`: the ArSL one is an unchecked template). The app assumes one signing hand (the command zone is for the other hand), which fits ASL fingerspelling (J and Z are drawn in the air). British (BSL) fingerspelling uses two hands and does not fit this design. Arabic sign letters are a separate model and screen 03 shows them as "Coming soon".
2. **Who signs for the dataset?** The most valuable thing is several different people. See step 2.
3. **Do you keep k-NN?** It is the baseline asked for. The app only knows the `StaticRecognizer` interface (`src/recognition/types.ts`): a better classifier trained in Python only has to export a model the TypeScript side can read, or add a new class next to `KnnRecognizer`.

## Step 0: set up Python (once)
    python3 -m venv .venv && . .venv/bin/activate
    pip install -r ml/requirements.txt
    python -m pytest ml/tests       # must pass; it also checks our $P against the dollarpy package

## Step 0b: a public picture dataset instead of (or before) your own recordings
`ml/import_images.py` turns a folder of labelled pictures into takes with MediaPipe, and `ml/evaluate.py` measures it by leaving whole people (or sources) out. Commands and flags: `ml/README.md`. Read the import report first: letters with few pictures, how many pictures had no hand, folders that were ignored. Datasets whose pictures show one person each work best with `--person-regex`; with no person ids use `--source` and add more than one source, or the evaluation refuses to run. Check the dataset's licence. Results go to `docs/MODEL_RESULTS.md` through the script only.

## Step 1: check the camera side first
Open `/?dev=1` and use the checklist in `docs/PHASE2_CHECKLIST.md`. If hand tracking itself is poor in your room (dark, backlit, hand too close), a model cannot fix it. Collection refuses frames that are too dark/far/close/cut off, but fix the room first.

## Step 2: collect (`npm run dev`, open `/?collect=1`)
1. Enter an **anonymous signer code** (`s01`, `s02`, …) and a **session note** (`lamp-60cm`). Choose the signing hand.
2. **Fast way:** set "Takes per letter" (default 5) and press **Start guided run**. The letter to sign is shown big, the first take of a letter has a 3 s countdown, the next ones 1.5 s, takes are saved and the run moves on by itself; letters that already have enough takes are skipped, refused takes are retried, 3 in a row stop the run. The letter grid is red / amber / green against the target and "Still needed" lists the gaps. Or, one at a time: pick a letter, press Record, get the sign ready during the 3-second countdown, hold it still (J and Z: draw it once during the recording). The screen says why a take was refused; refused takes are not saved.
3. Record **many takes per letter, in different positions, distances and tilts**, not many identical ones. A take is 1.5 s; each one is a separate chance for the sign to look slightly different.
4. **Change something between sittings** (light, distance, time of day) and use a new session note.
5. **More than one person.** This is the single most important rule: with one signer the evaluation can only measure how repeatable that person is.
6. Press **Export JSONL** after every sitting and keep the files (shared drive or the repo's private storage). Browser data can be cleared by accident. Use **Import JSONL** to merge files from several laptops (duplicate ids are skipped).

How much data is "enough" is not known until you measure it. Do not trust a number someone suggests (including this document): train, read the report, look at which letters are weak, record more of those.

## Step 3: train and read the report
    python ml/train_knn.py --data all-takes.jsonl --out public/models/letters-knn.json --tune
    python ml/train_dollar.py --data all-takes.jsonl --out public/models/motion-dollar.json
    python ml/validate_model.py public/models/letters-knn.json

Each run writes `<model>.report.md` next to the model. It states the dataset hash, the number of takes and signers, **how it was evaluated**, accuracy, per-letter precision and recall and the most frequent confusions. **Quote only that file.**

How to read it:
- Method `leave-one-signer-out`: the model never saw the tested person. This is the number that matters for a new user.
- Method `leave-one-session-out`: the model saw the person but not that sitting.
- Method `5-fold over takes`: one person, one sitting. It is flagged optimistic by the script. It can look great and fail for the next person.
- Letters that fingerspelling alphabets are known to confuse (for example A/E/M/N/S/T, or U/V/R, K/P) deserve a look first in the confusion list. If they are weak, record more takes of exactly those with more variation.
- `--tune` picks k by cross-validation on the same data: its result is slightly optimistic. The report says so.

## Step 4: install and try
1. Commit `public/models/letters-knn.json` (and `motion-dollar.json`) so the team shares it. `tests/models-guard.test.ts` fails if a model trained on synthetic data is there.
2. `npm run dev`, open `/`, go to the spelling screen: the grey "No letter model yet" notice is gone when the file loads; a broken file shows a plain message.
3. Sign a letter and hold it. A candidate appears after `LETTER.stableMs`, the ring fills, the letter is written after `LETTER.holdMs`. Check the same sign is not written twice.

### Optional: the neural network (`letters-mlp.json`)
    python ml/export_mlp.py --data all-takes.jsonl --alphabet asl --out public/models/letters-mlp.json
It trains on ALL takes (nothing held out), so its `.report.md` has no accuracy. The honest number is `ml/evaluate.py` (leave-one-person-out) on the same takes; pass its JSON with `--evaluation-json` to record the headline in the model. The app uses this file first, `letters-knn.json` is the fallback, so keep both. `ArSL` models stay out of `public/models/` for now (see `ml/README.md`). The confidence scale differs from the k-NN: re-check `LETTER` with the camera.

### Your own webcam as a test (never as training)
    python ml/evaluate.py --train ml/data/arsl21l.jsonl --test my-takes.jsonl --test-name "team webcam"
Reports accuracy on your recordings only; they are never mixed into the training side (the script refuses a take id that is on both sides, or a letter that only the test has, unless `--shared-classes`). It is not a leave-one-person-out result and the report says so.

## Step 5: tune the thresholds with the model in hand
`LETTER` in `src/recognition/letterController.ts`: `minConfidence`, `confirmConfidence`, `stableMs`, `holdMs`, `releaseMs` and the motion constants. They are first guesses. The report gives per-letter precision; use it. When a letter misfires, write a test that reproduces it in `tests/letters.test.ts` first, then change the value, and note it in `docs/KNOWN_ISSUES.md`.

## Step 6: record what you measured
Keep the report where the team can read it (the `.report.md` next to the model is fine; it holds counts and percentages only, no takes) and do not put participant data in the repo (`docs/DATASET.md`). Update `docs/DONE.md`: letter recognition becomes "verified" only for the numbers in that report, with its method.

## Things not to do
- Do not report a number from a run on generated data (the report is stamped SYNTHETIC and the model carries `"synthetic": true`).
- Do not split frames of one take between training and testing.
- Do not tune thresholds on the same people you then report results for.
- Do not store names in `signer`.

## If something fails
| Symptom | Likely cause |
| ------- | ------------ |
| "Record" stays grey | signer/session empty, or camera not running (see the status line) |
| "Not saved: part of the hand is outside the picture" | keep the whole hand in view; centre it |
| `error: the data contains synthetic takes` | the file includes mock-camera takes; remove them (they are marked `synthetic`) |
| "This file is not a SignScribe k-NN letter model" in the app | wrong file in `public/models/` |
| Features error: `uses features "…"` | model and app disagree on the feature version; retrain with the repo's `ml/` |
| Everything is recognised as one letter | too few signers or sessions, or one class dominates: check the per-letter support in the report |
