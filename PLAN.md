# PLAN – from click-through prototype to camera-driven app

Status: Phase 0 done. Each phase ends with a report and a commit (see section 6).

## 1. What I found

- The current app is the Figma export: 13 screens on a fixed 1440x900 stage scaled with CSS `transform`,
  absolute pixel positions, ~160 generated SVGs keyed by Figma node ids, and generated atomic CSS.
- Input is mouse/keyboard only (`onClick`, arrow keys). All letters, words and sentences are hard-coded.
- Navigation is an if/else chain in `App.tsx` plus a module-level mutable `sessionMethod`.
- `node_modules` was tracked (2,865 files) and `.gitignore` was UTF-16. Fixed in the first commit of this branch.

## 2. Keep / rewrite / delete

| Keep | Rewrite | Delete (after replacement) |
|---|---|---|
| Visual design (colors, spacing, Inter, copy, hierarchy) | Every screen as responsive components (CSS variables + CSS modules) | `tools/gen_css.py`, `src/styles/atomic.css` |
| Screen order, gesture vocabulary, usability rules | `App.tsx` -> state-machine screen host | `tools/build_assets.py`, `tools/hands_data.json`, `tools/svgs_part*.json` |
| `session.tsx` fields (hand, alphabet, place, method) as the start of the settings store | `ui/parts.tsx` -> `ui/*` (HoldRing, HintBar, TopBar/Stepper, Card, Chip, CameraView, CommandZone) | `src/assets/n*-*.svg` (~160 files), `src/ui/assets.ts` |
| Vite + React + TS setup | `nav.tsx` (replaced by machine events) | `src/styles/base.css` fixed-stage rules |
| Hand pose data (21-point layouts) -> reused to draw `<HandGlyph>` | | |

## 3. Target architecture

Exactly the layout in the task (`app/ state/ input/ recognition/ nlp/ output/ study/ screens/ ui/ server/ tests/`).
Single typed FSM in `state/machine.ts` (XState v5): the only owner of "which screen am I on".
Pipeline: camera -> HandLandmarker (2 hands) -> normalise -> gestures / pointer / letters -> events -> FSM -> UI + TTS + aria-live.

## 4. Environment constraints (honest)

I build and test in a cloud sandbox that has **no webcam, no GPU, and blocks downloads from
storage.googleapis.com / huggingface.co**. Consequences:

1. The MediaPipe `hand_landmarker.task` (and a YOLO model) cannot be fetched here. The repo gets
   `npm run models` (downloads the `.task` file on your machine and copies the wasm out of
   `node_modules/@mediapipe/tasks-vision`). `public/models/` is git-ignored except for a README.
2. I cannot run real hand tracking here. Gesture / dwell / FSM / dictionary / context logic is built as
   pure functions and tested on **synthetic landmark fixtures** that are labelled as synthetic.
   The real-camera behaviour must be verified by you on a laptop; I will list exactly what to check.
3. A letter model and a card detector need real data and training (Python, GPU for YOLO). I will ship the
   interfaces, the in-app data-collection mode, the training/export scripts and the evaluation docs,
   plus a k-NN baseline that trains from your exported JSON. **No accuracy number will be written
   into docs until it is measured from real recordings.** Until a model exists the letter/card paths
   show "No model yet" and the facilitator (Wizard-of-Oz, `?woz=1`) panel can drive them.
4. Arabic / "More" alphabets: shown as "Coming soon" (disabled) until a label set + model exist.
5. E2E runs in Playwright with a mocked landmark stream (fake video cannot produce landmarks without the
   model). Visual comparison uses the 13 PNG exports in `public/design/` (I will regenerate them from Figma).

## 5. Accessibility fixes (all applied in Phase 1, verified by test in Phase 7)

Contrast tokens (computed, not guessed): command-zone text #CBD5E1/white on #1E293B; inactive #94A3B8;
recognised letter + underline #B45309; detection badge bg #15803D; placeholder #64748B.
Min text 14px (labels 16px); stepper current = bold + underline + `aria-current="step"`; suggested hint =
heavier weight + "Suggested" marker; targets >= 44px (dwell >= 96px); landmarks, headings, `aria-live`,
alt text, `prefers-reduced-motion`, focus styles; high-contrast/large-text as a 3rd question on screen 03.

## 6. Phases (stop + report after each; one commit per phase)

0. Hygiene + plan (this commit set).
1. UI rebuild + FSM + dev-only simulator (`?dev=1`) + a11y fixes + screenshot compare.
2. Camera, tracker, gestures, pointer (One-Euro), dwell, command zone, wake / help / thumbs / hand-lost.
3. Context sensing, settings, adaptive dwell, TTS + aria-live announcer.
4. Letter recognition: collection mode, training scripts, k-NN baseline, 06/07/09 end-to-end.
5. Card detection + tracking (ONNX runtime, SORT tracker, hold-to-add), card packs.
6. Sentence server (Express proxy, `.env.example`), validation, offline fallback, safety rule.
7. Docs, e2e + axe + perf, final README. (Study logger/panel was moved earlier: it comes right after Phase 3, see the comparison-study section.)

## 7. Definition-of-done tracking

I will keep a table in `docs/DONE.md` with each checklist item, the evidence (test name / manual
procedure) and a status of `verified here`, `needs your camera`, or `not met`.

## Phase 1 status
Done: state machine, 13 responsive screens, a11y tokens + tests, `?dev=1` simulator, screenshot comparison (`npm run compare`), old generated assets/tools deleted. See docs/DONE.md.

