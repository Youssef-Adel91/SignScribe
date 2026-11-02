# Confidence calibration: ASL Alphabet Gestures (East West University) Mendeley 48dg9vhmyk v2, Type_01 only, signer = file-number block of 500 (inferred), subset of 500 per letter per signer (seed 0)


- dataset sha256 `d75f37cf3ac3294633e37eebfc384d0096f62f39c71c0575967cb18c7d867e5e`
- alphabet `asl`, augmentation (training side only): rotate+scale+mirror x2 copies per frame, k=5, seed 0
- command: `python ml/calibrate.py --data /tmp/signscribe/asl.jsonl --alphabet asl --dataset-name ASL Alphabet Gestures (East West University) --dataset-version Mendeley 48dg9vhmyk v2, Type_01 only, signer = file-number block of 500 (inferred), subset of 500 per letter per signer (seed 0) --out-dir /kaggle/working/signscribe-asl-output/reports`

Held-out predictions: leave-one-person-out over 3 groups, every prediction made by a model that never saw that group.

### knn: 14639 held-out predictions

Confidence is the winner's share of the distance-weighted votes of the 5 nearest samples (what the browser's k-NN reports). A prediction is *shown* when its confidence is at least the threshold.

| threshold | shown | coverage | precision of shown (95% interval) | wrong shown per 100 predictions |
| --- | --- | --- | --- | --- |
| 0.00 | 14639 | 100.0% | 78.3% (77.6-79.0%) | 21.70 |
| 0.30 | 14607 | 99.8% | 78.4% (77.8-79.1%) | 21.50 |
| 0.40 | 14417 | 98.5% | 79.3% (78.6-79.9%) | 20.41 |
| 0.50 | 13940 | 95.2% | 81.2% (80.5-81.8%) | 17.92 |
| 0.60 | 13200 | 90.2% | 83.6% (83.0-84.3%) | 14.76 |
| 0.70 | 12279 | 83.9% | 86.7% (86.1-87.3%) | 11.16 |
| 0.80 | 11701 | 79.9% | 88.3% (87.7-88.8%) | 9.39 |
| 0.90 | 10616 | 72.5% | 91.4% (90.8-91.9%) | 6.26 |
| 0.95 (same predictions as the row above) | 10616 | 72.5% | 91.4% (90.8-91.9%) | 6.26 |
| 0.99 (same predictions as the row above) | 10616 | 72.5% | 91.4% (90.8-91.9%) | 6.26 |

The k-NN rows at 0.95, 0.99 show exactly the same predictions as the row before. That is expected for a vote share: with k=5, when all neighbours agree the share is exactly 1.0, and the votes are weighted by distance, so values just below 1.0 are rare. A threshold between two such rows changes nothing; pick from the rows that differ.

### mlp: 14639 held-out predictions

Confidence is the softmax probability of the best letter (what the browser's neural network reports). A prediction is *shown* when its confidence is at least the threshold.

| threshold | shown | coverage | precision of shown (95% interval) | wrong shown per 100 predictions |
| --- | --- | --- | --- | --- |
| 0.00 | 14639 | 100.0% | 80.0% (79.3-80.6%) | 20.05 |
| 0.30 | 14624 | 99.9% | 80.0% (79.4-80.7%) | 19.96 |
| 0.40 | 14509 | 99.1% | 80.5% (79.8-81.1%) | 19.33 |
| 0.50 | 14247 | 97.3% | 81.6% (80.9-82.2%) | 17.92 |
| 0.60 | 13721 | 93.7% | 83.5% (82.8-84.1%) | 15.49 |
| 0.70 | 13205 | 90.2% | 85.0% (84.4-85.6%) | 13.51 |
| 0.80 | 12629 | 86.3% | 86.8% (86.2-87.4%) | 11.36 |
| 0.90 | 11809 | 80.7% | 89.4% (88.8-90.0%) | 8.54 |
| 0.95 | 11040 | 75.4% | 91.4% (90.9-91.9%) | 6.47 |
| 0.99 | 9512 | 65.0% | 94.3% (93.8-94.7%) | 3.71 |

The two tables are not comparable row by row: a k-NN vote share and an MLP softmax probability are different scales.
This report does not choose a threshold. `LETTER.minConfidence` / `confirmConfidence` in `src/recognition/letterController.ts` were set for the k-NN and are changed by hand, with a test, after reading the table of the model that will ship.
