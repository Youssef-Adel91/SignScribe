# Credits and licences

What the letter models were made from, under which licence, and what we changed. The About and credits text on the help screen (13, both open hands) comes from `src/config/credits.ts`; `tests/credits.test.ts` fails if this file and that one stop agreeing.

**No dataset, picture, landmark file or take is in this repository** (`ml/data/`, `ml/reports/` and `datasets/` are git-ignored; `tests/models-guard.test.ts` refuses a model made from generated data). The only things derived from the data that are committed are the model files in `public/models/`, which hold numbers.

## ArSL21L (in the Arabic model)
- Arabic Sign Language letters dataset, 32 classes, pictures of 50 persons.
- Licence: **Creative Commons Attribution 4.0 International (CC BY 4.0)**, https://creativecommons.org/licenses/by/4.0/ . You may share and adapt it, also commercially, if you give credit, link the licence and say what you changed.
- Used for: training and testing the Arabic (ArSL) letter model (`public/models/letters-arsl-mlp.json`, `letters-arsl-knn.json`, made by `ml/export_arsl.py`).
- What we changed: the pictures were turned into 21 hand points per picture with MediaPipe (`ml/import_images.py`); the models hold weights and stored feature vectors made from those points, not the pictures. The class names are used as in the dataset; the Arabic letter shown for a class comes from `config/alphabets/arsl.json`, and where it is not confirmed the Latin class name is shown.
- Dataset records on Mendeley Data: `8hrn3bvdvk` v1 (https://data.mendeley.com/datasets/8hrn3bvdvk/1, DOI 10.17632/8hrn3bvdvk.1) and an earlier record `f63xhm286w` v1 (DOI 10.17632/f63xhm286w.1); the author listed on both is Munkhjargal Gochoo (United Arab Emirates University). Which record the models were made from: `TODO(Youssef): say which one you downloaded` (the Kaggle notebook says `8hrn3bvdvk`).
- **Citation: copy it from the dataset's own page (title, authors, year, DOI or URL) into this line before the report is handed in.** It is not written here because it was not checked against the page: `TODO(Youssef): paste the citation`.

## ASLAD-96K (only for testing)
- Arabic sign language landmark dataset (a CSV of hand points).
- Used for: testing a model on data from another source (`ml/evaluate.py`, leave-one-source-out). It is **not** in the shipped model files.
- Licence: CC BY 4.0 as reported by Youssef when he asked for this credit; `TODO(Youssef): confirm on the dataset page and paste the citation`.
- What we changed: nothing to the data; only the hand points were read (`ml/import_landmarks_csv.py`).

## ASL Alphabet Gestures, East West University (English model, experimental)
- "Images of American Sign Language (ASL) Alphabet Gestures", Mendeley Data, version 2, DOI 10.17632/48dg9vhmyk.2, https://data.mendeley.com/datasets/48dg9vhmyk/2 . Authors listed on the page: Ab. Rahim Ahmed Sowrow, Md Iftekhar Alam Sarker Iftekhar, Sadia Islam Prova, Mohammad Rezwanul Huq (East West University). 210,000 pictures, 28 classes, 3 signers.
- Licence: **CC BY 4.0** according to the dataset page (read on 2026-10-31); `TODO(Youssef): confirm on the page and paste the citation`.
- Used for: an experimental English letter model (Kaggle notebook `notebooks/kaggle/signscribe_asl_letters.ipynb`, 2026-11-02; only Type_01, a subset of the pictures). Its MLP weights are in git under `notebooks/kaggle/signscribe-asl-output/models/`, **not** in `public/models/`, so it is not in the app and the About screen does not list it yet. Add it to `src/config/credits.ts` when it is shipped.
- What we changed: the pictures were turned into 21 hand points with MediaPipe; the model holds weights, not pictures.

## Written by us (no outside licence)
- `src/nlp/arabicWords.ts`: the Arabic helper-word list used to check Arabic sentences (Phase: ArSL stage 1). See `docs/ARABIC_WORDS.md`.
- English word lists (`src/nlp/words.ts`, `src/nlp/validate.ts`), the picture-card pack, all code, tests and documents of this repository.

## Libraries
MediaPipe Hands (hand points), ONNX Runtime Web (picture cards), React, XState, Vite. Their licences are in `package-lock.json` / `node_modules` and `ml/requirements.txt`.
