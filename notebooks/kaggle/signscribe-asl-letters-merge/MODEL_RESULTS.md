# Model results

**Produced by `ml/evaluate.py` runs on real data, one section per run** (below: ArSL21L as published (2026-10-31); ASL letters, EWU plus ASL-HG merged Mendeley 48dg9vhmyk v2, Type_01 only, signer = file-number block of 500 (inferred); Mendeley j4y5w2c8w9 v1, raw images, signer = P1..P10 from the file name, subset of 500 per letter per signer (seed 0) (2026-11-03); ASL Alphabet Gestures (East West University) Mendeley 48dg9vhmyk v2, Type_01 only, signer = file-number block of 500 (inferred), subset of 500 per letter per signer (seed 0) (2026-11-03); ASL-HG American Sign Language Hand Gesture Image Dataset Mendeley j4y5w2c8w9 v1, raw images, signer = P1..P10 from the file name, subset of 500 per letter per signer (seed 0) (2026-11-03)). Nobody types a number into this file. A run on generated data, a same-person split or a split whose held-out groups have classes the training groups lack is refused by the script and cannot appear here.

## Rules
- Every number below is written by `ml/evaluate.py --results-md docs/MODEL_RESULTS.md`. Nobody types a number into this file. Each section states the exact command, the dataset name and version, the dataset hash, the date and the git commit.
- The script refuses to append a run on synthetic data, a same-person split, or a split whose held-out groups have classes the training groups lack (a CSV that covers 21 of 32 classes held out against a file that covers all 32 is not a valid result), so a section that exists is a leave-one-person/source/signer/session-out result on real data.
- To remove a section that should not be there (for example one written before that last rule existed): `python ml/results_md.py docs/MODEL_RESULTS.md --remove "<text in its title>"`. It also rewrites the first lines so they say what the file holds.
- The headline is always the held-out-group result (pooled and mean over groups, with worst and best group). A random split is never reported.
- Augmentation is shown against no augmentation on the same folds (`--augment-ablation`); it stays only if it does not hurt on the held-out groups.
- The k-NN number is the one that applies to the app (the browser loads the k-NN). The MLP is a comparison.
- `ml/calibrate.py` is a separate report with its own definition: for a list of confidence thresholds it counts how many held-out predictions would be shown and how many of those are right, and it writes to `ml/reports/` (git-ignored), never to this file. It calls the same `evaluation.run` as `evaluate.py` (same takes, `k`, seed and folds), so with the same augmentation its threshold-0 row (everything shown) is the pooled accuracy of the matching run here (`ml/tests/test_calibration.py` checks this on generated data). The defaults differ: `calibrate.py` uses `--augment all`, `evaluate.py` uses `--augment none` unless told otherwise. Cite this file for accuracy; use a calibration report only for its threshold table.
- Camera behaviour (fps, latency, how it feels) is not in this file: it needs a real camera and goes in `docs/DONE.md`.

## How to add a result
    python ml/import_images.py --images PATH --out ml/data/NAME.jsonl --dataset-name NAME --source SOURCE [--person-regex REGEX]
    python ml/evaluate.py --data ml/data/NAME.jsonl --dataset-name NAME --dataset-version VERSION --augment all --augment-ablation --results-md docs/MODEL_RESULTS.md

Pictures from a public dataset stay on your machine (`ml/data/` is ignored by git); only landmarks are written, and only counts and percentages reach this file. Check the dataset's licence before using it.

## Results

---

## ArSL21L as published (2026-10-31)

## with augmentation

### Static letters: leave-one-group-out evaluation

- command: `python ml/evaluate.py --data ml/data/arsl21l.jsonl --alphabet arsl --dataset-name ArSL21L --dataset-version as published --augment all --augment-ablation --results-md docs/MODEL_RESULTS.md`
- date (UTC): 2026-10-31T18:28:30+00:00, git commit 7cbb5df
- dataset: **ArSL21L**, version **as published**, sha256 `6b2726e04c4e89747c828cd1fe51b4f738e8d72a3bfbc4abb861d8c2ab0b059c`
- alphabet: arsl; takes: 13662; persons: 50, sources: 1, signers: 50
- split: **leave-one-person-out**, 50 held-out groups, the same folds for every model. 7 of them are persons under 18: they are included in the pooled numbers and in the mean over groups, and are only counted here; the worst and best group below cover the other 43 groups
- augmentation (training side only): rotate+scale+mirror x2 copies per frame
- python 3.12.7, numpy 2.5.4

| model | description | samples | pooled accuracy | mean over held-out groups | worst group | best group | macro recall |
| --- | --- | --- | --- | --- | --- | --- | --- |
| knn | k-NN, k=5, distance-weighted vote on the 60 hand features (same as the browser) | 13662 | 91.1% | 91.0% | 72.4% | 97.5% | 91.0% |
| mlp | MLP 60-64-32-C, ReLU, Adam lr=0.003, weight decay=0.0001, 60 epochs, batch 128, seed 0 | 13662 | 94.9% | 94.8% | 72.4% | 100.0% | 94.9% |

Pooled = every held-out sample counted once (large groups weigh more). Mean over groups = each held-out person/source counts once.

#### Per letter (precision / recall)

