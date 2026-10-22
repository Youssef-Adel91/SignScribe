# What is left, and what only you can do

Everything below the line "built" is code and checks that run here. **Nothing in this repository has been tried on a real camera with a real hand, a real card or the live language model.** This page lists what that leaves, in the order I suggest. Evidence per item: `docs/DONE.md`. Known problems: `docs/KNOWN_ISSUES.md`.

## 1. First: try it on your camera (about an hour)
1. `npm ci && npm run models && npm run dev`, open `/?dev=1` in Chrome or Edge.
2. Fill in `docs/PHASE2_CHECKLIST.md` (gestures 20 times each, commands, pointer, setup checks) and record `/?perf=1` for speed (`docs/PERF.md`).
3. Write every misfire in `docs/KNOWN_ISSUES.md` (screen, how to repeat, severity). Fixes start from a failing test that reproduces it.
4. Things only a person can judge: do the thresholds feel right (`checks.ts`, `zones.ts`, `controller.ts`), is the speech understandable, do the tips about light and distance appear when they should, does "Extra large" text matter to you (it overflows 21 screen/size combinations).

## 2. Models the team has to make (tooling is built)
| Model | What to do | Where |
| ----- | ---------- | ----- |
| Letters (k-NN) and moving letters J, Z ($P) | collect with several people, train in Python, read the report, tune `LETTER` | `docs/MODEL_HANDOFF.md` |
| Picture card detector (YOLO to ONNX) | print the cards, photograph, label, train, export, tune `CARD` | `docs/CARDS.md` |
Until they exist the app says so on screen; the Wizard of Oz page (`/?woz=1`) lets a facilitator type letters and cards for a study. Decide the alphabet first (ASL assumed; BSL does not fit one-handed signing).

## 3. The study
1. Fix what the camera test showed. Decide with the TA what the course's Phase 2 deliverable is.
2. Pilot with 2 to 4 people, read `docs/STUDY.md`, check the survey wording with someone who has not seen it.
3. Run a multiple of 4 participants (the order is counterbalanced over 4). Export after every session.
4. `python ml/analysis/study_report.py --dir exports/`. Report effect sizes and raw numbers, say who the participants were, and that the camera method is limited by the build at the time.

## 4. The language model
Put `ANTHROPIC_API_KEY` in `.env`, `npm run server`, open `/?server=ws://localhost:8787`, and read the `note` field of the answers: it says how often the safety rule rejected the model. Prompt, model name and quality are untested.

## 5. Other open decisions
- Merge: all seven phases were merged into `main` in one pull request (Phase 7 branch, which contains the whole stack). PRs #2 to #6 were closed as already included. New work: branch from `main` and open a PR.
- Arabic and other alphabets: shown as "Coming soon"; each needs its own labels and model.
- Real screen reader test (NVDA / VoiceOver): `npm run axe` finds rule violations only; it finds about a third of real problems.
- Python versus browser for training: decided Python; the browser only reads exported JSON / ONNX.

## What "built" means here
`npm run verify` runs all of it: type check, lint, unit tests, production build, the gesture flow with no mouse or keyboard, screen overflow at three sizes and three text sizes, axe on 62 pages and states, a whole study session, collection mode, the card path through a real ONNX Runtime with a test-only model, the sentence server with a real socket and a hostile server, and the Python tools. These use synthetic hands, generated data and test models, so they prove the logic, not how well the real parts work.
