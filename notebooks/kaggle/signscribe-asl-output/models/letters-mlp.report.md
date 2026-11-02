# Letter model (neural network)

- trained on ALL 14639 takes of dataset sha256 `d75f37cf3ac3294633e37eebfc384d0096f62f39c71c0575967cb18c7d867e5e` (24 labels), rotate+scale+mirror x2 copies per frame (augmentation), seed 0
- network: MLP 60-64-32-C, ReLU, Adam lr=0.003, weight decay=0.0001, 60 epochs, batch 128, seed 0
- **no accuracy is reported here**: nothing was held out. Honest numbers: `ml/evaluate.py` on the same data (see docs/MODEL_RESULTS.md)
- evaluation copied from ml/evaluate.py: leave-one-person-out, pooled accuracy 80.0%
