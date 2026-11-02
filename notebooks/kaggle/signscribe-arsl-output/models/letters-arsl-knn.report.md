# Static letters: k-NN evaluation

- dataset sha256: `4d34fa3f793710f913ce10a006b74473764e16702ac7afefdb05d301c6c49e11`
- takes: 13662, signers: 50, sessions: 50
- evaluation method: **leave-one-person-out** (50 held-out groups)
- samples evaluated: 13662
- k: 5
- augmentation (training side only): rotate+scale+mirror x2 copies per frame

**Accuracy on held-out groups (leave-one-person-out): 91.1%**

| letter | support | precision | recall |
| ------ | ------- | --------- | ------ |
| ain | 416 | 87.8% | 91.3% |
| al | 439 | 96.0% | 98.2% |
| aleff | 430 | 91.2% | 93.5% |
| bb | 425 | 94.5% | 92.7% |
| dal | 388 | 87.4% | 87.4% |
| dha | 429 | 92.2% | 96.5% |
| dhad | 426 | 95.0% | 92.7% |
| fa | 431 | 85.1% | 86.1% |
| gaaf | 404 | 85.0% | 84.2% |
| ghain | 436 | 89.7% | 93.8% |
| ha | 396 | 85.2% | 88.4% |
| haa | 396 | 80.7% | 86.4% |
| jeem | 418 | 91.3% | 90.7% |
| kaaf | 443 | 95.4% | 88.9% |
| khaa | 420 | 90.7% | 86.0% |
| la | 427 | 98.3% | 97.4% |
| laam | 430 | 90.3% | 90.5% |
| meem | 435 | 94.6% | 92.4% |
| nun | 414 | 88.2% | 88.2% |
| ra | 423 | 88.7% | 88.9% |
| saad | 442 | 91.3% | 94.6% |
| seen | 450 | 88.2% | 98.2% |
| sheen | 449 | 99.8% | 96.0% |
| ta | 428 | 90.4% | 94.9% |
| taa | 443 | 93.3% | 88.0% |
| thaa | 438 | 98.1% | 96.1% |
| thal | 448 | 85.8% | 87.7% |
| toot | 408 | 93.5% | 87.7% |
| waw | 410 | 92.6% | 94.6% |
| ya | 439 | 91.9% | 90.9% |
| yaa | 449 | 97.5% | 95.1% |
| zay | 432 | 84.5% | 74.3% |

Most frequent confusions (true -> predicted: count):

- zay -> thal: 57
- kaaf -> seen: 45
- khaa -> haa: 44
- thal -> zay: 38
- haa -> khaa: 30
- taa -> dha: 30
- gaaf -> ha: 27
- gaaf -> fa: 24
- jeem -> haa: 24
- zay -> ta: 22

Reading this: with a single signer the result only shows how repeatable that person is. Quote results for new people only when the method is leave-one-signer-out with several signers.