| letter | support | knn precision | knn recall | mlp precision | mlp recall |
| --- | --- | --- | --- | --- | --- |
| ain | 416 | 87.8% | 91.3% | 89.4% | 95.0% |
| al | 439 | 96.0% | 98.2% | 97.5% | 98.9% |
| aleff | 430 | 91.2% | 93.5% | 91.1% | 95.3% |
| bb | 425 | 94.5% | 92.7% | 94.7% | 92.7% |
| dal | 388 | 87.4% | 87.4% | 93.6% | 93.6% |
| dha | 429 | 92.2% | 96.5% | 98.1% | 97.9% |
| dhad | 426 | 95.0% | 92.7% | 95.3% | 95.1% |
| fa | 431 | 85.1% | 86.1% | 93.2% | 92.6% |
| gaaf | 404 | 84.8% | 84.2% | 91.5% | 90.6% |
| ghain | 436 | 89.7% | 93.8% | 97.0% | 96.3% |
| ha | 396 | 85.1% | 88.1% | 92.7% | 92.9% |
| haa | 396 | 80.7% | 86.4% | 92.7% | 96.2% |
| jeem | 418 | 91.3% | 90.7% | 94.5% | 94.5% |
| kaaf | 443 | 95.4% | 88.9% | 93.2% | 95.9% |
| khaa | 420 | 90.7% | 86.0% | 97.6% | 95.7% |
| la | 427 | 98.3% | 97.4% | 98.3% | 97.7% |
| laam | 430 | 90.3% | 90.5% | 93.7% | 93.3% |
| meem | 435 | 94.6% | 92.4% | 95.4% | 94.5% |
| nun | 414 | 88.2% | 88.2% | 92.4% | 93.7% |
| ra | 423 | 88.7% | 88.9% | 97.8% | 94.6% |
| saad | 442 | 91.3% | 94.6% | 94.9% | 96.8% |
| seen | 450 | 88.2% | 98.2% | 96.4% | 94.9% |
| sheen | 449 | 99.8% | 96.0% | 99.3% | 98.9% |
| ta | 428 | 90.4% | 94.9% | 94.9% | 96.5% |
| taa | 443 | 93.3% | 88.0% | 94.2% | 95.9% |
| thaa | 438 | 98.1% | 96.1% | 98.1% | 96.8% |
| thal | 448 | 85.8% | 87.7% | 96.4% | 95.3% |
| toot | 408 | 93.5% | 87.7% | 94.6% | 90.7% |
| waw | 410 | 92.6% | 94.6% | 92.9% | 95.1% |
| ya | 439 | 91.9% | 90.9% | 93.7% | 91.6% |
| yaa | 449 | 97.5% | 95.1% | 98.4% | 96.2% |
| zay | 432 | 84.5% | 74.3% | 92.6% | 90.0% |

#### knn: the 10 worst letter pairs (errors in both directions)

- thal/zay: 95 errors (thal->zay 38, zay->thal 57)
- haa/khaa: 74 errors (haa->khaa 30, khaa->haa 44)
- kaaf/seen: 53 errors (kaaf->seen 45, seen->kaaf 8)
- gaaf/ha: 47 errors (gaaf->ha 27, ha->gaaf 20)
- fa/gaaf: 43 errors (fa->gaaf 19, gaaf->fa 24)
- haa/jeem: 42 errors (haa->jeem 18, jeem->haa 24)
- dha/taa: 36 errors (dha->taa 6, taa->dha 30)
- dal/ra: 35 errors (dal->ra 20, ra->dal 15)
- laam/ya: 32 errors (laam->ya 13, ya->laam 19)
- ain/ghain: 31 errors (ain->ghain 19, ghain->ain 12)

#### mlp: the 10 worst letter pairs (errors in both directions)

- kaaf/seen: 33 errors (kaaf->seen 12, seen->kaaf 21)
- laam/ya: 32 errors (laam->ya 15, ya->laam 17)
- fa/gaaf: 26 errors (fa->gaaf 13, gaaf->fa 13)
- dhad/waw: 25 errors (dhad->waw 13, waw->dhad 12)
- dal/nun: 23 errors (dal->nun 12, nun->dal 11)
- gaaf/ha: 23 errors (gaaf->ha 13, ha->gaaf 10)
- thal/zay: 20 errors (thal->zay 10, zay->thal 10)
- haa/khaa: 18 errors (haa->khaa 6, khaa->haa 12)
- ain/ghain: 17 errors (ain->ghain 7, ghain->ain 10)
- aleff/toot: 17 errors (aleff->toot 5, toot->aleff 12)

#### What the app would show (confidence at least the threshold; the browser's minimum is 0.6)

| model | threshold | share of frames shown | accuracy of what is shown |
| --- | --- | --- | --- |
| knn | 0.5 | 97.7% | 92.5% |
| knn | 0.6 | 93.8% | 94.3% |
| knn | 0.7 | 88.2% | 95.9% |
| knn | 0.8 | 85.0% | 96.7% |
| knn | 0.9 | 75.3% | 98.0% |
| mlp | 0.5 | 99.0% | 95.6% |
| mlp | 0.6 | 97.6% | 96.3% |
| mlp | 0.7 | 96.1% | 96.9% |
| mlp | 0.8 | 94.1% | 97.5% |
| mlp | 0.9 | 90.6% | 98.2% |

k-NN confidence is a vote share and the MLP's is a softmax probability: the two are not comparable, and only the k-NN reaches the browser.


### Controls

#### Static controls, knn (hand shapes classified like letters; a prediction counts as shown at confidence >= 0.6)

| control | action | frames | recall | recall shown | taken for another control | taken for a letter | taken for none |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ctl_space | space | 0 | n/a | n/a | n/a | n/a | n/a |
| ctl_done | done | 0 | n/a | n/a | n/a | n/a | n/a |

- letter frames shown as a control (false control): 0.0% of 13662 (ctl_space 0.0%, ctl_done 0.0%)
- **'none' frames shown as a control (false trigger): n/a of 0** (ctl_space n/a, ctl_done n/a)
- 'none' frames shown as a letter: n/a

#### Static controls, mlp (hand shapes classified like letters; a prediction counts as shown at confidence >= 0.6)

| control | action | frames | recall | recall shown | taken for another control | taken for a letter | taken for none |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ctl_space | space | 0 | n/a | n/a | n/a | n/a | n/a |
| ctl_done | done | 0 | n/a | n/a | n/a | n/a | n/a |

- letter frames shown as a control (false control): 0.0% of 13662 (ctl_space 0.0%, ctl_done 0.0%)
- **'none' frames shown as a control (false trigger): n/a of 0** (ctl_space n/a, ctl_done n/a)
- 'none' frames shown as a letter: n/a

