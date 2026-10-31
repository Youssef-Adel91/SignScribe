# SignScribe

A camera-controlled interface that turns hand signs into written sentences. No keyboard, mouse or touch
once it is running: you raise a hand to start, point and hold to choose, and use thumbs, a fist and an
open palm for yes / no / delete / space.

Status: all 7 phases are built: camera and gestures, comfort settings and speech, a comparison study (camera vs keyboard and mouse), letter and picture-card tooling, a sentence server, an accessibility audit and performance tools. **Not done yet:** trained letter and card models, a test on a real camera, a study with people, a try with the live language model. See `docs/WHATS_LEFT.md`, `PLAN.md`, and `docs/DONE.md` for what is proven and what still needs a real camera.

## Run it

    npm ci
    npm run models     # once, needs internet: copies the MediaPipe and ONNX Runtime wasm and downloads the hand model (about 8 MB)
    npm run dev        # http://localhost:5173  (allow the camera when the browser asks)

Without `npm run models` the app still starts and tells you "Hand model not found". Use Chrome or Edge on a laptop
with a webcam. `localhost` counts as a secure origin, so no https is needed for development.

## Sentence server (optional)

    npm run server     # see server/README.md; then open /?server=ws://localhost:8787

Without it the app writes sentences with simple offline rules. With it, a language model suggests a nicer one that must pass a safety rule (only your words plus helper words).

## Developer switches (all need `?dev=1`; without it the app takes only camera input)

| URL                     | What it does                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| `/?dev=1`               | real camera + two panels: the **Dev simulator** (jump to any screen, send gestures) and **Vision debug** (fps, inference ms, gesture + confidence, pointer, dwell, command progress) |
| `/?dev=1#7`             | jump to screen 7                                                                                   |
| `/?dev=1&vision=off`    | no camera at all (layout work, screenshots)                                                        |
| `/?study=1`             | comparison study console (facilitator): camera vs keyboard + mouse, surveys, CSV export. See `docs/STUDY.md` |
| `/?collect=1`           | data collection for the letter model (researcher tool): guided run (5 takes per letter by default, automatic), per-letter gaps. See `docs/MODEL_HANDOFF.md` |
| `/?woz=1`               | Wizard of Oz: a facilitator types the letters (no model needed) |
| `/?perf=1`              | record 30 s of fps / model time / stalls on the real camera (`docs/PERF.md`) |
| `/?server=ws://localhost:8787` | use the sentence server (localhost only) |
| `/?cards=print`         | printable sheet of the picture cards |
| `/?dev=1&vision=mock`   | no camera; `window.__signscribe.play(hands, ms)` feeds synthetic landmarks (used by `npm run e2e`) |

## Checks

    npm run verify     # runs every check below and prints one table (needs `npm run models` once)

    npm run check      # typecheck, lint, unit tests, production build
    npm run e2e        # needs a build: whole flow driven by synthetic hands, no mouse or keyboard; camera error messages
    npm run layout     # needs a build: no scrolling or overflow on any screen at 1280x720, 1440x900, 1920x1080 (reports Normal, Large and Extra large text)
    npm run axe        # needs a build: axe-core (WCAG A / AA) on 62 pages and states
    npm run bench      # CPU time of our own code per frame (no camera)
    npm run e2e:server # needs a build: the app with a real sentence server, a dead one and a hostile one
    npm run e2e:cards  # needs `npm run models` and a build: card path incl. ONNX Runtime Web with a test-only model
    npm run e2e:collect # needs a build: collection mode and Wizard of Oz with synthetic hands
    npm run ml:test    # Python: dataset, trainers, $P vs dollarpy (needs ml/requirements.txt)
    npm run e2e:study  # needs a build: a whole study session in the browser, then the CSV is checked
    npm run compare    # needs a build: each screen next to its Figma export (tools/compare/out/)
    npm run demo         # everything for the Phase II demo in FAKE mode (--real for hardware, --check to test it): tools/demo-all.md
    npm run e2e:context  # needs a build; fake Bluetooth scanner -> server -> app in a browser (PYTHON=… if python3 is not the one to use)

## Layout of the code

    src/state/     XState v5 machine: the only thing that decides which screen is shown
    src/vision/    camera, MediaPipe, landmark features, gestures, pointer, dwell, zones, controller
    src/screens/   the 14 screens (S01 ... S13 from Figma, S14 comfort settings), driven by the machine
    src/ui/        shared components (HandGlyph, HoldRing, HintBar, CommandZone, CameraView ...)
    src/recognition/ letters: k-NN, $P, model loader, hold logic    src/collect/  data collection mode
    ml/            Python training tools (k-NN, $P), tests
    src/cards/     picture cards: YOLO decode, SORT tracker, hold-to-add, ONNX loader
    src/data/      contexts.json (card packs + detector classes)
    server/        sentence server (Node, WebSocket + TCP), see server/README.md
    src/nlp/       word lists, safety rule, protocol, sentence client, edit distance, offline sentence builder
    src/perf/      performance recording (?perf=1)
    src/dev/       developer panels, mounted only with ?dev=1
    tests/         unit tests (machine, gestures, controller, dwell, pointer, contrast, dictionary ...)
    tools/         models download, screenshot compare, e2e and layout checks; tools/bluetooth (BLE presence scanner), tools/dollarpy (moving letters), tools/common (socket client)
    docs/          DONE.md (evidence), KNOWN_ISSUES.md, PHASE3.md, STUDY.md, PHASE4.md, DATASET.md, MODEL_FORMAT.md, MODEL_HANDOFF.md, MODEL_RESULTS.md (only numbers written by ml/evaluate.py), CARDS.md, PERF.md, WHATS_LEFT.md, A11Y.md, PHASE2.md (how the gesture layer works), PHASE2_CHECKLIST.md (what to measure on your camera)