## Phase 2 status
Done (see docs/PHASE2.md and docs/DONE.md): camera, MediaPipe tracker (needs `npm run models`), rule-based gestures with hysteresis, One-Euro pointer, command zones, dwell engine with adaptive time, controller wired to the machine, live HoldRing / command-zone highlight / hand chip / setup checks, dev-only Vision debug panel, `npm run e2e` and `npm run layout`.
Not verified: real-hand accuracy and real-time speed. They need a webcam (see `docs/PHASE2_CHECKLIST.md`).
Not started: Phase 3 (speech, context sensing), Phase 4 (letters), Phase 5 (cards), Phase 6 (sentence server), Phase 7 (study logger, axe, perf).

## Course requirement: comparison study (added, changes the order of phases)
The course asks us to COMPARE TWO different interaction techniques and evaluate them on User Satisfaction, Engagement, Usability and Surveys.
- Technique 1: camera hand signs (this app).
- Technique 2: **DECIDED (Youssef): keyboard + mouse baseline.** Design: within-subject (every participant does the task in both modes) with the order counterbalanced (half start with camera signs, half with keyboard + mouse). Rejected: touch, pointer-only on-screen keyboard.
- **Study logger moves earlier**: it is built right after Phase 3 (before letter recognition), not in Phase 7. Same task in both modes (write a sentence), log time, errors and the post-task survey answers; export JSON/CSV.
- Surveys follow Lab 3: closed, specific, unbiased questions, balanced equal-range choices, always a neutral middle option; define the problem and target users first.
- Usability grading rules (Lab 2): Navigation, Familiarity, Consistency, Error Prevention, Feedback, Visual Clarity, Flexibility & Efficiency. Every primary action needs a gesture equivalent, immediate feedback and error recovery.
- Course deadlines: Phase 1 week 4, Phase 2 week 6, Phase 3 week 13, Phase 4 week 14. What the course "Phase 2" requires is unconfirmed (Youssef asks the TA); it is not assumed to equal the phases above.
- **DECIDED (Youssef): training in Python.** k-NN for static letters, $1 (dollarpy) for moving signs only. The browser app only consumes an exported model JSON. Tooling stops at the end of Phase 4; then it is handed over to Youssef and the team.
- Still open: what the course's own Phase 2 (week 6) requires. Youssef is asking the TA; nothing is assumed.

## Phase 3 status (branch feat/phase3-context-settings)
Done: context sensing with tips, screen 14 comfort settings (text size, contrast, hold time, voice), adaptive-dwell display, speech synthesis, aria-live for tips. See docs/PHASE3.md and docs/DONE.md. Known gap: Extra large text overflows (KNOWN_ISSUES #3).
Next: study mode (comparison with keyboard + mouse), then Phase 4.

## Study mode status (branch feat/study-mode, stacked on Phase 3)
Done: `?study=1` facilitator console, Latin-square plan, camera trials logged from machine events, keyboard + mouse task, surveys after each method and a comparison, CSV/JSON export. See docs/STUDY.md.
Open: Phase 7 keeps adding polish (axe, performance); the final study report needs real participants.

## Phase 4 status (branch feat/phase4-recognition, stacked on the study mode)
Done: collection mode, dataset format, Python trainers (k-NN, $P), model JSON loader, replaceable recogniser interface, letter hold logic, Wizard-of-Oz panel, honest "no model" notice. See docs/PHASE4.md.
STOP POINT reached as agreed: the model itself is for Youssef and the team. Handoff: docs/MODEL_HANDOFF.md. Phases 5-7 continue without waiting for the model.

## Phase 5 status (branch feat/phase5-cards, stacked on Phase 4)
Done: card list as data (`src/data/contexts.json`), YOLOv8 decoding, SORT tracker, hold-to-add controller, ONNX Runtime Web loader, live overlay, honest notices, printable cards, Python label/export/check tools. See docs/CARDS.md. The detector itself needs photos and training by the team (not started, as agreed for models).

## Phase 6 status (branch feat/phase6-sentence-server, stacked on Phase 5)
Done: sentence server (WebSocket for the app + plain TCP lab-style socket, JSON protocol, rate limit, origin list), Anthropic client behind a provider interface, shared safety rule, offline fallback, app bridge (offline first, server sentence swapped in only when valid), `.env.example`, docs in server/README.md. Fixed on the way: the offline builder dropped a chosen "Hello" in two of three wordings. Not tried against the live API (no key here).

## Phase 7 status (branch feat/phase7-polish, stacked on Phase 6)
Done: study logger final (profile + consent, session record, camera speed per trial, more exports, Python analysis script), axe audit with fixes, performance recording tool and benchmark, `npm run verify`, `docs/WHATS_LEFT.md`. All seven phases are built; what remains needs a real camera, real people and trained models (docs/WHATS_LEFT.md).

## Phase II grading rows (branches feat/ble-presence, feat/context-push, feat/dollarpy-demo, feat/demo-all)
The course Phase II sheet scores Bluetooth (UserID + discovery), socket programming, DollarPy on MediaPipe, and "load different content based on context". Order: (1) `tools/bluetooth/scan.py` + a `presence` message on the sentence server; (2) the server pushes context to the web app, which loads the place and the person's saved settings with a visible override; (3) `tools/dollarpy/` record + live classify, letters sent over the socket; (4) `tools/demo-all.md` with a clearly labelled FAKE device; (5) the mapping table in `docs/DONE.md`. No Bluetooth hardware and no webcam were available in the build environment: those rows stay "needs real hardware".