#### Dynamic controls ($1 on the path of landmark 8, a match counts at score >= 0.6)

Not evaluated: need at least 2 dynamic takes to evaluate

Counts and shares only; no result for any person. Not a claim about real use: it is what this recording set shows.

## no augmentation

### Static letters: leave-one-group-out evaluation

- command: `python ml/evaluate.py --data ml/data/arsl21l.jsonl --alphabet arsl --dataset-name ArSL21L --dataset-version as published --augment all --augment-ablation --results-md docs/MODEL_RESULTS.md`
- date (UTC): 2026-10-31T18:28:30+00:00, git commit 7cbb5df
- dataset: **ArSL21L**, version **as published**, sha256 `6b2726e04c4e89747c828cd1fe51b4f738e8d72a3bfbc4abb861d8c2ab0b059c`
- alphabet: arsl; takes: 13662; persons: 50, sources: 1, signers: 50
- split: **leave-one-person-out**, 50 held-out groups, the same folds for every model. 7 of them are persons under 18: they are included in the pooled numbers and in the mean over groups, and are only counted here; the worst and best group below cover the other 43 groups
- augmentation (training side only): none
- python 3.12.7, numpy 2.5.4

| model | description | samples | pooled accuracy | mean over held-out groups | worst group | best group | macro recall |
| --- | --- | --- | --- | --- | --- | --- | --- |
| knn | k-NN, k=5, distance-weighted vote on the 60 hand features (same as the browser) | 13662 | 88.9% | 88.8% | 70.6% | 97.1% | 88.8% |
| mlp | MLP 60-64-32-C, ReLU, Adam lr=0.003, weight decay=0.0001, 60 epochs, batch 128, seed 0 | 13662 | 93.8% | 93.7% | 77.6% | 99.3% | 93.8% |

Pooled = every held-out sample counted once (large groups weigh more). Mean over groups = each held-out person/source counts once.

#### Per letter (precision / recall)

| letter | support | knn precision | knn recall | mlp precision | mlp recall |
| --- | --- | --- | --- | --- | --- |
| ain | 416 | 84.7% | 89.2% | 94.9% | 94.5% |
| al | 439 | 96.4% | 97.9% | 97.0% | 97.3% |
| aleff | 430 | 89.0% | 92.3% | 92.2% | 93.5% |
| bb | 425 | 93.6% | 89.9% | 91.9% | 93.2% |
| dal | 388 | 84.3% | 84.3% | 89.8% | 93.0% |
| dha | 429 | 91.2% | 93.7% | 97.9% | 97.9% |
| dhad | 426 | 94.4% | 90.6% | 92.6% | 93.9% |
| fa | 431 | 85.0% | 83.1% | 93.7% | 89.3% |
| gaaf | 404 | 85.7% | 81.4% | 91.0% | 90.1% |
| ghain | 436 | 86.3% | 91.1% | 93.6% | 97.0% |
| ha | 396 | 84.5% | 86.6% | 89.1% | 92.7% |
| haa | 396 | 76.0% | 82.6% | 90.7% | 95.7% |
| jeem | 418 | 89.0% | 87.1% | 94.6% | 93.1% |
| kaaf | 443 | 92.5% | 86.5% | 94.4% | 95.3% |
| khaa | 420 | 87.2% | 79.8% | 95.4% | 93.8% |
| la | 427 | 98.1% | 97.2% | 99.1% | 98.1% |
| laam | 430 | 90.1% | 89.3% | 92.5% | 91.9% |
| meem | 435 | 93.2% | 91.3% | 94.0% | 92.9% |
| nun | 414 | 85.3% | 87.0% | 90.4% | 89.1% |
| ra | 423 | 83.8% | 86.8% | 94.1% | 94.8% |
| saad | 442 | 85.6% | 94.3% | 93.6% | 95.7% |
| seen | 450 | 84.0% | 93.6% | 94.7% | 95.8% |
| sheen | 449 | 97.0% | 94.2% | 99.1% | 98.2% |
| ta | 428 | 88.7% | 92.1% | 93.8% | 95.3% |
| taa | 443 | 88.4% | 84.7% | 95.6% | 93.2% |
| thaa | 438 | 98.4% | 95.7% | 98.8% | 96.3% |
| thal | 448 | 81.1% | 88.2% | 91.5% | 94.2% |
| toot | 408 | 90.3% | 84.6% | 90.8% | 90.0% |
| waw | 410 | 91.7% | 94.1% | 94.7% | 95.1% |
| ya | 439 | 89.6% | 90.4% | 91.9% | 90.4% |
| yaa | 449 | 96.2% | 94.7% | 96.6% | 95.3% |
| zay | 432 | 83.7% | 67.8% | 90.8% | 84.5% |

#### knn: the 10 worst letter pairs (errors in both directions)

- thal/zay: 111 errors (thal->zay 33, zay->thal 78)
- haa/khaa: 101 errors (haa->khaa 39, khaa->haa 62)
- kaaf/seen: 71 errors (kaaf->seen 53, seen->kaaf 18)
- haa/jeem: 52 errors (haa->jeem 23, jeem->haa 29)
- dal/ra: 50 errors (dal->ra 32, ra->dal 18)
- dha/taa: 48 errors (dha->taa 18, taa->dha 30)
- gaaf/ha: 44 errors (gaaf->ha 24, ha->gaaf 20)
- fa/saad: 43 errors (fa->saad 26, saad->fa 17)
- ain/ghain: 41 errors (ain->ghain 26, ghain->ain 15)
- ta/zay: 35 errors (ta->zay 10, zay->ta 25)

#### mlp: the 10 worst letter pairs (errors in both directions)

