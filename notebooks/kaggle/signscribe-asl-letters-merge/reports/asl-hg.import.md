# Image import report

- command: python ml/import_images.py --images /tmp/signscribe/hg_stage --out /tmp/signscribe/asl-hg.jsonl --overwrite --alphabet asl --dataset-name ASL-HG American Sign Language Hand Gesture Image Dataset --source asl-hg --hand right --label-regex ^s\d+_([A-Z])_\d+\.\w+$ --person-regex ^(s\d+)_ --model /tmp/signscribe/SignScribe/public/models/hand_landmarker.task
- alphabet: asl
- dataset: ASL-HG American Sign Language Hand Gesture Image Dataset
- source: asl-hg
- detector: mediapipe 0.10.35, model hand_landmarker.task (sha256 fbc2a30080c3c557...), min confidence 0.5
- output: /tmp/signscribe/asl-hg.jsonl

| letter | images | imported | no hand found | unreadable |
| --- | --- | --- | --- | --- |
| A | 1000 | 1000 | 0 | 0 |
| B | 1000 | 1000 | 0 | 0 |
| C | 1000 | 1000 | 0 | 0 |
| D | 1000 | 1000 | 0 | 0 |
| E | 1000 | 1000 | 0 | 0 |
| F | 1000 | 1000 | 0 | 0 |
| G | 1000 | 1000 | 0 | 0 |
| H | 1000 | 982 | 18 | 0 |
| I | 1000 | 1000 | 0 | 0 |
| K | 1000 | 1000 | 0 | 0 |
| L | 1000 | 1000 | 0 | 0 |
| M | 1000 | 1000 | 0 | 0 |
| N | 1000 | 1000 | 0 | 0 |
| O | 1000 | 1000 | 0 | 0 |
| P | 1000 | 1000 | 0 | 0 |
| Q | 1000 | 1000 | 0 | 0 |
| R | 1000 | 998 | 2 | 0 |
| S | 1000 | 1000 | 0 | 0 |
| T | 1000 | 1000 | 0 | 0 |
| U | 1000 | 1000 | 0 | 0 |
| V | 1000 | 1000 | 0 | 0 |
| W | 1000 | 1000 | 0 | 0 |
| X | 1000 | 1000 | 0 | 0 |
| Y | 1000 | 1000 | 0 | 0 |
| J | 0 | 0 | 0 | 0 |
| Z | 0 | 0 | 0 | 0 |

**Total: 24000 images, 23980 imported, 20 had no hand (0.1%), 0 unreadable.**

Letters with nothing imported: J Z
Persons found: 10, of which under 18: 0 (a count only; evaluation never shows a result for any of them)
