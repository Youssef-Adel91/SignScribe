# Evaluation: ASL Alphabet Gestures (East West University) Mendeley 48dg9vhmyk v2, Type_01 only, signer = file-number block of 500 (inferred), subset of 500 per letter per signer (seed 0)

## with augmentation

### Static letters: leave-one-group-out evaluation

- command: `python ml/evaluate.py --data /tmp/signscribe/asl.jsonl --alphabet asl --dataset-name ASL Alphabet Gestures (East West University) --dataset-version Mendeley 48dg9vhmyk v2, Type_01 only, signer = file-number block of 500 (inferred), subset of 500 per letter per signer (seed 0) --augment all --augment-ablation --out-dir /kaggle/working/signscribe-asl-output/reports --results-md /tmp/signscribe/SignScribe/docs/MODEL_RESULTS.md`
- date (UTC): 2026-11-02T15:47:39+00:00, git commit c88ee4e
- dataset: **ASL Alphabet Gestures (East West University)**, version **Mendeley 48dg9vhmyk v2, Type_01 only, signer = file-number block of 500 (inferred), subset of 500 per letter per signer (seed 0)**, sha256 `d75f37cf3ac3294633e37eebfc384d0096f62f39c71c0575967cb18c7d867e5e`
- alphabet: asl; takes: 14639; persons: 3, sources: 1, signers: 3
- split: **leave-one-person-out**, 3 held-out groups, the same folds for every model
- augmentation (training side only): rotate+scale+mirror x2 copies per frame
- python 3.13.15, numpy 2.1.3

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


## no augmentation

### Static letters: leave-one-group-out evaluation

- command: `python ml/evaluate.py --data /tmp/signscribe/asl.jsonl --alphabet asl --dataset-name ASL Alphabet Gestures (East West University) --dataset-version Mendeley 48dg9vhmyk v2, Type_01 only, signer = file-number block of 500 (inferred), subset of 500 per letter per signer (seed 0) --augment all --augment-ablation --out-dir /kaggle/working/signscribe-asl-output/reports --results-md /tmp/signscribe/SignScribe/docs/MODEL_RESULTS.md`
- date (UTC): 2026-11-02T15:47:39+00:00, git commit c88ee4e
- dataset: **ASL Alphabet Gestures (East West University)**, version **Mendeley 48dg9vhmyk v2, Type_01 only, signer = file-number block of 500 (inferred), subset of 500 per letter per signer (seed 0)**, sha256 `d75f37cf3ac3294633e37eebfc384d0096f62f39c71c0575967cb18c7d867e5e`
- alphabet: asl; takes: 14639; persons: 3, sources: 1, signers: 3
- split: **leave-one-person-out**, 3 held-out groups, the same folds for every model
- augmentation (training side only): none
- python 3.13.15, numpy 2.1.3

| model | description | samples | pooled accuracy | mean over held-out groups | worst group | best group | macro recall |
| --- | --- | --- | --- | --- | --- | --- | --- |
| knn | k-NN, k=5, distance-weighted vote on the 60 hand features (same as the browser) | 14639 | 74.2% | 75.3% | 62.9% | 82.5% | 66.8% |
| mlp | MLP 60-64-32-C, ReLU, Adam lr=0.003, weight decay=0.0001, 60 epochs, batch 128, seed 0 | 14639 | 73.2% | 73.5% | 58.3% | 82.0% | 67.2% |

Pooled = every held-out sample counted once (large groups weigh more). Mean over groups = each held-out person/source counts once.

#### Per letter (precision / recall)

