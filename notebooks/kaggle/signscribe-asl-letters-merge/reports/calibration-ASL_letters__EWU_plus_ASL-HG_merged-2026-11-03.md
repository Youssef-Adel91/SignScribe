# Confidence calibration: ASL letters, EWU plus ASL-HG merged Mendeley 48dg9vhmyk v2, Type_01 only, signer = file-number block of 500 (inferred); Mendeley j4y5w2c8w9 v1, raw images, signer = P1..P10 from the file name, subset of 500 per letter per signer (seed 0)


- dataset sha256 `2aeac81a780b7277ae2246b787d22e291c1ed4bdfa46d07f95074c40523b7cc5`
- alphabet `asl`, augmentation (training side only): rotate+scale+mirror x2 copies per frame, k=5, seed 0
- command: `python ml/calibrate.py --data /tmp/signscribe/asl.jsonl --alphabet asl --dataset-name ASL letters, EWU plus ASL-HG merged --dataset-version Mendeley 48dg9vhmyk v2, Type_01 only, signer = file-number block of 500 (inferred); Mendeley j4y5w2c8w9 v1, raw images, signer = P1..P10 from the file name, subset of 500 per letter per signer (seed 0) --out-dir /kaggle/working/signscribe-asl-output/reports`

Held-out predictions: leave-one-person-out over 13 groups, every prediction made by a model that never saw that group.

### knn: 38619 held-out predictions

Confidence is the winner's share of the distance-weighted votes of the 5 nearest samples (what the browser's k-NN reports). A prediction is *shown* when its confidence is at least the threshold.

| threshold | shown | coverage | precision of shown (95% interval) | wrong shown per 100 predictions |
| --- | --- | --- | --- | --- |
| 0.00 | 38619 | 100.0% | 87.4% (87.1-87.7%) | 12.59 |
| 0.30 | 38608 | 100.0% | 87.4% (87.1-87.8%) | 12.57 |
| 0.40 | 38482 | 99.6% | 87.7% (87.3-88.0%) | 12.29 |
| 0.50 | 38098 | 98.7% | 88.2% (87.9-88.6%) | 11.59 |
| 0.60 | 37092 | 96.0% | 89.8% (89.4-90.1%) | 9.84 |
| 0.70 | 35878 | 92.9% | 91.0% (90.7-91.3%) | 8.38 |
| 0.80 | 34944 | 90.5% | 92.1% (91.8-92.4%) | 7.16 |
| 0.90 | 33417 | 86.5% | 93.3% (93.0-93.5%) | 5.81 |
| 0.95 (same predictions as the row above) | 33417 | 86.5% | 93.3% (93.0-93.5%) | 5.81 |
| 0.99 (same predictions as the row above) | 33417 | 86.5% | 93.3% (93.0-93.5%) | 5.81 |

The k-NN rows at 0.95, 0.99 show exactly the same predictions as the row before. That is expected for a vote share: with k=5, when all neighbours agree the share is exactly 1.0, and the votes are weighted by distance, so values just below 1.0 are rare. A threshold between two such rows changes nothing; pick from the rows that differ.

### mlp: 38619 held-out predictions

Confidence is the softmax probability of the best letter (what the browser's neural network reports). A prediction is *shown* when its confidence is at least the threshold.

| threshold | shown | coverage | precision of shown (95% interval) | wrong shown per 100 predictions |
| --- | --- | --- | --- | --- |
| 0.00 | 38619 | 100.0% | 90.8% (90.5-91.0%) | 9.25 |
| 0.30 | 38582 | 99.9% | 90.8% (90.5-91.1%) | 9.17 |
| 0.40 | 38441 | 99.5% | 91.1% (90.8-91.4%) | 8.88 |
| 0.50 | 38148 | 98.8% | 91.5% (91.2-91.8%) | 8.37 |
| 0.60 | 37401 | 96.8% | 92.5% (92.2-92.7%) | 7.29 |
| 0.70 | 36559 | 94.7% | 93.6% (93.3-93.8%) | 6.11 |
| 0.80 | 35485 | 91.9% | 94.8% (94.5-95.0%) | 4.81 |
| 0.90 | 33837 | 87.6% | 96.3% (96.1-96.5%) | 3.25 |
| 0.95 | 32399 | 83.9% | 97.3% (97.2-97.5%) | 2.23 |
| 0.99 | 29282 | 75.8% | 98.8% (98.7-98.9%) | 0.91 |

The two tables are not comparable row by row: a k-NN vote share and an MLP softmax probability are different scales.
This report does not choose a threshold. `LETTER.minConfidence` / `confirmConfidence` in `src/recognition/letterController.ts` were set for the k-NN and are changed by hand, with a test, after reading the table of the model that will ship.
