# Dataset format

Written by the collection mode (`/?collect=1`), read by `ml/`. **JSONL**: one JSON object per line, one **take** per object.
A take is one short recording of one letter by one person: a few dozen frames of 21 hand landmarks. **No pictures are stored**, so a file contains no faces.

> **Never commit participant data to this repository (it is public).** That means the study exports (trials, survey, scores, profile, session, comparison, JSON), the recorded takes of hand landmarks, the card photographs and anything in `exports/`, `docs/reports/` or `takes/`. They are in `.gitignore` as a safety net, not as permission: keep them on an access-controlled drive, check `git status` before every commit, and if something was committed by mistake tell the team at once (deleting it in a later commit does not remove it from the history).

```json
{"v":1,"id":"6b0e…","label":"B","kind":"static","signer":"s01","session":"lamp-60cm","hand":"right",
 "width":1280,"height":720,"createdAt":"2026-10-21T20:00:00.000Z",
 "frames":[{"t":0,"lm":[[0.51,0.78,0.0],[0.49,0.73,-0.02], … 21 triples … ]}, …]}
```

| Field | Meaning |
| ----- | ------- |
| `v` | format version, always `1` |
| `id` | unique per take |
| `label` | one label of the active alphabet: a letter (`A`) or, for ArSL21L, the class name (`ain`), taken from `config/alphabets/*.json` (chosen in `config/alphabet.json`). Never a fixed list in code |
| `kind` | `static` (hold the sign still, about 1.5 s) or `dynamic` (a letter drawn in the air, about 2.2 s; J and Z by default) |
| `signer` | anonymous code such as `s01`. Never a name |
| `session` | one sitting: same light, distance and camera, for example `lamp-60cm`. Used to hold sessions out when testing |
| `hand` | the signing-hand setting while recording. `left` takes are mirrored when features are made, so a left-handed signer's letters look like a right-handed signer's |
| `width`, `height` | video size in pixels. x and y are normalised separately, so shapes can only be measured with both |
| `frames[].t` | ms since the start of the recording |
| `frames[].lm` | 21 MediaPipe hand landmarks `[x, y, z]`; x and y are 0..1 of the un-mirrored picture, z is MediaPipe's depth relative to the wrist |
| `person` | optional. A human id when the dataset says who is in the picture (`user3`). Whole persons are held out when testing (leave-one-person-out). Anonymous, never a name |
| `source` | optional. Which recording or sub-dataset the take comes from. Used to hold a source out (leave-one-source-out) when the dataset has no person ids |
| `minor` | optional. `true` when the person was under 18, set by `import_images.py --age-regex`. **The age is never stored**, and evaluation only counts such persons: it never shows a result for one of them |
| `synthetic` | `true` only for generated test data (and for takes made with the mock camera). Training refuses it without `--allow-synthetic` |

## Control takes and the person id
Takes of the ArSL controls (`ctl_space`, `ctl_done` static; `ctl_delete`, `ctl_cancel` dynamic: `docs/CONTROLS.md`) are ordinary takes with those labels. Since the Controls box of the collection page was added, **every take from the collection page carries `person` = the signer code**, so `evaluate.py` holds whole people out (leave-one-person-out) also for takes recorded here, next to imported datasets that have person ids.

## The "none" class (not a letter)
A model that must answer with one of 32 letters calls every pose a letter, also a hand on its way or a relaxed hand. So the collection mode (`/?collect=1`, "No letter" box) also records takes with `label: "none"` and a `tag`: `moving` (the hand moving), `relaxed` (a relaxed hand), `command-zone` (a hand in the command zone) or `other`. They are static takes like the others, one file, and they are not in any alphabet file. The tools accept the label (`ml/signscribe_ml/dataset.py`, `src/collect/dataset.ts`), train it as one more class, and a model that answers `none` is shown as nothing. A `none` take is a take of a person: the same rules about not committing data apply.

## Alphabets (label sets)
The letters live in `config/alphabets/<id>.json` and `config/alphabet.json` says which is active (`{"active": "asl"}`). A file has `static` letters, `dynamic` letters (drawn in the air; ASL J and Z), and `aliases` that map a picture folder name to a letter. Python reads it directly (`--alphabet arsl` to pick another); the web app reads the same files at build time (`VITE_ALPHABET=arsl`). `arsl.json` is a **template**: it has not been checked against any dataset (`"reviewed": false`), so confirm it before use.

## Taking landmarks from a folder of pictures, or from a CSV
`ml/import_images.py` also reads a **flat folder** whose file names carry the label (`--label-regex`, `--person-regex`, `--age-regex`), without moving any file; `ml/import_landmarks_csv.py` turns landmark CSV files (ASLAD, ArSL_dataset.csv) into takes tagged with a `source` and never a person. The exact commands are in `ml/README.md`.

## Taking landmarks from a folder of pictures
`ml/import_images.py` runs MediaPipe Hands (Python) on a folder with one sub-folder per letter and writes one take with one frame per picture that has a hand. Pictures with no hand are skipped and counted; the pictures are not kept. Output: this same format, with `person` (from `--person-regex`) or `source` (from `--source`). Example in `ml/README.md`.

## What the collection mode keeps and refuses
- Static takes: up to one frame every 60 ms for 1.5 s, at least 12 frames. Dynamic takes: every frame for 2.2 s, at least 20 frames.
- A frame counts only if a hand is detected (score at least 0.5), is entirely inside the picture, and its size is within the same distance limits as the setup check (`PALM_MIN`..`PALM_MAX`).
- A take with more than 25% bad frames is **not saved** and the screen says why.
- Everything lives in the browser (IndexedDB) until you press Export. Export after every sitting; clearing browser data deletes the takes.

## Rules for a dataset that can be trusted
1. **Several people.** One person's takes only show how repeatable that person is. The tools hold out whole groups, in this order: `person`, `source`, `signer`, `session`. With only one group they refuse to evaluate (or label the number as not for new people).
2. **Several sessions** per signer: change the light and the distance a little between sittings.
3. **Never split the frames of one take** between training and testing (they are almost identical). The tools group by take, session and signer for you.
4. Record both hands' worth of variation by also recording left-handed signers with `hand = left`, rather than flipping the data by hand.
5. Keep the raw JSONL files. Models can always be rebuilt from them; the other way round is impossible.
