# Definition of done

Status values: **verified here** (a test or screenshot in the cloud proves it), **needs your camera** (only checkable on a real machine with a webcam), **not met** (later phase).

## Phase II grading sheet (HCI_Project_Phase_II_Fall_2026.docx) mapped to the repository

Status: **verified here** (tests or a run in the build environment prove the logic), **needs real hardware / my camera** (only checkable on a real machine), **not met**. "FAKE" = a simulated Bluetooth device or simulated hand paths, always labelled as such on screen and in every message. Nothing below states an accuracy: none was measured on real data.

| Sheet row | Pts | Files | Tests / checks | Status |
| --- | --- | --- | --- | --- |
| Scenario | 1 | none | none | **not met**: there is no scenario document in the repository (the study tasks in `docs/STUDY.md` are not a user scenario). The team has to write it |
| PACT (People, Activities, Context, Technologies) | 1 | none | none | **not met**: no PACT analysis exists in the repository |
| Survey | 1 | `src/study/` (survey, protocol, export), `docs/STUDY.md`, `ml/analysis/study_report.py` | `tests/study.test.ts`, `npm run e2e:study` | **verified here** (closed, balanced 5-point items with a neutral middle, covering satisfaction, engagement, usability and the 7 Lab 2 heuristics; export and analysis). **Not met:** no participant has answered it, and the wording needs a human review |
| Figma interface | 1 | `public/design/*.png` (13 frames), `src/screens/S01..S14`, `tools/compare/screens.mjs`; `docs/FLOW_AUDIT.md` (branch `docs/flow-audit`) lists the differences | `npm run compare`, `npm run layout`, `npm run axe`, `tests/machine.test.ts` | **verified here** with listed differences (see FLOW_AUDIT: e.g. an extra screen 14, oversized icons from two missing size tokens, hints that do nothing on screens 6, 8, 13) |
| Track the skeleton with MediaPipe and classify the movement with DollarPy | 1 | `tools/dollarpy/` (`hand_tracker.py`, `dollar_logic.py`, `record_templates.py`, `classify_live.py`, `simulate.py`); the same $P in `ml/signscribe_ml/dollar.py` and `src/recognition/dollarP.ts` | `tools/dollarpy/test_dollarpy.py` (real `dollarpy` package on generated paths; real MediaPipe on three still photographs of hands and on a blank picture), `ml/tests` (our $P equals dollarpy) | **verified here** for the logic. **Needs real hardware:** recording and live classification from a webcam. **Not met:** accuracy on real moving letters; ArSL moving letters (none decided). It tracks the hand skeleton, not the whole body |
| Use Bluetooth to capture UserID and discover | 1 | `tools/bluetooth/` (`scan.py`, `ble_logic.py`, `devices.example.json`), server `presence` message (`src/nlp/protocol.ts`, `server/presence.ts`) | `tools/bluetooth/test_ble.py`, `tests/presence.test.ts`, `npm run e2e:context` | **verified here** with fake scans and a FAKE device. **Needs real hardware:** a real adapter, real devices (phones may rotate their address; use a band, beacon or tag) |
| Socket programming between the parts of the project | 1 | `server/` (WebSocket for the app + plain TCP for Python), `tools/common/server_link.py`, `server/examples/client.py`, `src/nlp/contextFeed.ts`, `src/nlp/sentenceClient.ts` | `tests/server.test.ts`, `tests/presence.test.ts`, `tests/letter-relay.test.ts` (real TCP and WebSocket), `npm run e2e:server`, `npm run e2e:context`, `npm run demo -- --check` | **verified here**: scanner -> server -> app, dollarpy client -> server -> app, app -> server -> sentence, with limits, origin checks and no device address anywhere |
| Load different content based on context | 2 | `src/state/machine.ts` (`CONTEXT_*`), `src/nlp/ContextBridge.tsx`, `src/ui/DetectedChip.tsx`, `src/state/profiles.ts`; place packs in `src/data/contexts.json`, `src/nlp/words.ts`, `src/nlp/sentence.ts`; light/distance advice in `src/vision/context.ts` | `tests/bluetooth-context.test.ts`, `tests/context.test.ts`, `tests/dictionary.test.ts`, `npm run e2e:context` | **verified here** (place from FAKE Bluetooth loads that place's words, cards and sentence style; the person's saved settings load; visible override; nothing detected = as before). **Needs real hardware:** real Bluetooth detection, and override by pointing with a real camera |

How to demonstrate it: `tools/demo-all.md` (`npm run demo`, FAKE by default). Rows still **not met** need work by the team, not code: Scenario, PACT, the filled-in survey, the real-hardware runs.


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

## DollarPy demo (branch feat/dollarpy-demo)
| Item | Status | Evidence |
| --- | --- | --- |
| Movement cut out of a fingertip path with the web app's numbers; templates; classification with the real `dollarpy` package | verified here (generated paths) | `tools/dollarpy/test_dollarpy.py` |
| MediaPipe hand tracker (Python) returns 21 landmarks | verified here (3 still photographs of hands) and finds nothing in a blank picture | `test_real_mediapipe_tracker_...`, one manual run |
| `letter` message: strict fields, own rate limit, relayed to apps, not stored or logged | verified here (real TCP + WebSocket) | `tests/letter-relay.test.ts` |
| App offers the letter and adds it by point-and-hold; labelled simulated; ignored outside the alphabet | verified here (synthetic hand) | `tests/letter-relay.test.ts`, `npm run e2e:context` |
| Recording and live classification from a webcam | needs real hardware | `record_templates.py`, `classify_live.py` |
| Recognition accuracy on real moving letters | not met | no recorded templates; `--simulate` scores mean nothing |
| Moving letters of ArSL | not met | `arsl.json` lists none; the team must decide them |
| FAKE device for demos, labelled in the banner and in every message | verified here | `scan.py --fake` |

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