- thal/zay: 36 errors (thal->zay 14, zay->thal 22)
- kaaf/seen: 33 errors (kaaf->seen 17, seen->kaaf 16)
- dal/nun: 31 errors (dal->nun 9, nun->dal 22)
- haa/khaa: 29 errors (haa->khaa 11, khaa->haa 18)
- laam/ya: 27 errors (laam->ya 10, ya->laam 17)
- fa/gaaf: 25 errors (fa->gaaf 15, gaaf->fa 10)
- gaaf/ha: 25 errors (gaaf->ha 17, ha->gaaf 8)
- dhad/waw: 24 errors (dhad->waw 13, waw->dhad 11)
- ta/zay: 23 errors (ta->zay 11, zay->ta 12)
- meem/yaa: 19 errors (meem->yaa 11, yaa->meem 8)

#### What the app would show (confidence at least the threshold; the browser's minimum is 0.6)

| model | threshold | share of frames shown | accuracy of what is shown |
| --- | --- | --- | --- |
| knn | 0.5 | 95.6% | 90.9% |
| knn | 0.6 | 90.3% | 93.6% |
| knn | 0.7 | 81.7% | 95.9% |
| knn | 0.8 | 77.6% | 96.8% |
| knn | 0.9 | 64.2% | 98.2% |
| mlp | 0.5 | 98.8% | 94.7% |
| mlp | 0.6 | 97.0% | 95.5% |
| mlp | 0.7 | 95.1% | 96.2% |
| mlp | 0.8 | 92.9% | 96.9% |
| mlp | 0.9 | 88.7% | 97.9% |

k-NN confidence is a vote share and the MLP's is a softmax probability: the two are not comparable, and only the k-NN reaches the browser.


### Controls

#### Static controls, knn (hand shapes classified like letters; a prediction counts as shown at confidence >= 0.6)

| control | action | frames | recall | recall shown | taken for another control | taken for a letter | taken for none |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ctl_space | space | 0 | n/a | n/a | n/a | n/a | n/a |
| ctl_done | done | 0 | n/a | n/a | n/a | n/a | n/a |

- letter frames shown as a control (false control): 0.0% of 13662 (ctl_space 0.0%, ctl_done 0.0%)
- **'none' frames shown as a control (false trigger): n/a of 0** (ctl_space n/a, ctl_done n/a)
- 'none' frames shown as a letter: n/a

#### Static controls, mlp (hand shapes classified like letters; a prediction counts as shown at confidence >= 0.6)

| control | action | frames | recall | recall shown | taken for another control | taken for a letter | taken for none |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ctl_space | space | 0 | n/a | n/a | n/a | n/a | n/a |
| ctl_done | done | 0 | n/a | n/a | n/a | n/a | n/a |

- letter frames shown as a control (false control): 0.0% of 13662 (ctl_space 0.0%, ctl_done 0.0%)
- **'none' frames shown as a control (false trigger): n/a of 0** (ctl_space n/a, ctl_done n/a)
- 'none' frames shown as a letter: n/a

#### Dynamic controls ($1 on the path of landmark 8, a match counts at score >= 0.6)

Not evaluated: need at least 2 dynamic takes to evaluate

Counts and shares only; no result for any person. Not a claim about real use: it is what this recording set shows.

---

## ASL letters, EWU plus ASL-HG merged Mendeley 48dg9vhmyk v2, Type_01 only, signer = file-number block of 500 (inferred); Mendeley j4y5w2c8w9 v1, raw images, signer = P1..P10 from the file name, subset of 500 per letter per signer (seed 0) (2026-11-03)

## with augmentation

### Static letters: leave-one-group-out evaluation

- command: `python ml/evaluate.py --data /tmp/signscribe/asl.jsonl --alphabet asl --dataset-name ASL letters, EWU plus ASL-HG merged --dataset-version Mendeley 48dg9vhmyk v2, Type_01 only, signer = file-number block of 500 (inferred); Mendeley j4y5w2c8w9 v1, raw images, signer = P1..P10 from the file name, subset of 500 per letter per signer (seed 0) --augment all --augment-ablation --out-dir /kaggle/working/signscribe-asl-output/reports --results-md /tmp/signscribe/SignScribe/docs/MODEL_RESULTS.md`
- date (UTC): 2026-11-03T12:36:08+00:00, git commit c88ee4e
- dataset: **ASL letters, EWU plus ASL-HG merged**, version **Mendeley 48dg9vhmyk v2, Type_01 only, signer = file-number block of 500 (inferred); Mendeley j4y5w2c8w9 v1, raw images, signer = P1..P10 from the file name, subset of 500 per letter per signer (seed 0)**, sha256 `2aeac81a780b7277ae2246b787d22e291c1ed4bdfa46d07f95074c40523b7cc5`
- alphabet: asl; takes: 38619; persons: 13, sources: 2, signers: 13
- split: **leave-one-person-out**, 13 held-out groups, the same folds for every model
- augmentation (training side only): rotate+scale+mirror x2 copies per frame
- python 3.13.16, numpy 2.1.3

| model | description | samples | pooled accuracy | mean over held-out groups | worst group | best group | macro recall |
| --- | --- | --- | --- | --- | --- | --- | --- |
| knn | k-NN, k=5, distance-weighted vote on the 60 hand features (same as the browser) | 38619 | 87.4% | 89.1% | 69.0% | 96.6% | 86.1% |
| mlp | MLP 60-64-32-C, ReLU, Adam lr=0.003, weight decay=0.0001, 60 epochs, batch 128, seed 0 | 38619 | 90.8% | 92.0% | 74.5% | 100.0% | 90.0% |

Pooled = every held-out sample counted once (large groups weigh more). Mean over groups = each held-out person/source counts once.

#### Per letter (precision / recall)

