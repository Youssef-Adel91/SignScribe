# Performance: how to measure it (nothing is measured yet)

No frames per second, latency or speed figure for SignScribe exists in this repository, because none was measured on a real camera with real hands. This page says how to get them. **Quote a number only from a recording made as below, together with the device.**

## 1. Recording on the real camera: `/?perf=1`
1. `npm run dev` (or a build served from your machine), open `http://localhost:5173/?perf=1`, allow the camera.
2. Wait until "Camera status: running". Press **Record 30 s** and use the app normally: hold a hand in view, make the gestures, point at things.
3. Read the summary and press **Export JSON**. The file holds the environment (browser, cores, memory, screen, video size, GPU or CPU delegate) and:
   - frames, mean fps and the worst fps in any whole second;
   - gap between frames: median, 95th percentile, longest; **stalls** = gaps over 200 ms;
   - time the hand model took per frame (median, 95th, max);
   - time our own code took per frame (gestures, letters);
   - long tasks (anything blocking the page for over 50 ms) when the browser reports them;
   - the share of frames in which a hand was seen.
4. A recording made with `vision=mock` is labelled "NOT a camera" in the panel and in the file (`summary.source = "mock"`). Do not quote it.
5. Repeat in the conditions that matter: GPU and CPU delegate, a weaker laptop, the card screen (the ONNX detector runs beside the hand model), letters with a big k-NN model.

Study sessions also log `camera_fps`, `model_ms_mean` and `delegate` for every camera trial, measured on each participant's computer (`trials CSV`).

## 2. What these numbers do not tell you
- **Delay between a gesture and the screen reacting** (what the person feels). The pipeline numbers are part of it, plus the camera's own delay, the hold times (0.5 to 2 s by design) and the display. To measure it: film the screen and your hand together with a phone at 120 or 240 frames per second and count frames between the gesture and the change.
- **Accuracy.** Speed and accuracy are separate; see `docs/PHASE2_CHECKLIST.md` and `docs/MODEL_HANDOFF.md`.

## 3. Cost of our own code: `npm run bench`
Runs the gesture controller, the k-NN, the letter controller and the card tracker on synthetic frames and prints time per call **on the machine that runs it**, without the camera or the hand model. It answers "is our logic cheap?", not "how does the app perform for a user". The k-NN time grows with the number of stored samples: run it after training a model, and lower `--max-per-class` in `ml/train_knn.py` if it is too slow.

## 4. Size of the build
`npm run build` prints every file with its size. The two WebAssembly runtimes (hand model, ONNX) are copied by `npm run models`, are loaded only when needed, and are not in git.
