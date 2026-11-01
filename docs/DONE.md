# Definition of done

Status values: **verified here** (a test or screenshot in the cloud proves it), **needs your camera** (only checkable on a real machine with a webcam), **not met** (later phase).

## Phase II grading sheet (HCI_Project_Phase_II_Fall_2026.docx) mapped to the repository

Status: **verified here** (tests or a run in the build environment prove the logic), **needs real hardware / my camera** (only checkable on a real machine), **not met**. "FAKE" = a simulated Bluetooth device or simulated hand paths, always labelled as such on screen and in every message. Nothing below states an accuracy: none was measured on real data.

| Sheet row | Pts | Files | Tests / checks | Status |
| --- | --- | --- | --- | --- |
| Scenario | 1 | in the Phase I PDF (**not in this repo**; to keep it here put it in `docs/phase1/`) | none | **covered by the Phase I PDF**, not by anything in this repository, so it is not checked here |
| PACT (People, Activities, Context, Technologies) | 1 | in the Phase I PDF (**not in this repo**; to keep it here put it in `docs/phase1/`) | none | **covered by the Phase I PDF**, not by anything in this repository, so it is not checked here |
| Survey | 1 | `src/study/` (survey, protocol, export), `docs/STUDY.md`, `ml/analysis/study_report.py` | `tests/study.test.ts`, `npm run e2e:study` | **verified here** (closed, balanced 5-point items with a neutral middle, covering satisfaction, engagement, usability and the 7 Lab 2 heuristics; export and analysis). **Not met:** no participant has answered it, and the wording needs a human review |
| Figma interface | 1 | `public/design/*.png` (13 frames), `src/screens/S01..S14`, `tools/compare/screens.mjs`; `docs/FLOW_AUDIT.md` (branch `docs/flow-audit`) lists the differences | `npm run compare`, `npm run layout`, `npm run axe`, `tests/machine.test.ts` | **verified here** with listed differences (see FLOW_AUDIT: e.g. an extra screen 14, oversized icons from two missing size tokens, hints that do nothing on screens 6, 8, 13) |
| Track the skeleton with MediaPipe and classify the movement with DollarPy | 1 | `tools/dollarpy/` (`hand_tracker.py`, `dollar_logic.py`, `record_templates.py`, `classify_live.py`, `simulate.py`); the same $P in `ml/signscribe_ml/dollar.py` and `src/recognition/dollarP.ts` | `tools/dollarpy/test_dollarpy.py` (real `dollarpy` package on generated paths; real MediaPipe on three still photographs of hands and on a blank picture), `ml/tests` (our $P equals dollarpy) | **verified here** for the logic. **Needs real hardware:** recording and live classification from a webcam. **Not met:** accuracy on real moving letters; ArSL moving letters (none decided). It tracks the hand skeleton and, by default, the shoulders, elbows and wrists (`--no-pose` for the fingertip alone) |
| Use Bluetooth to capture UserID and discover | 1 | `tools/bluetooth/` (`scan.py`, `ble_logic.py`, `devices.example.json`), server `presence` message (`src/nlp/protocol.ts`, `server/presence.ts`) | `tools/bluetooth/test_ble.py`, `tests/presence.test.ts`, `npm run e2e:context` | **verified here** with fake scans and a FAKE device. **Needs real hardware:** a real adapter, real devices (phones may rotate their address; use a band, beacon or tag) |
| Socket programming between the parts of the project | 1 | `server/` (WebSocket for the app + plain TCP for Python), `tools/common/server_link.py`, `server/examples/client.py`, `src/nlp/contextFeed.ts`, `src/nlp/sentenceClient.ts` | `tests/server.test.ts`, `tests/presence.test.ts`, `tests/letter-relay.test.ts` (real TCP and WebSocket), `npm run e2e:server`, `npm run e2e:context`, `npm run demo -- --check` | **verified here**: scanner -> server -> app, dollarpy client -> server -> app, app -> server -> sentence, with limits, origin checks and no device address anywhere |
| Load different content based on context | 2 | `src/state/machine.ts` (`CONTEXT_*`), `src/nlp/ContextBridge.tsx`, `src/ui/DetectedChip.tsx`, `src/state/profiles.ts`; place packs in `src/data/contexts.json`, `src/nlp/words.ts`, `src/nlp/sentence.ts`; light/distance advice in `src/vision/context.ts` | `tests/bluetooth-context.test.ts`, `tests/context.test.ts`, `tests/dictionary.test.ts`, `tests/profile-theme.test.ts`, `npm run e2e:context` | **verified here** (place from FAKE Bluetooth loads that place's words, cards and sentence style; the person's saved settings load; the person's profile sets the page colours: male = blue and green, female = pink, from screen 03 or from the device list; visible override; nothing detected = as before). **Needs real hardware:** real Bluetooth detection, and override by pointing with a real camera |

| Socket programming between the parts of the project | 1 | `server/` (WebSocket for the app + plain TCP for Python), `tools/common/server_link.py`, `server/examples/client.py`, `src/nlp/contextFeed.ts`, `src/nlp/sentenceClient.ts` | `tests/server.test.ts`, `tests/presence.test.ts`, `tests/letter-relay.test.ts` (real TCP and WebSocket), `tools/dollarpy/test_threads.py` (Lab 4 threads: camera reader + sender thread), `npm run e2e:server`, `npm run e2e:context`, `npm run demo -- --check` | **verified here**: scanner -> server -> app, dollarpy client -> server -> app, app -> server -> sentence, with limits, origin checks and no device address anywhere |
| Load different content based on context | 2 | `src/state/machine.ts` (`CONTEXT_*`), `src/nlp/ContextBridge.tsx`, `src/ui/DetectedChip.tsx`, `src/state/profiles.ts`; place packs in `src/data/contexts.json`, `src/nlp/words.ts`, `src/nlp/sentence.ts`; light/distance advice in `src/vision/context.ts` | `tests/bluetooth-context.test.ts`, `tests/context.test.ts`, `tests/dictionary.test.ts`, `npm run e2e:context` | **verified here** (place from FAKE Bluetooth loads that place's words, cards and sentence style; the person's saved settings load; visible override; nothing detected = as before). **Needs real hardware:** real Bluetooth detection, and override by pointing with a real camera |

How to demonstrate it: `tools/demo-all.md` (`npm run demo`, FAKE by default). Rows still open need work by the team, not code: the filled-in survey and the real-hardware runs. Scenario and PACT are in the Phase I PDF, which is not in this repository.


| Item                                                                       | Phase | Status                                  | Evidence                                                                                     |
| -------------------------------------------------------------------------- | ----- | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| Single state machine owns the screen; all events/transitions tested        | 1     | verified here                           | `tests/machine.test.ts` (85 tests)                                                           |
| Both overlays (hand lost, help) return to the previous state               | 1     | verified here                           | machine tests                                                                                |
| No dead end from any state                                                 | 1     | verified here                           | BFS test                                                                                     |
| Safety rule: screen 12 only after 11 + thumbs up                           | 1     | verified here                           | machine tests                                                                                |
| 13 screens are responsive components (no atomic CSS, no pixel coordinates) | 1     | verified here                           | `npm run compare` screenshots 1280x720, 1440x900, 1920x1080; no page overflow at those sizes |
| Visual match with the Figma export                                         | 1     | verified here (with listed differences) | `tools/compare/out/*/NN-*.compare.png`                                                       |
| No `<svg>` attribute errors in the browser console (icon sizes are CSS, not `width="var(...)"`) | 1 | verified here | `tests/icon.test.tsx`, `npm run e2e` (console check) |
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
| Whole flow 01 -> 12 -> 01 with no mouse and no keyboard (mouse click and keys proven to do nothing) | 2 | verified here (synthetic landmarks) | `npm run e2e` (43 checks) |
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
| No overflow at Normal and Large text on 14 screens x 3 sizes x 2 modes; the layout step (and `verify`) now FAILS on any Normal or Large overflow | 3 | verified here (Linux: Normal 0, Large 0, Extra large 20 = KNOWN_ISSUES #3) | `npm run layout` (84 combos each), `tests/layout-rules.test.ts` |
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

## Alphabet pipeline (pictures -> honest evaluation -> model; tooling only, no model, no results)
| Item | Status | Evidence |
| --- | --- | --- |
| Label set is a config file (`config/alphabets/*.json`) read by Python and the web app; no letter list in code | verified here | `ml/tests/test_alphabet_import_eval.py`, `tests/alphabet.test.ts` |
| ArSL label set | not met | `arsl.json` is an unchecked TEMPLATE; the team must confirm it against their dataset |
| `ml/import_images.py`: folder of letter sub-folders -> takes, skips pictures with no hand, per-letter counts, `person` or `source` | verified here (fake detector for the logic; real MediaPipe on a blank picture, a broken file and 3 real hand photos: finds no hand / unreadable / 21 landmarks) | `ml/tests`, one smoke run |
| Import on a real labelled alphabet dataset | not met | no dataset chosen yet |
| `ml/evaluate.py`: leave-one-person/source/signer/session-out, per-letter precision/recall, 10 worst pairs, threshold view; refuses a same-person split | verified here (generated data; a leakage test proves a held-out person never reaches training, with and without augmentation) | `ml/tests` |
| k-NN against a small MLP on identical folds | verified here (logic) | `ml/tests` |
| Augmentation (rotate, x/y scale, mirror) keeps the shape: exact distances under rotation/mirror, bounded angle and ratio, same-factor scale is a no-op, extended fingers unchanged in 300 random draws; training side only | verified here | `ml/tests` |
| Whether augmentation helps on real hands | not met | run `evaluate.py --augment-ablation` on real data |
| Letter accuracy for the whole alphabet | not met | no real run: `docs/MODEL_RESULTS.md` is empty on purpose |
| Collection mode: guided run (letter prompt, countdown, auto-advance, retry, skip, stop) and per-letter gap view | verified here (synthetic hands) | `tests/guided.test.ts`, `npm run e2e:collect` |
| Collection mode: speed and comfort of a guided run with a real person | needs my camera | `/?collect=1` |
| Letter controller shows nothing below `LETTER.minConfidence`; the two best raw guesses appear only in the dev panel | verified here | `tests/letters.test.ts` |
| Exported model JSON format unchanged | verified here | `ml/tests`, `ml/validate_model.py` |

## Bluetooth presence (branch feat/ble-presence)
| Item | Status | Evidence |
| --- | --- | --- |
| Scanner config, matching of address / name / prefix to UserID and place, smoothing, heartbeat, back-off | verified here (fake scans) | `tools/bluetooth/test_ble.py` |
| `presence` message: strict fields, validation, own rate limit, memory-only store with 15 s expiry | verified here (real TCP socket) | `tests/presence.test.ts` |
| A device address or name never reaches a log line, a message, or the server | verified here | `tools/bluetooth/test_ble.py`, `tests/presence.test.ts` |
| Bleak scan on a real adapter with real devices | needs real hardware | `python tools/bluetooth/scan.py -v` |
| Server pushes who/where to every connected app (also to a late one, and when a presence expires) | verified here (real WebSocket + TCP) | `tests/presence.test.ts` |
| App loads the detected place and the person's saved settings before the message starts; shows who/where on every screen | verified here | `tests/bluetooth-context.test.ts`, `npm run e2e:context` |
| Visible override by point-and-hold; choosing a place yourself wins; ignore restores place and settings | verified here (synthetic hand) | `tests/bluetooth-context.test.ts`, `npm run e2e:context` |
| No Bluetooth / no scanner / no server: the app behaves as before | verified here | `npm run e2e:context` |
| Override with a real camera and hand | needs my camera | screens 1-5, 14 |
| FAKE device for demos, labelled in the banner and in every message | verified here | `scan.py --fake` |

## DollarPy demo (branch feat/dollarpy-demo)
| Item | Status | Evidence |
| --- | --- | --- |
| Movement cut out of a fingertip path with the web app's numbers; templates; classification with the real `dollarpy` package | verified here (generated paths) | `tools/dollarpy/test_dollarpy.py` |
| MediaPipe hand tracker (Python) returns 21 landmarks | verified here (3 still photographs of hands) and finds nothing in a blank picture | `test_real_mediapipe_tracker_...`, one manual run |
| `letter` message: strict fields, own rate limit, relayed to apps, not stored or logged | verified here (real TCP + WebSocket) | `tests/letter-relay.test.ts` |
| App offers the letter and adds it by point-and-hold; labelled simulated; ignored outside the alphabet | verified here (synthetic hand) | `tests/letter-relay.test.ts`, `npm run e2e:context` |
| MediaPipe Pose, the twelve Lab 5 landmarks (11-20, 23, 24; x and y), one stroke each with its whole trajectory, plus the hand fingertip as one extra stroke; optional (`--no-pose`), default on; template file v2, v1 still loads | verified here (generated arm; the real pose tracker on one still photograph of a person and on a blank picture) | `tools/dollarpy/test_dollarpy.py` |
| Whether the pose improves recognition (the weighting is dollarpy's own resampling of the cloud, a guess) | not met | needs real recordings: compare `--pose` with `--no-pose` |
| Recording and live classification from a webcam | needs real hardware | `record_templates.py`, `classify_live.py` |
| Recognition accuracy on real moving letters | not met | no recorded templates; `--simulate` scores mean nothing |
| Moving letters of ArSL | not met | `arsl.json` lists no moving letters (its two dynamic classes are the dynamic controls `ctl_delete` and `ctl_cancel`); the team must decide them |

## Phase 5 (picture cards; no detector)
| Item | Phase | Status | Evidence |
| --- | --- | --- | --- |
| Card list and detector classes in one data file shared by app and Python | 5 | verified here | `tests/cards.test.ts`, `ml/tests/test_cards.py` |
| YOLO output decoding, letterbox, NMS, shape errors | 5 | verified here (made-up tensors) | `tests/cards.test.ts` |
| SORT tracker: Kalman + Hungarian, id kept, gap, class vote, speed | 5 | verified here (synthetic boxes) | `tests/cards.test.ts` |
| Hold-to-add: hold, no repeat, passing card ignored, other place's card, largest card, screen reset | 5 | verified here | `tests/cards.test.ts`, `npm run e2e:cards` |
| ONNX Runtime Web loads and runs a model in Chromium, through decode, SORT and the state machine | 5 | verified here with a TEST-ONLY model that always says "Doctor" | `npm run e2e:cards` |
| Honest notices: no detector / broken / test model / card from another place | 5 | verified here | `src/cards/CardNotice.tsx`, e2e |
| Label checker, export and ONNX checker scripts | 5 | verified here (made-up folders, fixture) | `npm run ml:test` |
| Printable card sheet `/?cards=print` | 5 | verified here (renders); printing needs my printer | `/?cards=print` |
| Card detector finds real printed cards; accuracy; speed in the browser | 5 | not met | no model, no photos. Procedure: `docs/CARDS.md` |
| Hold time / speed limits feel right with a real card | 5 | needs my camera | `CARD` in `src/cards/controller.ts` |

## Phase 6 (sentence server)
| Item | Phase | Status | Evidence |
| --- | --- | --- | --- |
| Safety rule: chosen words kept, no added facts / negations / links, length limits | 6 | verified here | `tests/validate.test.ts` |
| The offline builder obeys the rule for every pack and wording (found and fixed a dropped "Hello") | 6 | verified here | `tests/validate.test.ts` |
| Protocol parsing, size / rate limits (bad messages count), origin allow-list | 6 | verified here | `tests/server.test.ts` |
| Server over a real WebSocket and a real TCP socket (lab style, plus a Python client) | 6 | verified here | `tests/server.test.ts`, manual `server/examples/client.py` |
| Fallback to offline rules: bad / slow / failing / repeating / missing model, reason in `note`, no words in logs | 6 | verified here (fake model) | `tests/server.test.ts` |
| Anthropic request format and key handling | 6 | verified here with a fake HTTP client | `tests/server.test.ts` |
| App uses the server sentence only if it passes the rule (again in browser and machine), ignores stale / hostile / far-away servers; study mode ignores it | 6 | verified here | `tests/sentenceClient.test.ts`, `npm run e2e:server` |
| The language model itself: sentences are good, prompt works with the live API, model name valid | 6 | not met | no API key here; try with a key |
| Latency of the real model | 6 | not met | not measured |

## Phase 7 (final study logger, accessibility audit, performance tooling)
| Item | Phase | Status | Evidence |
| --- | --- | --- | --- |
| Study: background questions and consent before the first task; session record (device, settings, build); camera speed per trial; CSV for scores, profile and session | 7 | verified here | `tests/study.test.ts`, `npm run e2e:study` |
| Study: analysis script (paired Wilcoxon exact + normal, effect size, sign test, warnings for few participants / mixed builds / headless data) | 7 | verified here (made-up exports; p-values against brute force and scipy) | `npm run ml:test` |
| Axe (WCAG 2.0/2.1 A and AA + best practices): no violation on 14 screens x 3 display settings, live mode, study pages, collection page, card sheet | 7 | verified here | `npm run axe` (62 pages / states). Found and fixed: heading order on screens 6 to 10, landmarks and hidden app under full-page forms, scrollable card sheet |
| Real screen reader (NVDA / VoiceOver) | 7 | needs my screen reader | automated rules find only part of the problems |
| Performance recording tool (`/?perf=1`): fps, worst second, stalls, model time, own-code time, long tasks, environment; mock recordings labelled | 7 | verified here (summary maths) | `tests/perf.test.ts` |
| fps, latency, model time of the real pipeline | 7 | **needs my camera** | `docs/PERF.md`. No such number exists yet |
| Cost of our own code per frame | 7 | measurable here, not quoted | `npm run bench` |
| One command runs every check | 7 | verified here | `npm run verify` |
| What is left and what only I can do | 7 | done | `docs/WHATS_LEFT.md` |

## Survey update (review fixes)
| Item | Phase | Status | Evidence |
| --- | --- | --- | --- |
| SUS (10 statements, published wording) scored 0-100, shown in the survey and exported in the scores CSV; two reverse-worded items flipped before averaging; identical wording for both methods | 7 | verified here (scoring against a hand-worked example; no statement names a method) | `tests/study.test.ts` |
| Analysis: SUS row, careless-answer flags (identical answers, contradicting reverse items), `--exclude-flagged` | 7 | verified here (made-up exports) | `npm run ml:test` |
| SUS results on real participants | 7 | not met | no study run yet |

## Flow-audit blockers (branch fix/flow-blockers)
| Item | Status | Evidence |
| --- | --- | --- |
| Every `var(--s-N)` used is defined (icons on 04, 05, 08 no longer fill their box; "We lost your hand" is visible) | verified here | `tests/tokens.test.ts`, `npm run compare` 04/05/08 |
| Screen 11: "Add a card" / "Spell more" by point-and-hold, words kept, back to 11 | verified here (synthetic hand) | `npm run e2e` |
| Screen 08: only "Bring your hand back" is offered; after 10 s of camera time the screen says what to check | verified here (synthetic frames) | `npm run e2e` |
| Hand-lost screen has a second way out | not met | every exit needs a hand (gesture-only app) |

## ArSL controls: static and dynamic (branch feat/arsl-controls)
| Item | Status | Evidence |
| --- | --- | --- |
| `arsl.json` controls space, done (static, classified like letters) and delete, cancel (dynamic, $1 on the index-fingertip path); parsed the same by the app and the Python tools; the split is a first decision recorded in `todo` | verified here | `tests/arsl-control-classes.test.ts`, `ml/tests/test_controls.py` |
| A control class acts like the same hand gesture (SPACE, YES, DELETE, NO) from any spelling state, with its own shorter hold for static ones and a $1 score setting for dynamic ones | verified here (synthetic hands, fake recognisers) | `tests/arsl-control-classes.test.ts` |
| Collection page: Controls section (four buttons, static / dynamic), every take carries `person` = the signer code; takes stay out of git | verified here | `npm run e2e:collect`, `tests/arsl-control-classes.test.ts` |
| `evaluate.py`: leave-one-person-out on controls together with the letters, confusion with letters and with `none`, false triggers from `none` takes (static: model frames; dynamic: $1 with the app's gate), counts only | verified here (generated recordings) | `ml/tests/test_controls.py` |
| Overlay and log show, for every frame, who decided (old rule gesture / control class / $1 template / letter model), what and the score | verified here | `tests/arsl-control-classes.test.ts` |
| Priority kept: a rule gesture stops model controls and letters, a command frame sends no model event; old gesture hold times unchanged (asserted) | verified here | `tests/arsl-control-classes.test.ts` |
| Whether static / dynamic controls work better than the old gestures for ArSL signers; which shapes and strokes; recordings; the right thresholds | not met | needs recordings from several people and a camera: `docs/CONTROLS.md`, `docs/KNOWN_ISSUES.md` #23 |

## Letter gating after the first camera test (branch feat/letter-gating)
| Item | Status | Evidence |
| --- | --- | --- |
| Debug overlay behind `?letterdebug=1`: state, top 3 with confidence, hand speed against its limit, still counter, hold, cooldown, control gesture; editable settings; CSV log download (git-ignored) | verified here (rendered markup, log format) | `tests/letter-gating.test.ts` (1) |
| Motion gating: nothing is classified while the hand moves or before N still frames; same letter for the hold time; after a letter the hand must change / move / leave and a cooldown passes | verified here (synthetic hands) | `tests/letter-gating.test.ts` (2) |
| Command priority: a control gesture, a command sent, the pointer or a posing hand in the command zone stop letters, also for a hold-off after; one frame never sends a command and a letter | verified here | `tests/letter-gating.test.ts` (3) |
| One tone + one vibration per written letter, minimum gap, switch on screen 14 ("Read aloud" / "Sounds only" / "Silent"); the spoken guess tip at most every 2 s | verified here (fake output); not tried on a device | `tests/letter-gating.test.ts` (4) |
| `none` class: collection mode records moving / relaxed / command-zone / other takes; tools train it; a `none` answer, low confidence or small margin is shown as nothing | verified here | `tests/none-class.test.ts`, `tests/letter-gating.test.ts` (5), `ml/tests/test_none_class.py` |
| Confidence, margin, hold, speed limit, still frames, cooldown, release and command hold-off are settings per model type and alphabet, saved from the panel | verified here | `tests/letter-gating.test.ts` (6) |
| Whether any of this stops the noise with real hands; the right values; recorded `none` takes; a retrained model with `none` | not met | needs my camera and recordings: `docs/KNOWN_ISSUES.md` #20-#22 |

## ArSL stage 2: model commands, calibration, credits, helper words (branch feat/arsl-models-calibration)
| Item | Status | Evidence |
| --- | --- | --- |
| One documented command per ArSL model file (`ml/export_mlp.py` -> `letters-arsl-mlp.json`, `ml/train_knn.py` -> `letters-arsl-knn.json`) and `ml/export_arsl.py` for both: same alphabet file, same class order (checked), same seed gives the same models, synthetic refused, no data written | verified here (generated hands) | `ml/tests/test_arsl_export.py` |
| The browser loader accepts both files exactly as the exporters write them and rejects a mismatched alphabet | verified here (generated fixtures in `tests/fixtures/arsl/`, not a model) | `tests/arsl-models.test.ts` |
| `ml/calibrate.py`: precision and coverage at several thresholds, k-NN vote share and MLP softmax in separate tables, from leave-one-person-out or `--train/--test` predictions; chooses and changes no threshold; no person id in its output | verified here (generated hands) | `ml/tests/test_calibration.py` |
| The calibration numbers for the real ArSL data | not met | run `ml/calibrate.py` on your machine, quote only its report |
| `LETTER` thresholds chosen for the ArSL models | not met | needs a real model, its calibration table and a camera |
| CC BY 4.0 credit for ArSL21L (and ASLAD, test-only) in `docs/CREDITS.md` and the About text on the help screen (13) | verified here; the full dataset citations still have to be pasted (`TODO(Youssef)` in `docs/CREDITS.md`) | `tests/credits.test.ts` |
| Arabic helper-word list (written by us, `docs/ARABIC_WORDS.md`) used by the validator in the browser and on the server, and given to the language model | verified here | `tests/arabic-words.test.ts`, `tests/arsl-server.test.ts` |
| UI note that read-aloud is English only (share screen 12, voice setting 14): shown only while no Arabic voice is installed (PR #24 changed it from "always with ArSL") | verified here (rendered markup, fake voices) | `tests/arsl-screens.test.ts`, `tests/speech-voice.test.ts` |
| An Arabic dictionary / spelling help, grammar | not met | out of scope: `docs/KNOWN_ISSUES.md` #15 |
| Arabic speech: the app speaks with an installed Arabic voice (`ar-EG`, then `ar-SA`, any `ar-*`), never an English voice for Arabic text; letter names are spoken from `spoken` in `arsl.json` where confirmed; string tables per language (`src/output/strings.ts`, PR #24) | verified here (fake voices and synth) | `tests/speech-voice.test.ts`, `tests/strings.test.ts`; how it sounds and which voices a device has: needs my device, `docs/KNOWN_ISSUES.md` #17 |
| `npm run verify` starts npm through the shell on Windows only; a command that cannot start is a FAIL with the real error (and a warning at the start), never a silent 0 s | verified here for Linux and with a Windows-shaped failure (npm missing from the PATH) and a fake `win32` platform; run on a real Windows machine by Youssef on 2026-10-31 (`main` at `de273b5`, 13 of 13 steps, synthetic hands and fake devices only) | `tests/verify-run.test.ts` |
| Camera errors: `NotSupportedError` and any unknown error give a plain, specific message (not available in this browser/page; use localhost or https), one text per error situation in English and Arabic (string table). The camera e2e injects `getUserMedia` errors instead of relying on the browser's own error | verified here (Linux) for 4 injected errors; the Windows failure (Chromium throwing NotSupportedError for both cases) came from the user's machine and **has not been re-run there** | `tests/camera-errors.test.ts`, `tools/e2e/flow.mjs` |
| Bluetooth e2e: the scanner flushes its banner, runs with `PYTHONUNBUFFERED=1`, the launcher waits for the banner (10 s) and uses the shared Python resolver (`tools/lib/python.mjs`); on a `remote-letter` timeout it prints the WebSocket frames, the Python client output and the server output | verified here (Linux, all checks pass); verified on Windows on 2026-10-31 (`main` at `de273b5`, `npm run verify` 13 of 13, reported by Youssef) | `tools/bluetooth/test_ble.py`, `tests/spawn-tool.test.ts` |
| Letters from the dollarpy client: the server logs counts (`letter #N received; sent to K WebSocket clients`, never the letter), `/health` shows `webSocketClients`, a letter that reached no app is held 5 s for the next app that connects (once; a delivered letter is never replayed), and the e2e starts the client only after the app's WebSocket is counted | verified here (Linux: 6 new server tests, `e2e:context` passes); **Windows failure KNOWN_ISSUES #24: fixed, `e2e:context` passes on Windows (`main` at `de273b5`, reported by Youssef); the cause was never proven** | `tests/letter-relay.test.ts`, `tools/e2e/context.mjs` |
| `public/models/*-knn.json` git-ignored (a k-NN file stores real landmark samples); a pre-commit check (`npm run hooks:install`) and a test refuse a staged `*-knn.json` or any file under `ml/data/` / `datasets/` | verified here (scratch repository, real hook) | `tests/forbidden-files.test.ts` |
| Stricter k-NN guard (applies to integration/phase2): every `*-knn.json` is refused, anywhere; the only exception is a file under `tests/fixtures/` whose JSON says `synthetic: true` and has at most 200 vectors; same rule in the pre-commit hook, `npm run check:staged` and the test that fails when a forbidden file is tracked; judged by the content in the git index | verified here (scratch repository, real hook, the four cases: allowed fixture, fixture without the flag, public/models, more than 200 vectors) | `tests/forbidden-files.test.ts` |
| `ml/calibrate.py`: `--augment` defaults to the shipped `all`, names optional, hint when `--alphabet` is missing, rows that repeat the row above are marked | verified here | `ml/tests/test_calibration.py` |
| Arabic helper list has no duplicate | verified here | `tests/arabic-words.test.ts` |

## ArSL in the web app, stage 1 (branch feat/arsl-app)
| Item | Status | Evidence |
| --- | --- | --- |
| Spelling screens and the letter buffer map a class id to its glyph with the alphabet file (`config/alphabets/*.json`), not the first character | verified here | `tests/arsl-app.test.ts` |
| A glyph that is not confirmed (`display` null, or the class is in a `todo` question) is shown as the Latin class id between marks, dashed, and flagged unconfirmed; no Arabic letter is guessed | verified here | `tests/arsl-app.test.ts` |
| Alphabet selector (English = ASL, Arabic = ArSL) on screen 03, saved with the other settings; the loader reads `letters-arsl-{mlp,knn}.json` for ArSL and the old names for ASL; a model with another alphabet's letters is refused | verified here (fake files) | `tests/arsl-app.test.ts`, `npm run e2e` |
| The study CSV names the alphabet (`alphabet` column in trials, camera trials only, and in the session file) | verified here | `tests/arsl-app.test.ts` |
| Sentence line right to left (`dir="rtl"`, `lang="ar"`) with ArSL; the rest of the screen stays left to right | verified here (rendered markup); not looked at in a browser by me | `tests/arsl-app.test.ts`, `tests/arsl-screens.test.ts` |
| Space / Delete / Cancel / Done classes only when the alphabet file lists them under `controls` (ASL lists none; ArSL lists four since feat/arsl-controls; there are no control recordings and no model with these classes yet) | verified here (the parsing and the acting, with synthetic hands); the controls themselves not met | `tests/arsl-controls.test.ts`, `tests/arsl-app.test.ts` |
| Sentence server with ArSL: English-only checks skipped, length / words / sentences / links / characters / chosen words / rate limit kept; browser checks again | verified here (fake model) | `tests/arsl-server.test.ts`, `tests/arsl-app.test.ts`; limits of this: `docs/KNOWN_ISSUES.md` #15 |
| An ArSL model, its accuracy, the `LETTER` thresholds for it, the Arabic word list, the Arabic read-aloud voice, the layout of Arabic text on every screen size | not met | no model in `public/models/`; `docs/KNOWN_ISSUES.md` #16-#19 |

## Evaluation guards, neural-network browser model (branch feat/mlp-and-eval-guards)
| Item | Status | Evidence |
| --- | --- | --- |
| Leave-one-source/session-out refused when a held-out group has classes the training side lacks; `--shared-classes` restricts and says so | verified here (generated groups) | `ml/tests/test_eval_guards.py` |
| `ml/results_md.py` removes / lists sections of `docs/MODEL_RESULTS.md`; the repo copy has no results (numbers live in the files you ran on your machine) | verified here | `ml/tests/test_eval_guards.py` |
| `--train A --test B`: accuracy on separate recordings, never trained on (swapped-label canary gives 0%) | verified here (generated takes) | `ml/tests/test_eval_guards.py` |
| `--strip-class-suffix` imports ASLAD `haa+`-style classes as the base class, off by default | verified here | `ml/tests/test_arsl_datasets.py` |
| `letters-mlp.json`: TypeScript forward pass equals the Python one on the same inputs; broken/missing falls back to k-NN | verified here (golden file, fake fetch) | `tests/mlp.test.ts`, `ml/tests/test_mlp_model.py` |
| `ml/export_mlp.py` trains on all takes, no accuracy in its report | verified here (generated takes) | `ml/tests/test_mlp_model.py` |
| Accuracy / speed of the network in the browser; `LETTER` thresholds for softmax confidence | needs my camera | thresholds were set for k-NN and not retuned |
| `pytest` pinned `>=8,<9` in `ml/requirements.txt` | verified here | file |

## ArSL datasets (branch feat/arsl-datasets)
| Item | Status | Evidence |
| --- | --- | --- |
| `import_images.py` reads a flat folder (`--label-regex`, `--person-regex`, `--age-regex`) without moving files; persons under 18 are marked, the age is not stored | verified here (generated file names like `1001_46_F_ain_0.jpg`) | `ml/tests/test_arsl_datasets.py` |
| `import_landmarks_csv.py`: layout chosen by you and measured, class from a file-name column / a class column / a numeric column with names, `--source` tag and never a person, classes outside the alphabet skipped and counted | verified here (generated CSV in the described shape) | `ml/tests/test_arsl_datasets.py` |
| The importer handles ArSL_dataset.csv (`;`, header `Sign;x0;y0;...`, 90 columns, 42 xy coordinates after `Sign`) and the ASLAD-96K CSV (no real header, 63 interleaved xyz, 26 angles, number, image name) exactly as described; `--delimiter`, `--skip-rows`, `--header no`, columns by index, `--decimal-comma` | verified here (generated files of those shapes) | `ml/tests/test_arsl_datasets.py` |
| ArSL_dataset class names mapped to the ArSL21L ids where the Arabic letter is certain from the name (21 of 31); the uncertain ones are in `todo`, and Space / Delete / Finish are skipped with their row counts reported | verified here | `ml/tests/test_arsl_datasets.py` |
| The real files' coordinate frame, picture size and layout check on the real rows | needs my data | the importer prints what it measured and assumed |
| `arsl.json`: the 32 ArSL21L class names as ids, aliases, `reviewed: false`, the ambiguous Arabic mappings listed as TODO and not guessed | verified here (it loads and resolves) | `ml/tests/test_arsl_datasets.py` |
| Arabic letters for ta/taa/toot, ha/haa, ya/yaa (and dha/dhad, al/la) | not met | the team decides: `todo` in `config/alphabets/arsl.json` |
| Evaluation by person for ArSL21L; persons under 18 only as a count, no per-person result or id in any report | verified here (generated persons) | `ml/tests/test_arsl_datasets.py` |
| Accuracy on ArSL21L / ASLAD / ArSL_dataset.csv | not met | run `ml/evaluate.py` on your machine; `docs/MODEL_RESULTS.md` is filled only by it |
| ArSL in the web app (labels that are names, Arabic display, word list, right to left) | not met | the spelling screens write the first character of a label |

## Profile colours: different content for a different user profile (branch feat/profile-theme)
Added to the Phase II criteria by the team: "provide different content according to the user profile (male: blue and green pages, female: pink pages)".

| Item | Status | Evidence |
| --- | --- | --- |
| Screen 03 asks a third question, "Your profile (sets the page colours)": Male / Female / Not set, by point-and-hold like the other two; the pages change at once | verified here (synthetic events) | `tests/profile-theme.test.ts`, screenshots in the PR |
| `Settings.gender` (`unset` default) is saved with the other settings and in a Bluetooth person's profile; an unknown stored value falls back to "not set" | verified here | `tests/profile-theme.test.ts`, `tests/settings.test.ts`, `tests/profile-persist.test.ts` |
| Page colours: `data-theme` on `<html>` (`standard` / `blue` / `pink`) swaps the page background and the accent family in `tokens.css`; high contrast always wins | verified here | `tests/contrast.test.ts` (every accent text >= 4.5:1 on white, on the page and on its tint; white on the accent; body text on the tinted page) |
| Bluetooth: `"gender"` on a device with a userId in `devices.json` (or `--fake sara:Clinic:female`) is sent with the presence; the server checks it (male, female or nothing, only with a user) and pushes it; the app uses it for a person seen for the first time, a saved profile wins, "ignore" puts the colours back, nothing changes once the message has started | verified here (FAKE device, real TCP/WebSocket in the tests) | `tools/bluetooth/test_ble.py` (5 new), `tests/profile-theme.test.ts`, `tests/presence.test.ts` |
| Layout: Normal and Large text still never scroll; Extra large stays at the known 20 (KNOWN_ISSUES #3) | verified here | `npm run layout` (84 screens per size: normal 0, large 0, xlarge 20) |
| Figma: screen 03 and screen 12 in all three profiles, drawn from the running app, plus the colour variables | done in a separate file (the team file is view-only for this account): https://www.figma.com/design/oBk8Xo9wJL2Uj9dyOUQd0h ; `tools/figma/theme-recolour.js` makes male and female copies of the 13 original frames once someone with edit access runs it | |
| Real camera, real Bluetooth device | needs my camera / needs real hardware | |

## Lab 4 threads (branch feat/lab4-threads)
| Item | Status | Evidence |
| --- | --- | --- |
| The live dollarpy client reads the camera on its own thread and keeps only the newest picture (lock + condition); skipped pictures are counted | verified here (fake camera) | `tools/dollarpy/test_threads.py` |
| Recognised letters are sent by a worker thread from a bounded queue (producer/consumer), in order; the camera loop never waits for the network; a full queue drops and counts the newest; errors are reported on the worker | verified here (fake link and a real TCP socket) | `tools/dollarpy/test_threads.py` |
| With a real webcam | needs my camera | |

