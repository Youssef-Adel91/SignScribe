# Static letters: k-NN evaluation

- dataset sha256: `2aeac81a780b7277ae2246b787d22e291c1ed4bdfa46d07f95074c40523b7cc5`
- takes: 38619, signers: 13, sessions: 13
- evaluation method: **leave-one-person-out** (13 held-out groups)
- samples evaluated: 38619
- k: 5
- augmentation (training side only): rotate+scale+mirror x2 copies per frame

**Accuracy on held-out groups (leave-one-person-out): 87.4%**

| letter | support | precision | recall |
| ------ | ------- | --------- | ------ |
| A | 1402 | 93.2% | 89.1% |
| B | 1889 | 97.0% | 98.3% |
| C | 1571 | 89.5% | 85.0% |
| D | 1819 | 87.0% | 87.1% |
| E | 1689 | 86.7% | 87.3% |
| F | 2034 | 97.6% | 99.3% |
| G | 1771 | 94.0% | 95.4% |
| H | 1816 | 96.4% | 89.4% |
| I | 1841 | 93.6% | 95.4% |
| K | 1850 | 90.3% | 93.7% |
| L | 1839 | 93.7% | 96.1% |
| M | 1302 | 58.1% | 55.1% |
| N | 1177 | 56.0% | 52.1% |
| O | 1535 | 84.5% | 90.0% |
| P | 1447 | 79.8% | 74.9% |
| Q | 1084 | 93.8% | 91.2% |
| R | 1588 | 80.1% | 81.9% |
| S | 1203 | 67.8% | 81.4% |
| T | 1372 | 74.3% | 71.1% |
| U | 1664 | 80.6% | 84.6% |
| V | 1601 | 89.7% | 85.0% |
| W | 1763 | 96.5% | 98.2% |
| X | 1733 | 91.6% | 94.7% |
| Y | 1629 | 98.0% | 91.2% |

Most frequent confusions (true -> predicted: count):

- M -> N: 387
- N -> M: 318
- T -> S: 275
- R -> U: 225
- U -> R: 202
- C -> O: 170
- S -> T: 153
- D -> P: 129
- O -> C: 129
- E -> M: 124

Reading this: with a single signer the result only shows how repeatable that person is. Quote results for new people only when the method is leave-one-signer-out with several signers.
