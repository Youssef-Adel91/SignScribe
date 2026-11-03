# Evaluation: ASL letters, EWU plus ASL-HG merged Mendeley 48dg9vhmyk v2, Type_01 only, signer = file-number block of 500 (inferred); Mendeley j4y5w2c8w9 v1, raw images, signer = P1..P10 from the file name, subset of 500 per letter per signer (seed 0)

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

