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
7. Study logger/panel, docs, e2e + axe + perf, final README.

## 7. Definition-of-done tracking

I will keep a table in `docs/DONE.md` with each checklist item, the evidence (test name / manual
procedure) and a status of `verified here`, `needs your camera`, or `not met`.
