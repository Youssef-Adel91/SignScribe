# SignScribe

A camera-controlled interface that turns hand signs into written sentences. No keyboard, mouse or touch
once it is running: you raise a hand to start, point and hold to choose, and use thumbs, a fist and an
open palm for yes / no / delete / space.

Status: Phase 2 of 7 (see `CLAUDE.md` for the working rules; camera, hand tracking, gestures, pointer, dwell). Letter recognition and picture-card
detection are NOT built yet. See `PLAN.md` for the phases and `docs/DONE.md` for what is proven and what still
needs a real camera.

## Run it

    npm ci
    npm run models     # once, needs internet: copies the MediaPipe runtime and downloads the hand model (about 8 MB)
    npm run dev        # http://localhost:5173  (allow the camera when the browser asks)

Without `npm run models` the app still starts and tells you "Hand model not found". Use Chrome or Edge on a laptop
with a webcam. `localhost` counts as a secure origin, so no https is needed for development.

## Developer switches (all need `?dev=1`; without it the app takes only camera input)

| URL                     | What it does                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| `/?dev=1`               | real camera + two panels: the **Dev simulator** (jump to any screen, send gestures) and **Vision debug** (fps, inference ms, gesture + confidence, pointer, dwell, command progress) |
| `/?dev=1#7`             | jump to screen 7                                                                                   |
| `/?dev=1&vision=off`    | no camera at all (layout work, screenshots)                                                        |
| `/?dev=1&vision=mock`   | no camera; `window.__signscribe.play(hands, ms)` feeds synthetic landmarks (used by `npm run e2e`) |

## Checks

    npm run check      # typecheck, lint, unit tests, production build
    npm run e2e        # needs a build: whole flow driven by synthetic hands, no mouse or keyboard; camera error messages
    npm run layout     # needs a build: no scrolling or overflow on any screen at 1280x720, 1440x900, 1920x1080
    npm run compare    # needs a build: each screen next to its Figma export (tools/compare/out/)

## Layout of the code

    src/state/     XState v5 machine: the only thing that decides which screen is shown
    src/vision/    camera, MediaPipe, landmark features, gestures, pointer, dwell, zones, controller
    src/screens/   the 13 screens (S01 ... S13), driven by the machine
    src/ui/        shared components (HandGlyph, HoldRing, HintBar, CommandZone, CameraView ...)
    src/nlp/       word lists, edit distance, offline sentence builder
    src/dev/       developer panels, mounted only with ?dev=1
    tests/         unit tests (machine, gestures, controller, dwell, pointer, contrast, dictionary ...)
    tools/         models download, screenshot compare, e2e and layout checks
    docs/          DONE.md (evidence), A11Y.md, PHASE2.md (how the gesture layer works), PHASE2_CHECKLIST.md (what to measure on your camera)
