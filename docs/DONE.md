# Definition of done

Status values: **verified here** (a test or screenshot in the cloud proves it), **needs your camera** (only checkable on a real machine with a webcam), **not met** (later phase).

| Item                                                                       | Phase | Status                                  | Evidence                                                                                     |
| -------------------------------------------------------------------------- | ----- | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| Single state machine owns the screen; all events/transitions tested        | 1     | verified here                           | `tests/machine.test.ts` (85 tests)                                                           |
| Both overlays (hand lost, help) return to the previous state               | 1     | verified here                           | machine tests                                                                                |
| No dead end from any state                                                 | 1     | verified here                           | BFS test                                                                                     |
| Safety rule: screen 12 only after 11 + thumbs up                           | 1     | verified here                           | machine tests                                                                                |
| 13 screens are responsive components (no atomic CSS, no pixel coordinates) | 1     | verified here                           | `npm run compare` screenshots 1280x720, 1440x900, 1920x1080; no page overflow at those sizes |
| Visual match with the Figma export                                         | 1     | verified here (with listed differences) | `tools/compare/out/*/NN-*.compare.png`                                                       |
| Contrast pairs match PLAN.md numbers                                       | 1     | verified here                           | `tests/contrast.test.ts`                                                                     |
| No font below 14px; labels 16px                                            | 1     | verified here                           | `tests/a11y-source.test.ts`                                                                  |
| No click/key handlers in screens or UI kit; simulator only with `?dev=1`   | 1     | verified here                           | `tests/a11y-source.test.ts`                                                                  |
| Settings persisted safely                                                  | 1     | verified here                           | `tests/settings.test.ts`                                                                     |
| Screen-reader behaviour (landmarks, aria-live)                             | 1     | needs your screen reader                | structure present; not tested with NVDA/VoiceOver                                            |
| Six gestures classified on synthetic hands (open, fist, up, down, point + none), rotation, size, position, noise | 2 | verified here (synthetic only) | `tests/gestures.test.ts` |
| Confusing pairs (fist / thumbs up, thumbs up / down, point / open, half curled) are not mixed up | 2 | verified here (synthetic only) | `tests/gestures.test.ts` |
| Debounce / hysteresis: a one-frame glitch does not change the gesture | 2 | verified here | `tests/gestures.test.ts` (GestureStabilizer) |
| Gestures recognised correctly on a real hand, real light, real distance | 2 | **needs your camera** | procedure in "Check on your own machine" (Vision debug panel shows label + confidence) |
| One-Euro pointer smooths jitter and follows fast moves | 2 | verified here (synthetic noise) | `tests/pointer.test.ts`; how it FEELS needs your camera |
| Dwell engine: fires after the hold, once, cancels, flicker grace, 96 px hit area, adaptive time | 2 | verified here | `tests/dwell.test.ts` |
| Controller: wake 2 s, help 1 s, thumbs, fist, palm, zone rules for right and left-handed signers, hand lost / back, setup checks, no double fire across screens | 2 | verified here | `tests/controller.test.ts` (38 tests) |
| Whole flow 01 -> 12 -> 01 with no mouse and no keyboard (mouse click and keys proven to do nothing) | 2 | verified here (synthetic landmarks) | `npm run e2e` (31 checks) |
| Fake camera opens, its picture is shown, a missing model gives a clear message, refused permission and no camera give clear messages | 2 | verified here | `npm run e2e` |
| MediaPipe HandLandmarker runs on a real webcam; fps and inference ms | 2 | **needs your camera** | `npm run models`, then read "camera fps" and "inference ms" in the Vision debug panel |
| Distance, light and command-zone thresholds feel right | 2 | **needs your camera** | constants in `src/vision/checks.ts`, `zones.ts`, `controller.ts` |
| No scrolling or overflow on any screen at 3 sizes, with and without live vision | 2 | verified here | `npm run layout` (78 screen/size combinations) |
| Context sensing, TTS                                                       | 3     | not met                                 |                                                                                              |
| Letter recognition                                                         | 4     | not met                                 | no model, no accuracy numbers                                                                |
| Card detection and tracking                                                | 5     | not met                                 |                                                                                              |
| Sentence server                                                            | 6     | not met                                 | sentence text is a placeholder                                                               |
| Study logger, e2e, axe, perf                                               | 7     | not met                                 |                                                                                              |

## Course requirement added (not yet built)
| Item | Phase | Status | Evidence |
| --- | --- | --- | --- |
| Two interaction techniques compared (satisfaction, engagement, usability, surveys) | study | not met | technique 2 undecided, see PLAN.md |
| Study logger: same task in both modes, time + errors + post-task survey | study (moved earlier) | not met | |
| Phase 2 gesture numbers measured on a real camera | 2 | needs my camera | `docs/PHASE2_CHECKLIST.md` |