| letter | support | knn precision | knn recall | mlp precision | mlp recall |
| --- | --- | --- | --- | --- | --- |
| A | 1402 | 93.2% | 89.1% | 93.1% | 89.4% |
| B | 1889 | 97.0% | 98.3% | 98.7% | 98.9% |
| C | 1571 | 89.5% | 85.0% | 89.3% | 88.0% |
| D | 1819 | 87.0% | 87.1% | 93.6% | 91.7% |
| E | 1689 | 86.7% | 87.3% | 85.4% | 93.8% |
| F | 2034 | 97.6% | 99.3% | 96.3% | 99.5% |
| G | 1771 | 94.0% | 95.4% | 95.1% | 94.8% |
| H | 1816 | 96.4% | 89.4% | 96.9% | 93.6% |
| I | 1841 | 93.6% | 95.4% | 97.8% | 96.0% |
| K | 1850 | 90.3% | 93.7% | 89.5% | 97.2% |
| L | 1839 | 93.7% | 96.1% | 94.2% | 96.2% |
| M | 1302 | 58.1% | 55.1% | 94.3% | 87.2% |
| N | 1177 | 56.0% | 52.1% | 84.9% | 89.9% |
| O | 1535 | 84.5% | 90.0% | 87.7% | 91.8% |
| P | 1447 | 79.8% | 74.9% | 96.5% | 69.0% |
| Q | 1084 | 93.8% | 91.2% | 85.5% | 86.1% |
| R | 1588 | 80.1% | 81.9% | 79.3% | 91.1% |
| S | 1203 | 67.8% | 81.4% | 80.4% | 74.9% |
| T | 1372 | 74.3% | 71.1% | 76.0% | 83.3% |
| U | 1664 | 80.6% | 84.6% | 89.3% | 76.6% |
| V | 1601 | 89.7% | 85.0% | 93.4% | 88.0% |
| W | 1763 | 96.5% | 98.2% | 97.6% | 97.6% |
| X | 1733 | 91.6% | 94.7% | 80.5% | 91.1% |
| Y | 1629 | 98.0% | 91.2% | 97.2% | 95.1% |

#### knn: the 10 worst letter pairs (errors in both directions)

- M/N: 705 errors (M->N 387, N->M 318)
- S/T: 428 errors (S->T 153, T->S 275)
- R/U: 427 errors (R->U 225, U->R 202)
- C/O: 299 errors (C->O 170, O->C 129)
- E/M: 240 errors (E->M 124, M->E 116)
- D/P: 231 errors (D->P 129, P->D 102)
- K/V: 179 errors (K->V 74, V->K 105)
- N/S: 133 errors (N->S 121, S->N 12)
- U/V: 112 errors (U->V 42, V->U 70)
- G/H: 106 errors (G->H 28, H->G 78)

#### mlp: the 10 worst letter pairs (errors in both directions)

- R/U: 330 errors (R->U 85, U->R 245)
- S/T: 315 errors (S->T 210, T->S 105)
- C/O: 197 errors (C->O 113, O->C 84)
- Q/X: 196 errors (Q->X 101, X->Q 95)
- K/V: 113 errors (K->V 12, V->K 101)
- M/N: 105 errors (M->N 98, N->M 7)
- N/T: 95 errors (N->T 52, T->N 43)
- U/X: 91 errors (U->X 89, X->U 2)
- E/P: 87 errors (E->P 5, P->E 82)
- P/X: 85 errors (P->X 82, X->P 3)

#### What the app would show (confidence at least the threshold; the browser's minimum is 0.6)

| model | threshold | share of frames shown | accuracy of what is shown |
| --- | --- | --- | --- |
| knn | 0.5 | 98.7% | 88.2% |
| knn | 0.6 | 96.0% | 89.8% |
| knn | 0.7 | 92.9% | 91.0% |
| knn | 0.8 | 90.5% | 92.1% |
| knn | 0.9 | 86.5% | 93.3% |
| mlp | 0.5 | 98.8% | 91.5% |
| mlp | 0.6 | 96.8% | 92.5% |
| mlp | 0.7 | 94.7% | 93.6% |
| mlp | 0.8 | 91.9% | 94.8% |
| mlp | 0.9 | 87.6% | 96.3% |

k-NN confidence is a vote share and the MLP's is a softmax probability: the two are not comparable, and only the k-NN reaches the browser.


## no augmentation

### Static letters: leave-one-group-out evaluation

- command: `python ml/evaluate.py --data /tmp/signscribe/asl.jsonl --alphabet asl --dataset-name ASL letters, EWU plus ASL-HG merged --dataset-version Mendeley 48dg9vhmyk v2, Type_01 only, signer = file-number block of 500 (inferred); Mendeley j4y5w2c8w9 v1, raw images, signer = P1..P10 from the file name, subset of 500 per letter per signer (seed 0) --augment all --augment-ablation --out-dir /kaggle/working/signscribe-asl-output/reports --results-md /tmp/signscribe/SignScribe/docs/MODEL_RESULTS.md`
- date (UTC): 2026-11-03T12:36:08+00:00, git commit c88ee4e
- dataset: **ASL letters, EWU plus ASL-HG merged**, version **Mendeley 48dg9vhmyk v2, Type_01 only, signer = file-number block of 500 (inferred); Mendeley j4y5w2c8w9 v1, raw images, signer = P1..P10 from the file name, subset of 500 per letter per signer (seed 0)**, sha256 `2aeac81a780b7277ae2246b787d22e291c1ed4bdfa46d07f95074c40523b7cc5`
- alphabet: asl; takes: 38619; persons: 13, sources: 2, signers: 13
- split: **leave-one-person-out**, 13 held-out groups, the same folds for every model
- augmentation (training side only): none
- python 3.13.16, numpy 2.1.3

| model | description | samples | pooled accuracy | mean over held-out groups | worst group | best group | macro recall |
| --- | --- | --- | --- | --- | --- | --- | --- |
| knn | k-NN, k=5, distance-weighted vote on the 60 hand features (same as the browser) | 38619 | 81.6% | 83.3% | 62.6% | 92.6% | 80.2% |
| mlp | MLP 60-64-32-C, ReLU, Adam lr=0.003, weight decay=0.0001, 60 epochs, batch 128, seed 0 | 38619 | 88.4% | 90.8% | 63.9% | 100.0% | 87.9% |

