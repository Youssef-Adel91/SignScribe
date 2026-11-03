# Evaluation: ASL Alphabet Gestures (East West University) Mendeley 48dg9vhmyk v2, Type_01 only, signer = file-number block of 500 (inferred), subset of 500 per letter per signer (seed 0)

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