| letter | support | knn precision | knn recall | mlp precision | mlp recall |
| --- | --- | --- | --- | --- | --- |
| A | 402 | 58.4% | 52.5% | 68.7% | 68.9% |
| B | 889 | 85.8% | 95.5% | 89.7% | 92.2% |
| C | 571 | 64.6% | 45.7% | 87.6% | 53.4% |
| D | 819 | 57.3% | 59.7% | 61.8% | 78.0% |
| E | 689 | 70.0% | 84.2% | 79.1% | 84.2% |
| F | 1034 | 89.3% | 96.9% | 93.3% | 98.3% |
| G | 771 | 89.8% | 88.3% | 60.5% | 76.8% |
| H | 834 | 95.1% | 79.5% | 91.5% | 24.5% |
| I | 841 | 91.4% | 89.8% | 83.0% | 87.0% |
| K | 850 | 84.5% | 83.9% | 67.0% | 93.5% |
| L | 839 | 87.8% | 86.4% | 86.5% | 78.8% |
| M | 302 | 64.7% | 51.7% | 79.8% | 43.0% |
| N | 177 | 28.8% | 24.9% | 21.6% | 46.3% |
| O | 535 | 61.0% | 63.2% | 75.8% | 68.4% |
| P | 447 | 18.8% | 15.7% | 34.9% | 14.8% |
| Q | 84 | 28.6% | 31.0% | 23.3% | 23.8% |
| R | 590 | 47.8% | 44.1% | 51.5% | 51.5% |
| S | 203 | 46.6% | 53.7% | 46.5% | 63.1% |
| T | 372 | 53.0% | 64.2% | 53.1% | 57.3% |
| U | 664 | 50.5% | 70.3% | 64.0% | 86.9% |
| V | 601 | 72.8% | 59.2% | 75.7% | 69.9% |
| W | 763 | 93.0% | 89.4% | 91.1% | 87.4% |
| X | 733 | 85.4% | 87.4% | 81.5% | 83.9% |
| Y | 629 | 91.4% | 86.2% | 89.4% | 81.7% |

#### knn: the 10 worst letter pairs (errors in both directions)

- R/U: 389 errors (R->U 267, U->R 122)
- D/P: 356 errors (D->P 202, P->D 154)
- C/O: 182 errors (C->O 109, O->C 73)
- U/V: 175 errors (U->V 28, V->U 147)
- E/O: 104 errors (E->O 18, O->E 86)
- A/T: 101 errors (A->T 53, T->A 48)
- C/F: 93 errors (C->F 89, F->C 4)
- K/V: 85 errors (K->V 57, V->K 28)
- A/S: 82 errors (A->S 61, S->A 21)
- L/P: 76 errors (L->P 24, P->L 52)

#### mlp: the 10 worst letter pairs (errors in both directions)

- G/H: 360 errors (G->H 2, H->G 358)
- R/U: 235 errors (R->U 173, U->R 62)
- D/P: 136 errors (D->P 37, P->D 99)
- M/N: 131 errors (M->N 119, N->M 12)
- K/P: 121 errors (K->P 1, P->K 120)
- N/T: 119 errors (N->T 18, T->N 101)
- U/V: 103 errors (U->V 2, V->U 101)
- H/R: 97 errors (H->R 95, R->H 2)
- K/L: 87 errors (K->L 0, L->K 87)
- B/W: 83 errors (B->W 23, W->B 60)

#### What the app would show (confidence at least the threshold; the browser's minimum is 0.6)

| model | threshold | share of frames shown | accuracy of what is shown |
| --- | --- | --- | --- |
| knn | 0.5 | 93.7% | 77.7% |
| knn | 0.6 | 88.4% | 80.5% |
| knn | 0.7 | 82.1% | 83.1% |
| knn | 0.8 | 78.0% | 85.2% |
| knn | 0.9 | 70.7% | 87.9% |
| mlp | 0.5 | 96.5% | 75.1% |
| mlp | 0.6 | 91.7% | 77.2% |
| mlp | 0.7 | 87.0% | 79.3% |
| mlp | 0.8 | 81.5% | 81.6% |
| mlp | 0.9 | 73.1% | 85.4% |

k-NN confidence is a vote share and the MLP's is a softmax probability: the two are not comparable, and only the k-NN reaches the browser.

