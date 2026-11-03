# Letter model (neural network)

- trained on ALL 38619 takes of dataset sha256 `2aeac81a780b7277ae2246b787d22e291c1ed4bdfa46d07f95074c40523b7cc5` (24 labels), rotate+scale+mirror x2 copies per frame (augmentation), seed 0
- network: MLP 60-64-32-C, ReLU, Adam lr=0.003, weight decay=0.0001, 60 epochs, batch 128, seed 0
- **no accuracy is reported here**: nothing was held out. Honest numbers: `ml/evaluate.py` on the same data (see docs/MODEL_RESULTS.md)
- evaluation copied from ml/evaluate.py: leave-one-person-out, pooled accuracy 90.8%