Pooled = every held-out sample counted once (large groups weigh more). Mean over groups = each held-out person/source counts once.

#### Per letter (precision / recall)

| letter | support | knn precision | knn recall | mlp precision | mlp recall |
| --- | --- | --- | --- | --- | --- |
| A | 1402 | 90.5% | 86.4% | 78.8% | 91.0% |
| B | 1889 | 93.7% | 96.3% | 96.8% | 97.2% |
| C | 1571 | 75.2% | 64.1% | 89.1% | 87.0% |
| D | 1819 | 76.7% | 84.6% | 86.4% | 89.2% |
| E | 1689 | 86.0% | 87.8% | 90.7% | 95.0% |
| F | 2034 | 96.3% | 98.3% | 99.3% | 98.6% |
| G | 1771 | 89.4% | 93.5% | 88.9% | 86.1% |
| H | 1816 | 96.7% | 89.2% | 97.3% | 88.2% |
| I | 1841 | 92.4% | 95.4% | 93.9% | 93.6% |
| K | 1850 | 77.9% | 91.1% | 86.2% | 97.4% |
| L | 1839 | 94.2% | 94.0% | 95.2% | 91.4% |
| M | 1302 | 61.7% | 61.9% | 91.8% | 90.6% |
| N | 1177 | 52.6% | 39.9% | 75.1% | 82.8% |
| O | 1535 | 69.3% | 79.5% | 89.7% | 88.9% |
| P | 1447 | 75.5% | 73.9% | 89.9% | 73.9% |
| Q | 1084 | 91.6% | 81.3% | 88.7% | 92.6% |
| R | 1588 | 69.8% | 58.4% | 78.1% | 76.8% |
| S | 1203 | 62.0% | 78.5% | 86.0% | 77.8% |
| T | 1372 | 61.3% | 61.2% | 71.7% | 67.9% |
| U | 1664 | 61.3% | 72.4% | 76.1% | 75.6% |
| V | 1601 | 83.9% | 72.1% | 92.1% | 88.0% |
| W | 1763 | 94.8% | 95.7% | 97.3% | 95.7% |
| X | 1733 | 86.2% | 79.6% | 80.6% | 89.9% |
| Y | 1629 | 97.3% | 88.5% | 93.6% | 93.6% |

#### knn: the 10 worst letter pairs (errors in both directions)

- R/U: 726 errors (R->U 487, U->R 239)
- C/O: 712 errors (C->O 441, O->C 271)
- M/N: 605 errors (M->N 313, N->M 292)
- S/T: 445 errors (S->T 185, T->S 260)
- U/V: 286 errors (U->V 52, V->U 234)
- D/P: 285 errors (D->P 159, P->D 126)
- K/V: 252 errors (K->V 107, V->K 145)
- N/S: 228 errors (N->S 216, S->N 12)
- D/X: 216 errors (D->X 25, X->D 191)
- E/M: 212 errors (E->M 103, M->E 109)

#### mlp: the 10 worst letter pairs (errors in both directions)

- R/U: 535 errors (R->U 293, U->R 242)
- N/T: 263 errors (N->T 114, T->N 149)
- D/P: 181 errors (D->P 57, P->D 124)
- G/H: 168 errors (G->H 28, H->G 140)
- A/T: 153 errors (A->T 28, T->A 125)
- T/X: 134 errors (T->X 31, X->T 103)
- C/O: 122 errors (C->O 107, O->C 15)
- S/T: 113 errors (S->T 55, T->S 58)
- U/V: 105 errors (U->V 36, V->U 69)
- A/S: 103 errors (A->S 17, S->A 86)

#### What the app would show (confidence at least the threshold; the browser's minimum is 0.6)

| model | threshold | share of frames shown | accuracy of what is shown |
| --- | --- | --- | --- |
| knn | 0.5 | 97.4% | 83.1% |
| knn | 0.6 | 94.9% | 84.6% |
| knn | 0.7 | 91.7% | 86.0% |
| knn | 0.8 | 88.6% | 87.5% |
| knn | 0.9 | 84.4% | 89.1% |
| mlp | 0.5 | 98.1% | 89.6% |
| mlp | 0.6 | 95.5% | 90.9% |
| mlp | 0.7 | 92.6% | 92.3% |
| mlp | 0.8 | 89.5% | 93.7% |
| mlp | 0.9 | 85.2% | 95.3% |

k-NN confidence is a vote share and the MLP's is a softmax probability: the two are not comparable, and only the k-NN reaches the browser.

---

## ASL Alphabet Gestures (East West University) Mendeley 48dg9vhmyk v2, Type_01 only, signer = file-number block of 500 (inferred), subset of 500 per letter per signer (seed 0) (2026-11-03)

## with augmentation

### Static letters: leave-one-group-out evaluation

- command: `python ml/evaluate.py --data /tmp/signscribe/asl-ewu.jsonl --alphabet asl --dataset-name ASL Alphabet Gestures (East West University) --dataset-version Mendeley 48dg9vhmyk v2, Type_01 only, signer = file-number block of 500 (inferred), subset of 500 per letter per signer (seed 0) --augment all --out-dir /kaggle/working/signscribe-asl-output/reports/ewu-only --results-md /tmp/signscribe/SignScribe/docs/MODEL_RESULTS.md`
- date (UTC): 2026-11-03T12:44:39+00:00, git commit c88ee4e
- dataset: **ASL Alphabet Gestures (East West University)**, version **Mendeley 48dg9vhmyk v2, Type_01 only, signer = file-number block of 500 (inferred), subset of 500 per letter per signer (seed 0)**, sha256 `67396968421bf0bbfe13dbbcb151f0b1720e7313ccf61b177936fc7cd397d0b5`
- alphabet: asl; takes: 14639; persons: 3, sources: 1, signers: 3
- split: **leave-one-person-out**, 3 held-out groups, the same folds for every model
- augmentation (training side only): rotate+scale+mirror x2 copies per frame
- python 3.13.16, numpy 2.1.3

