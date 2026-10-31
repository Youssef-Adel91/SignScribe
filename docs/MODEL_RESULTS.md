# Model results

**Produced by `ml/evaluate.py` runs on real data, one section per run** (below: ArSL21L as published (2026-10-31)). Nobody types a number into this file. A run on generated data, a same-person split or a split whose held-out groups have classes the training groups lack is refused by the script and cannot appear here.

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
