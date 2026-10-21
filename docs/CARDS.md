# Picture cards: detection and tracking

A person holds a printed card in front of the camera; holding it still for 1 s adds its word to the message. Cards are found by a **YOLOv8-style detector** run in the browser with ONNX Runtime Web, followed by a **SORT** tracker and a **hold-to-add** rule. **No detector has been trained yet**, so on a real camera the screen says so and the cards in the list on screen 10 can still be pointed at. The detector is for the team to train (procedure below).

## Pipeline (screen 10)
    camera video --(every 100 ms, own timer)--> letterbox 640x640 --> ONNX model --> decodeYolo + NMS --> boxes
    boxes --> SortTracker (Kalman + Hungarian) --> tracks with a class vote --> CardController --> CARD_CANDIDATE / CARD_ADDED / CARD_LOST --> state machine

| Piece | File | Notes |
| ----- | ---- | ----- |
| Card list and detector classes | `src/data/contexts.json` | one file for the app and Python; **the order of `classes` is the class id** |
| Decode, letterbox, NMS | `src/cards/yolo.ts` | YOLOv8 output `[1, 4 + classes, N]` (or transposed). Tested with made-up tensors |
| Tracker | `src/cards/sort.ts` | SORT: constant-velocity Kalman filter + Hungarian matching on overlap, class vote over the last 8 updates, speed of the box |
| Hold-to-add | `src/cards/controller.ts` | constants `CARD` (below) |
| Model loading | `src/cards/onnx.ts` | `models/cards.onnx` + `models/cards.json`; wasm-only ONNX Runtime, 1 thread (no special server headers) |
| Live box / ring / notice | `LiveCardOverlay`, `CardNotice` | the design's drawn card is shown only without a camera |

`CARD` constants (heuristics until real data exists): a track needs mean score ≥ 0.5 and ≥ 60% of the class votes; a candidate shows after 300 ms; the card is added after being held 1000 ms moving slower than 0.35 picture heights per second (moving it restarts the hold); it is dropped 500 ms after it disappears; the same card can be added again only after it has been out of view 600 ms. One card at a time (the largest of this place's pack); a card from another place is explained on screen, not added.

**Hand lost vs. cards:** a hand holding a card may not be detected by the hand model. On screen 10 a card in view counts as presence: the "hand lost" notice does not appear while a card is seen, and closes by itself when one appears.

## Printing the cards
Open `/?cards=print`, print landscape (one place per page), cut along the dashed lines. Photograph **these** cards: a detector only knows what it was shown.

## How to train and install (team)
1. Print the cards. Photograph them in many conditions: held in a hand and in two hands, near and far, tilted, different rooms, light and backgrounds, with and without other cards in view, and some pictures with **no card** (an empty label file). Several people.
2. Label every picture (YOLO format, one `.txt` per picture; any labelling tool that exports YOLO). Class ids = positions in `src/data/contexts.json`.
3. Split **by session**, not by picture: `images/train` and `images/val` from different rooms or days.
4. `python ml/cards/make_data_yaml.py --root <folder>` checks the labels and writes `cards.yaml`.
5. Train (GPU recommended): `yolo detect train data=<folder>/cards.yaml model=yolov8n.pt imgsz=640 epochs=<choose>`; read the validation numbers it prints and **keep them**.
6. `python ml/cards/export_onnx.py --weights .../best.pt --dataset <folder> --out public/models/cards.onnx [--metrics metrics.json]` writes `cards.onnx` and `cards.json`.
7. `python ml/cards/check_onnx.py public/models/cards.onnx` must say OK.
8. Commit both files (a model marked synthetic is rejected by `tests/models-guard.test.ts`). Open `/`, choose picture cards: the grey notice disappears when the model loads.
9. Tune `CARD` in `src/cards/controller.ts` with a failing test per problem; note it in `docs/KNOWN_ISSUES.md`.

If a card or place is added or renamed: edit `src/data/contexts.json`, reprint, retake photos of the new card, retrain. The app refuses a model whose classes differ.

## Verified and not verified
Verified here: decode / letterbox / NMS maths, SORT (identity kept, gaps, class vote, speed), Hungarian, hold-to-add rules (hold, no repeat while in view, passing card ignored, another place's card, largest card), the label tooling (`npm run ml:test`), and the whole path in Chromium: onnxruntime-web loading and running a **test-only ONNX file** that always answers "Doctor", through decoding, tracking and the state machine (`npm run e2e:cards`).
Not verified: **everything about real cards and a real detector**: whether a trained model finds the printed cards, its accuracy, its speed in the browser, whether the hold feels right. No such number exists.