| model | description | samples | pooled accuracy | mean over held-out groups | worst group | best group | macro recall |
| --- | --- | --- | --- | --- | --- | --- | --- |
| knn | k-NN, k=5, distance-weighted vote on the 60 hand features (same as the browser) | 14639 | 78.3% | 78.7% | 67.9% | 84.3% | 71.0% |
| mlp | MLP 60-64-32-C, ReLU, Adam lr=0.003, weight decay=0.0001, 60 epochs, batch 128, seed 0 | 14639 | 80.0% | 78.6% | 66.1% | 88.8% | 72.5% |

Pooled = every held-out sample counted once (large groups weigh more). Mean over groups = each held-out person/source counts once.

#### Per letter (precision / recall)

| letter | support | knn precision | knn recall | mlp precision | mlp recall |
| --- | --- | --- | --- | --- | --- |
| A | 402 | 59.6% | 58.7% | 61.2% | 66.7% |
| B | 889 | 90.8% | 98.2% | 93.6% | 97.8% |
| C | 571 | 78.0% | 50.8% | 78.7% | 72.5% |
| D | 819 | 61.2% | 66.9% | 77.4% | 70.8% |
| E | 689 | 74.7% | 84.2% | 75.3% | 85.8% |
| F | 1034 | 94.2% | 98.4% | 97.0% | 97.7% |
| G | 771 | 95.6% | 90.9% | 94.2% | 81.6% |
| H | 834 | 96.3% | 83.9% | 94.7% | 85.9% |
| I | 841 | 92.2% | 90.5% | 94.6% | 88.8% |
| K | 850 | 86.8% | 90.2% | 71.3% | 95.6% |
| L | 839 | 91.9% | 86.3% | 84.6% | 81.0% |
| M | 302 | 74.2% | 57.3% | 71.0% | 66.6% |
| N | 177 | 34.4% | 29.9% | 15.5% | 19.8% |
| O | 535 | 63.7% | 77.2% | 78.9% | 79.8% |
| P | 447 | 22.6% | 19.5% | 38.6% | 12.1% |
| Q | 84 | 32.4% | 27.4% | 21.6% | 19.0% |
| R | 590 | 56.3% | 50.5% | 70.8% | 64.1% |
| S | 203 | 51.7% | 60.1% | 40.6% | 67.0% |
| T | 372 | 59.4% | 64.8% | 46.9% | 58.6% |
| U | 664 | 58.5% | 79.5% | 70.7% | 92.0% |
| V | 601 | 78.2% | 68.2% | 84.5% | 76.2% |
| W | 763 | 94.9% | 94.6% | 93.3% | 91.2% |
| X | 733 | 84.0% | 86.9% | 89.1% | 85.5% |
| Y | 629 | 93.9% | 88.7% | 94.8% | 84.3% |

#### knn: the 10 worst letter pairs (errors in both directions)

- D/P: 324 errors (D->P 167, P->D 157)
- R/U: 320 errors (R->U 223, U->R 97)
- C/O: 195 errors (C->O 140, O->C 55)
- U/V: 134 errors (U->V 19, V->U 115)
- A/T: 100 errors (A->T 54, T->A 46)
- C/E: 65 errors (C->E 62, E->C 3)
- D/X: 64 errors (D->X 16, X->D 48)
- R/V: 63 errors (R->V 28, V->R 35)
- L/P: 61 errors (L->P 23, P->L 38)
- M/N: 54 errors (M->N 33, N->M 21)

#### mlp: the 10 worst letter pairs (errors in both directions)

- R/U: 198 errors (R->U 160, U->R 38)
- D/P: 140 errors (D->P 36, P->D 104)
- N/T: 126 errors (N->T 37, T->N 89)
- K/P: 111 errors (K->P 1, P->K 110)
- K/L: 97 errors (K->L 1, L->K 96)
- U/V: 75 errors (U->V 2, V->U 73)
- C/O: 70 errors (C->O 52, O->C 18)
- M/N: 68 errors (M->N 45, N->M 23)
- L/P: 67 errors (L->P 11, P->L 56)
- D/R: 64 errors (D->R 57, R->D 7)

#### What the app would show (confidence at least the threshold; the browser's minimum is 0.6)

| model | threshold | share of frames shown | accuracy of what is shown |
| --- | --- | --- | --- |
| knn | 0.5 | 95.2% | 81.2% |
| knn | 0.6 | 90.2% | 83.6% |
| knn | 0.7 | 83.9% | 86.7% |
| knn | 0.8 | 79.9% | 88.3% |
| knn | 0.9 | 72.5% | 91.4% |
| mlp | 0.5 | 97.3% | 81.6% |
| mlp | 0.6 | 93.7% | 83.5% |
| mlp | 0.7 | 90.2% | 85.0% |
| mlp | 0.8 | 86.3% | 86.8% |
| mlp | 0.9 | 80.7% | 89.4% |

k-NN confidence is a vote share and the MLP's is a softmax probability: the two are not comparable, and only the k-NN reaches the browser.

---

## ASL-HG American Sign Language Hand Gesture Image Dataset Mendeley j4y5w2c8w9 v1, raw images, signer = P1..P10 from the file name, subset of 500 per letter per signer (seed 0) (2026-11-03)

## with augmentation

### Static letters: leave-one-group-out evaluation

