"""A small multi-layer perceptron in plain numpy: 60 features -> 64 -> 32 -> letters, trained with Adam.

Fixed hyper-parameters, chosen before looking at any result and NOT tuned on the held-out group. Used to compare
with the k-NN on the same folds; the browser still loads the k-NN JSON.
"""
from __future__ import annotations

import numpy as np

HIDDEN = (64, 32)
EPOCHS = 60
BATCH = 128
LR = 3e-3
WEIGHT_DECAY = 1e-4


class MLP:
    def __init__(self, hidden=HIDDEN, epochs=EPOCHS, batch=BATCH, lr=LR, weight_decay=WEIGHT_DECAY, seed=0):
        self.hidden, self.epochs, self.batch, self.lr, self.wd, self.seed = hidden, epochs, batch, lr, weight_decay, seed
        self.classes: list = []

    def describe(self) -> str:
        return f"MLP 60-{'-'.join(map(str, self.hidden))}-C, ReLU, Adam lr={self.lr}, weight decay={self.wd}, {self.epochs} epochs, batch {self.batch}, seed {self.seed}"

    def _forward(self, X):
        acts = [X]
        for i, (W, b) in enumerate(zip(self.W, self.b)):
            z = acts[-1] @ W + b
            acts.append(z if i == len(self.W) - 1 else np.maximum(z, 0.0))
        z = acts[-1]
        z = z - z.max(axis=1, keepdims=True)
        e = np.exp(z)
        return acts, e / e.sum(axis=1, keepdims=True)

    def fit(self, X, labels):
        X = np.asarray(X, dtype=np.float64)
        self.classes = sorted(set(labels))
        idx = {c: i for i, c in enumerate(self.classes)}
        y = np.asarray([idx[l] for l in labels])
        self.mu, self.sd = X.mean(axis=0), X.std(axis=0) + 1e-8
        Xs = (X - self.mu) / self.sd
        rng = np.random.default_rng(self.seed)
        sizes = [X.shape[1], *self.hidden, len(self.classes)]
        self.W = [rng.normal(0, np.sqrt(2.0 / a), (a, b)) for a, b in zip(sizes[:-1], sizes[1:])]
        self.b = [np.zeros(b) for b in sizes[1:]]
        m = [np.zeros_like(p) for p in self.W + self.b]
        v = [np.zeros_like(p) for p in self.W + self.b]
        step = 0
        n = len(Xs)
        for _ in range(self.epochs):
            order = rng.permutation(n)
            for s in range(0, n, self.batch):
                bi = order[s : s + self.batch]
                acts, p = self._forward(Xs[bi])
                g = p.copy()
                g[np.arange(len(bi)), y[bi]] -= 1.0
                g /= len(bi)
                gW, gb = [None] * len(self.W), [None] * len(self.W)
                for L in range(len(self.W) - 1, -1, -1):
                    gW[L] = acts[L].T @ g + self.wd * self.W[L]
                    gb[L] = g.sum(axis=0)
                    if L:
                        g = (g @ self.W[L].T) * (acts[L] > 0)
                step += 1
                params, grads = self.W + self.b, gW + gb
                for i, (pm, gr) in enumerate(zip(params, grads)):
                    m[i] = 0.9 * m[i] + 0.1 * gr
                    v[i] = 0.999 * v[i] + 0.001 * gr * gr
                    mh, vh = m[i] / (1 - 0.9**step), v[i] / (1 - 0.999**step)
                    pm -= self.lr * mh / (np.sqrt(vh) + 1e-8)
        return self

    def predict_proba(self, X):
        _, p = self._forward((np.asarray(X, dtype=np.float64) - self.mu) / self.sd)
        return p

    def predict(self, X):
        """Returns (best label, its probability, second label, its probability) for every row."""
        p = self.predict_proba(X)
        order = np.argsort(-p, axis=1)
        r = np.arange(len(p))
        first, second = order[:, 0], order[:, 1] if p.shape[1] > 1 else order[:, 0]
        return [self.classes[i] for i in first], p[r, first], [self.classes[i] for i in second], p[r, second]
