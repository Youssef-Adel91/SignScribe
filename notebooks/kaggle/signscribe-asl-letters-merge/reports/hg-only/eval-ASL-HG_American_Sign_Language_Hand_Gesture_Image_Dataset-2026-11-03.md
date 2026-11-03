# Evaluation: ASL-HG American Sign Language Hand Gesture Image Dataset Mendeley j4y5w2c8w9 v1, raw images, signer = P1..P10 from the file name, subset of 500 per letter per signer (seed 0)

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

