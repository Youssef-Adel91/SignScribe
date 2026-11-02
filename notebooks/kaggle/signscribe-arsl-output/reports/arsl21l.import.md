# Image import report

- command: python ml/import_images.py --images /tmp/signscribe/arsl21l_stage --out /tmp/signscribe/arsl21l.jsonl --overwrite --alphabet arsl --dataset-name ArSL21L --source arsl21l --label-regex _([a-z]+)_\d+\.jpg$ --person-regex ^(\d+)_ --age-regex ^\d+_(\d+)_ --model /tmp/signscribe/SignScribe/public/models/hand_landmarker.task
- alphabet: arsl
- dataset: ArSL21L
- source: arsl21l
- detector: mediapipe 0.10.35, model hand_landmarker.task (sha256 fbc2a30080c3c557...), min confidence 0.5
- output: /tmp/signscribe/arsl21l.jsonl

| letter | images | imported | no hand found | unreadable |
| --- | --- | --- | --- | --- |
| ain | 448 | 416 | 32 | 0 |
| al | 450 | 439 | 11 | 0 |
| aleff | 447 | 430 | 17 | 0 |
| bb | 447 | 425 | 22 | 0 |
| dal | 401 | 388 | 13 | 0 |
| dha | 450 | 429 | 21 | 0 |
| dhad | 439 | 426 | 13 | 0 |
| fa | 450 | 431 | 19 | 0 |
| gaaf | 444 | 404 | 40 | 0 |
| ghain | 450 | 436 | 14 | 0 |
| ha | 450 | 396 | 54 | 0 |
| haa | 449 | 396 | 53 | 0 |
| jeem | 448 | 418 | 30 | 0 |
| kaaf | 446 | 443 | 3 | 0 |
| khaa | 450 | 420 | 30 | 0 |
| la | 450 | 427 | 23 | 0 |
| laam | 440 | 430 | 10 | 0 |
| meem | 450 | 435 | 15 | 0 |
| nun | 421 | 414 | 7 | 0 |
| ra | 427 | 423 | 4 | 0 |
| saad | 450 | 442 | 8 | 0 |
| seen | 450 | 450 | 0 | 0 |
| sheen | 450 | 449 | 1 | 0 |
| ta | 450 | 428 | 22 | 0 |
| taa | 444 | 443 | 1 | 0 |
| thaa | 451 | 438 | 13 | 0 |
| thal | 450 | 448 | 2 | 0 |
| toot | 450 | 408 | 42 | 0 |
| waw | 412 | 410 | 2 | 0 |
| ya | 448 | 439 | 9 | 0 |
| yaa | 450 | 449 | 1 | 0 |
| zay | 440 | 432 | 8 | 0 |
| ctl_space | 0 | 0 | 0 | 0 |
| ctl_done | 0 | 0 | 0 | 0 |
| ctl_delete | 0 | 0 | 0 | 0 |
| ctl_cancel | 0 | 0 | 0 | 0 |

**Total: 14202 images, 13662 imported, 540 had no hand (3.8%), 0 unreadable.**

Letters with nothing imported: ctl_space ctl_done ctl_delete ctl_cancel
Persons found: 50, of which under 18: 7 (a count only; evaluation never shows a result for any of them)
