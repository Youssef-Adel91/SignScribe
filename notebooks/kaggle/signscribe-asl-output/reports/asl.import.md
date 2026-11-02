# Image import report

- command: python ml/import_images.py --images /tmp/signscribe/asl_stage --out /tmp/signscribe/asl.jsonl --overwrite --alphabet asl --dataset-name ASL Alphabet Gestures (East West University) --source asl-ewu --hand right --label-regex ^s\d+_([A-Z])_\d+\.\w+$ --person-regex ^(s\d+)_ --model /tmp/signscribe/SignScribe/public/models/hand_landmarker.task
- alphabet: asl
- dataset: ASL Alphabet Gestures (East West University)
- source: asl-ewu
- detector: mediapipe 0.10.35, model hand_landmarker.task (sha256 fbc2a30080c3c557...), min confidence 0.5
- output: /tmp/signscribe/asl.jsonl

| letter | images | imported | no hand found | unreadable |
| --- | --- | --- | --- | --- |
| A | 1500 | 402 | 1098 | 0 |
| B | 1500 | 889 | 611 | 0 |
| C | 1500 | 571 | 929 | 0 |
| D | 1500 | 819 | 681 | 0 |
| E | 1500 | 689 | 811 | 0 |
| F | 1500 | 1034 | 466 | 0 |
| G | 1500 | 771 | 729 | 0 |
| H | 1500 | 834 | 666 | 0 |
| I | 1500 | 841 | 659 | 0 |
| K | 1500 | 850 | 650 | 0 |
| L | 1500 | 839 | 661 | 0 |
| M | 1500 | 302 | 1198 | 0 |
| N | 1500 | 177 | 1323 | 0 |
| O | 1500 | 535 | 965 | 0 |
| P | 1500 | 447 | 1053 | 0 |
| Q | 1500 | 84 | 1416 | 0 |
| R | 1500 | 590 | 910 | 0 |
| S | 1500 | 203 | 1297 | 0 |
| T | 1500 | 372 | 1128 | 0 |
| U | 1500 | 664 | 836 | 0 |
| V | 1500 | 601 | 899 | 0 |
| W | 1500 | 763 | 737 | 0 |
| X | 1500 | 733 | 767 | 0 |
| Y | 1500 | 629 | 871 | 0 |
| J | 0 | 0 | 0 | 0 |
| Z | 0 | 0 | 0 | 0 |

**Total: 36000 images, 14639 imported, 21361 had no hand (59.3%), 0 unreadable.**

Letters with nothing imported: J Z
Persons found: 3, of which under 18: 0 (a count only; evaluation never shows a result for any of them)