- command: `python ml/evaluate.py --data /tmp/signscribe/asl-hg.jsonl --alphabet asl --dataset-name ASL-HG American Sign Language Hand Gesture Image Dataset --dataset-version Mendeley j4y5w2c8w9 v1, raw images, signer = P1..P10 from the file name, subset of 500 per letter per signer (seed 0) --augment all --out-dir /kaggle/working/signscribe-asl-output/reports/hg-only --results-md /tmp/signscribe/SignScribe/docs/MODEL_RESULTS.md`
- date (UTC): 2026-11-03T12:45:08+00:00, git commit c88ee4e
- dataset: **ASL-HG American Sign Language Hand Gesture Image Dataset**, version **Mendeley j4y5w2c8w9 v1, raw images, signer = P1..P10 from the file name, subset of 500 per letter per signer (seed 0)**, sha256 `d0dd553cc63d4472c9744166066549cc4db09ebdca3eb99b86e40cb6fc356bfa`
- alphabet: asl; takes: 23980; persons: 10, sources: 1, signers: 10
- split: **leave-one-person-out**, 10 held-out groups, the same folds for every model
- augmentation (training side only): rotate+scale+mirror x2 copies per frame
- python 3.13.16, numpy 2.1.3

| model | description | samples | pooled accuracy | mean over held-out groups | worst group | best group | macro recall |
| --- | --- | --- | --- | --- | --- | --- | --- |
| knn | k-NN, k=5, distance-weighted vote on the 60 hand features (same as the browser) | 23980 | 90.6% | 90.6% | 82.5% | 97.2% | 90.6% |
| mlp | MLP 60-64-32-C, ReLU, Adam lr=0.003, weight decay=0.0001, 60 epochs, batch 128, seed 0 | 23980 | 92.8% | 92.8% | 81.9% | 100.0% | 92.8% |

Pooled = every held-out sample counted once (large groups weigh more). Mean over groups = each held-out person/source counts once.

#### Per letter (precision / recall)

| letter | support | knn precision | knn recall | mlp precision | mlp recall |
| --- | --- | --- | --- | --- | --- |
| A | 1000 | 99.8% | 99.9% | 98.4% | 100.0% |
| B | 1000 | 99.9% | 100.0% | 99.7% | 100.0% |
| C | 1000 | 92.1% | 77.2% | 100.0% | 91.2% |
| D | 1000 | 99.7% | 100.0% | 90.9% | 100.0% |
| E | 1000 | 83.3% | 90.0% | 99.2% | 90.0% |
| F | 1000 | 100.0% | 100.0% | 100.0% | 99.7% |
| G | 1000 | 100.0% | 97.6% | 99.9% | 91.4% |
| H | 982 | 97.6% | 99.5% | 91.8% | 99.4% |
| I | 1000 | 93.0% | 100.0% | 100.0% | 100.0% |
| K | 1000 | 99.4% | 100.0% | 96.1% | 97.7% |
| L | 1000 | 97.0% | 100.0% | 100.0% | 90.0% |
| M | 1000 | 55.9% | 50.9% | 81.7% | 82.3% |
| N | 1000 | 64.4% | 55.8% | 80.5% | 80.3% |
| O | 1000 | 82.5% | 93.4% | 91.9% | 100.0% |
| P | 1000 | 97.3% | 99.8% | 93.6% | 96.9% |
| Q | 1000 | 99.8% | 97.3% | 96.5% | 100.0% |
| R | 998 | 95.9% | 88.8% | 85.6% | 81.8% |
| S | 1000 | 65.8% | 79.6% | 77.5% | 81.9% |
| T | 1000 | 70.9% | 66.3% | 73.9% | 74.5% |
| U | 1000 | 86.7% | 89.6% | 86.7% | 82.7% |
| V | 1000 | 93.5% | 96.6% | 88.6% | 95.2% |
| W | 1000 | 100.0% | 100.0% | 100.0% | 100.0% |
| X | 1000 | 100.0% | 99.6% | 97.9% | 92.0% |
| Y | 1000 | 99.9% | 92.5% | 99.9% | 100.0% |

#### knn: the 10 worst letter pairs (errors in both directions)

- M/N: 579 errors (M->N 307, N->M 272)
- S/T: 510 errors (S->T 202, T->S 308)
- E/M: 281 errors (E->M 100, M->E 181)
- C/O: 264 errors (C->O 198, O->C 66)
- R/U: 145 errors (R->U 111, U->R 34)
- N/S: 105 errors (N->S 105, S->N 0)
- U/V: 94 errors (U->V 67, V->U 27)
- I/Y: 75 errors (I->Y 0, Y->I 75)
- N/T: 65 errors (N->T 65, T->N 0)
- M/T: 32 errors (M->T 3, T->M 29)

#### mlp: the 10 worst letter pairs (errors in both directions)

- S/T: 380 errors (S->T 165, T->S 215)
- M/N: 250 errors (M->N 168, N->M 82)
- R/U: 216 errors (R->U 83, U->R 133)
- N/T: 112 errors (N->T 92, T->N 20)
- E/M: 107 errors (E->M 100, M->E 7)
- R/V: 103 errors (R->V 99, V->R 4)
- D/L: 100 errors (D->L 0, L->D 100)
- C/O: 88 errors (C->O 88, O->C 0)
- G/H: 87 errors (G->H 86, H->G 1)
- P/X: 66 errors (P->X 0, X->P 66)

#### What the app would show (confidence at least the threshold; the browser's minimum is 0.6)

| model | threshold | share of frames shown | accuracy of what is shown |
| --- | --- | --- | --- |
| knn | 0.5 | 99.9% | 90.6% |
| knn | 0.6 | 98.8% | 91.2% |
| knn | 0.7 | 97.1% | 91.7% |
| knn | 0.8 | 96.1% | 92.1% |
| knn | 0.9 | 93.3% | 92.6% |
| mlp | 0.5 | 99.6% | 93.0% |
| mlp | 0.6 | 97.7% | 93.7% |
| mlp | 0.7 | 95.7% | 94.4% |
| mlp | 0.8 | 92.9% | 95.1% |
| mlp | 0.9 | 88.5% | 96.0% |

k-NN confidence is a vote share and the MLP's is a softmax probability: the two are not comparable, and only the k-NN reaches the browser.
