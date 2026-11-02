# Confidence calibration: ArSL21L Mendeley 8hrn3bvdvk v1, as published


- dataset sha256 `4d34fa3f793710f913ce10a006b74473764e16702ac7afefdb05d301c6c49e11`
- alphabet `arsl`, augmentation (training side only): rotate+scale+mirror x2 copies per frame, k=5, seed 0
- command: `python ml/calibrate.py --data /tmp/signscribe/arsl21l.jsonl --alphabet arsl --dataset-name ArSL21L --dataset-version Mendeley 8hrn3bvdvk v1, as published --out-dir /kaggle/working/signscribe-arsl-output/reports`

Held-out predictions: leave-one-person-out over 50 groups, every prediction made by a model that never saw that group.

### knn: 13662 held-out predictions

Confidence is the winner's share of the distance-weighted votes of the 5 nearest samples (what the browser's k-NN reports). A prediction is *shown* when its confidence is at least the threshold.

| threshold | shown | coverage | precision of shown (95% interval) | wrong shown per 100 predictions |
| --- | --- | --- | --- | --- |
| 0.00 | 13662 | 100.0% | 91.1% (90.6-91.5%) | 8.92 |
| 0.30 | 13656 | 100.0% | 91.1% (90.6-91.6%) | 8.88 |
| 0.40 | 13594 | 99.5% | 91.5% (91.0-91.9%) | 8.50 |
| 0.50 | 13344 | 97.7% | 92.5% (92.0-92.9%) | 7.35 |
| 0.60 | 12818 | 93.8% | 94.3% (93.9-94.7%) | 5.34 |
| 0.70 | 12043 | 88.1% | 95.9% (95.5-96.2%) | 3.64 |
| 0.80 | 11617 | 85.0% | 96.7% (96.4-97.0%) | 2.80 |
| 0.90 | 10294 | 75.3% | 98.0% (97.7-98.2%) | 1.54 |
| 0.95 (same predictions as the row above) | 10294 | 75.3% | 98.0% (97.7-98.2%) | 1.54 |
| 0.99 (same predictions as the row above) | 10294 | 75.3% | 98.0% (97.7-98.2%) | 1.54 |

The k-NN rows at 0.95, 0.99 show exactly the same predictions as the row before. That is expected for a vote share: with k=5, when all neighbours agree the share is exactly 1.0, and the votes are weighted by distance, so values just below 1.0 are rare. A threshold between two such rows changes nothing; pick from the rows that differ.

### mlp: 13662 held-out predictions

Confidence is the softmax probability of the best letter (what the browser's neural network reports). A prediction is *shown* when its confidence is at least the threshold.

| threshold | shown | coverage | precision of shown (95% interval) | wrong shown per 100 predictions |
| --- | --- | --- | --- | --- |
| 0.00 | 13662 | 100.0% | 95.0% (94.7-95.4%) | 4.96 |
| 0.30 | 13655 | 99.9% | 95.1% (94.7-95.4%) | 4.91 |
| 0.40 | 13619 | 99.7% | 95.3% (94.9-95.7%) | 4.68 |
| 0.50 | 13542 | 99.1% | 95.7% (95.3-96.0%) | 4.29 |
| 0.60 | 13339 | 97.6% | 96.4% (96.1-96.7%) | 3.53 |
| 0.70 | 13133 | 96.1% | 97.0% (96.7-97.3%) | 2.87 |
| 0.80 | 12884 | 94.3% | 97.5% (97.3-97.8%) | 2.31 |
| 0.90 | 12449 | 91.1% | 98.2% (98.0-98.4%) | 1.62 |
| 0.95 | 11932 | 87.3% | 98.6% (98.3-98.8%) | 1.25 |
| 0.99 | 10424 | 76.3% | 99.2% (99.0-99.4%) | 0.61 |

The two tables are not comparable row by row: a k-NN vote share and an MLP softmax probability are different scales.
This report does not choose a threshold. `LETTER.minConfidence` / `confirmConfidence` in `src/recognition/letterController.ts` were set for the k-NN and are changed by hand, with a test, after reading the table of the model that will ship.
