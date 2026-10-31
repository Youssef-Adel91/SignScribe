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

## Flow-audit blockers (branch fix/flow-blockers)
| Item | Status | Evidence |
| --- | --- | --- |
| Every `var(--s-N)` used is defined (icons on 04, 05, 08 no longer fill their box; "We lost your hand" is visible) | verified here | `tests/tokens.test.ts`, `npm run compare` 04/05/08 |
| Screen 11: "Add a card" / "Spell more" by point-and-hold, words kept, back to 11 | verified here (synthetic hand) | `npm run e2e` |
| Screen 08: only "Bring your hand back" is offered; after 10 s of camera time the screen says what to check | verified here (synthetic frames) | `npm run e2e` |
| Hand-lost screen has a second way out | not met | every exit needs a hand (gesture-only app) |

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

