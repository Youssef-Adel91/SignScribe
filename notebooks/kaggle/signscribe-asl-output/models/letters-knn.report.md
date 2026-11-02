# Static letters: k-NN evaluation

- dataset sha256: `d75f37cf3ac3294633e37eebfc384d0096f62f39c71c0575967cb18c7d867e5e`
- takes: 14639, signers: 3, sessions: 3
- evaluation method: **leave-one-person-out** (3 held-out groups)
- samples evaluated: 14639
- k: 5
- augmentation (training side only): rotate+scale+mirror x2 copies per frame

**Accuracy on held-out groups (leave-one-person-out): 78.3%**

| letter | support | precision | recall |
| ------ | ------- | --------- | ------ |
| A | 402 | 59.6% | 58.7% |
| B | 889 | 90.8% | 98.2% |
| C | 571 | 78.0% | 50.8% |
| D | 819 | 61.2% | 66.9% |
| E | 689 | 74.7% | 84.2% |
| F | 1034 | 94.2% | 98.4% |
| G | 771 | 95.6% | 90.9% |
| H | 834 | 96.3% | 83.9% |
| I | 841 | 92.2% | 90.5% |
| K | 850 | 86.8% | 90.2% |
| L | 839 | 91.9% | 86.3% |
| M | 302 | 74.2% | 57.3% |
| N | 177 | 34.4% | 29.9% |
| O | 535 | 63.7% | 77.2% |
| P | 447 | 22.6% | 19.5% |
| Q | 84 | 32.4% | 27.4% |
| R | 590 | 56.3% | 50.5% |
| S | 203 | 51.7% | 60.1% |
| T | 372 | 59.4% | 64.8% |
| U | 664 | 58.5% | 79.5% |
| V | 601 | 78.2% | 68.2% |
| W | 763 | 94.9% | 94.6% |
| X | 733 | 84.0% | 86.9% |
| Y | 629 | 93.9% | 88.7% |

Most frequent confusions (true -> predicted: count):

- R -> U: 223
- D -> P: 167
- P -> D: 157
- C -> O: 140
- V -> U: 115
- U -> R: 97
- C -> E: 62
- O -> C: 55
- A -> T: 54
- X -> D: 48

Reading this: with a single signer the result only shows how repeatable that person is. Quote results for new people only when the method is leave-one-signer-out with several signers.
