# Letter model (neural network)

- trained on ALL 13662 takes of dataset sha256 `4d34fa3f793710f913ce10a006b74473764e16702ac7afefdb05d301c6c49e11` (32 labels), rotate+scale+mirror x2 copies per frame (augmentation), seed 0
- network: MLP 60-64-32-C, ReLU, Adam lr=0.003, weight decay=0.0001, 60 epochs, batch 128, seed 0
- **no accuracy is reported here**: nothing was held out. Honest numbers: `ml/evaluate.py` on the same data (see docs/MODEL_RESULTS.md)
- evaluation copied from ml/evaluate.py: leave-one-person-out, pooled accuracy 95.0%
