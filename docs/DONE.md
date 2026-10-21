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

## Phase 3 (context, settings, speech)
| Item | Phase | Status | Evidence |
| --- | --- | --- | --- |
| Settings: hand, text size, contrast, hold time, voice; applied at once, saved, old value migrated | 3 | verified here | `tests/settings.test.ts`, `tests/machine.test.ts` (14 comfort), `npm run e2e` (34 checks) |
| Screen 14 sits between 03 and 04, back/forward, overlays work over it | 3 | verified here | machine tests, e2e |
| Fixed hold times pin the dwell; automatic adapts | 3 | verified here | `tests/dwell.test.ts` |
| Context sensor: debounce 3 s / 2 s, hysteresis, no hand keeps distance state | 3 | verified here (synthetic readings) | `tests/context.test.ts` |
| Light/distance tips appear at the right moment on a real camera | 3 | needs my camera | tips on 06/07/09/10 |
| Speech: off switch, no repeat, never throws | 3 | verified here (fake synth) | `tests/speech.test.ts` |
| Speech is audible and understandable in the browser | 3 | needs my camera / speakers | |
| No overflow at Normal and Large text on 14 screens x 3 sizes x 2 modes | 3 | verified here | `npm run layout` (84 combos each) |
| No overflow at Extra large text | 3 | not met | docs/KNOWN_ISSUES.md #3 |

## Study mode (comparison with keyboard and mouse)
| Item | Phase | Status | Evidence |
| --- | --- | --- | --- |
| Counterbalancing: each mode first for half, each set with each mode equally often | study | verified here | `tests/study.test.ts` |
| Both task sets can be produced by both methods (words are in the word list and on a card) | study | verified here | `tests/study.test.ts` |
| Survey follows Lab 3 (closed, balanced 5 points, neutral middle, one idea per item) and covers satisfaction, engagement, usability and the 7 Lab 2 heuristics | study | verified here (automatic checks of the rules) | `tests/study.test.ts`; wording itself needs a human review |
| Protocol (3 tasks, survey, 3 tasks, survey, comparison, done), invalid actions ignored | study | verified here | `tests/study.test.ts` |
| CSV / JSON export, summary uses only logged trials | study | verified here | `tests/study.test.ts` |
| Whole session in a browser: camera trial via gestures, give up, keyboard trial, surveys, CSV | study | verified here (synthetic hands) | `npm run e2e:study` |
| Study run with real participants | study | not met | no data collected |
| Camera method measured with letters or a real card | study | not met | needs Phase 4 / 5 |

## Phase 4 (letter recognition tooling; no model)
| Item | Phase | Status | Evidence |
| --- | --- | --- | --- |
| Dataset format documented and validated in Python and TypeScript | 4 | verified here | `docs/DATASET.md`, `ml/tests`, `tests/collect.test.ts` |
| Collection mode: countdown, quality rules, refuse bad takes with a reason, undo, export / import | 4 | verified here (synthetic hands) | `tests/collect.test.ts`, `npm run e2e:collect` |
| Collection mode works with a real camera and real hands | 4 | needs my camera | `/?collect=1` |
| Features and $P identical in Python and TypeScript; our $P equals dollarpy | 4 | verified here | golden files, `npm run ml:test`, `tests/recognition.test.ts` |
| A model written by Python gives the same letters and confidences in TypeScript | 4 | verified here | `ml/tests/golden_model.json` |
| Trainers refuse synthetic data, write a report with the method, never hand-typed numbers | 4 | verified here | `ml/tests/test_pipeline.py` |
| Letter hold / release / command-cancel / moving-sign logic | 4 | verified here (fake recognisers) | `tests/letters.test.ts` |
| Honest notice when there is no / a broken / a synthetic model | 4 | verified here | `src/recognition/LetterNotice.tsx`, models guard test |
| Letter recognition accuracy | 4 | not met | no model, no real data. Procedure: `docs/MODEL_HANDOFF.md` |
| Moving-letter (J, Z) accuracy | 4 | not met | same |
| Threshold values (`LETTER`) feel right | 4 | needs my camera | tune after a model exists |
