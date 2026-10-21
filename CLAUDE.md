# CLAUDE.md – SignScribe

HCI Fall 2026 course project (MSA). Camera-based interface that turns hand signs into written sentences.
Owner: Youssef. Talk to him in Egyptian Arabic (plain, student style). Code, commits and docs stay in English.

## Status
Phase 3 of 7 done on a branch (see PLAN.md): camera, MediaPipe hand tracking, rule-based gestures, pointer, dwell, command zone.
NOT built: letter recognition (4), context sensing/settings/TTS (3), card detection (5), sentence server (6), study logger (moved earlier, see PLAN.md).
Youssef decided (overrides the earlier wait): build the whole platform first (Phase 3 -> study mode -> 4 -> 5 -> 6 -> 7), then fix bugs from camera testing. Order, one branch + PR per phase, `npm run check` green.
Camera bugs go in docs/KNOWN_ISSUES.md; do not fix them unless they block the phase being built. After Phase 4 write docs/MODEL_HANDOFF.md, then continue with 5-7 without waiting for the model.

## Commands
    npm ci
    npm run models     # copies MediaPipe wasm + downloads hand_landmarker.task into public/models
    npm run dev        # http://localhost:5173 (?dev=1 for dev panels; vision=off | vision=mock)
    npm run check      # typecheck + lint + unit tests (241) + production build. Keep green on every commit
    npm run e2e        # needs a build; flow driven by synthetic hands (31 checks)
    npm run layout     # needs a build; 78 screen/size combos
    npm run compare    # needs a build; screens next to Figma exports (tools/compare/out)

## Folder map
    src/state/    XState v5 machine = the only owner of "which screen" (14 screens; 08 hand lost, 13 help)
    src/vision/   camera, MediaPipe, landmarks, gestures, pointer (One-Euro), dwell, zones, controller, checks
    src/screens/  S01..S13, driven by the machine; no click/key handlers (tested)
    src/ui/       shared components    src/nlp/  word lists, offline sentence builder
    src/dev/      panels, only with ?dev=1    src/study/  comparison study (?study=1): plan, survey, log, console
    tests/        vitest    tools/  models, e2e, layout, compare    docs/  DONE.md, A11Y.md, PHASE2.md, PHASE2_CHECKLIST.md
Design: Figma file key 11g6ZDeS8xInkvy58p7yMO ("HCI Project"), page "Screens" has the 13 frames; PNG exports in public/design/.

## Hard rules
- Never state an accuracy, fps or latency number unless measured on a real camera with real hands. Synthetic landmarks only prove logic. In docs/DONE.md use: "verified here / needs my camera / not met".
- Gesture thresholds are heuristics. When Youssef reports a misfire: write a test that reproduces it, adjust, and note it in docs/PHASE2.md.
- Do NOT vibe-code the sign-recognition model. Build tooling only (collection mode, dataset format, training scripts, k-NN baseline) up to the end of Phase 4, then stop and hand over to Youssef and the team.
- `npm run check` green on every commit. Small commits, clear messages. Work on branches and open PRs; never push to main (the earlier question about pushing to main is still unanswered; keep branches + PRs).
- Documentation is part of the work: update README, PLAN.md and docs/DONE.md with every change.
- Every primary action needs a gesture equivalent, immediate feedback and error recovery.

## Course requirements (from lab slides)
- Project must COMPARE TWO interaction techniques, evaluated on: User Satisfaction, Engagement, Usability, Surveys.
  Technique 1 = camera hand signs. Technique 2 = keyboard + mouse (DECIDED). Within-subject, order counterbalanced.
- So the study logger comes early: same task (write a sentence) in both modes; log time, errors, short post-task survey.
- Course deadlines: course Phase 1 week 4, Phase 2 week 6, Phase 3 week 13, Phase 4 week 14. What course Phase 2 requires is still unknown (Youssef is asking the TA). Do not assume it equals PLAN.md phases.
- Lab 2 usability rules used for grading: Navigation, Familiarity, Consistency, Error Prevention, Feedback, Visual Clarity, Flexibility & Efficiency.
- Lab 3 survey rules: closed, specific, unbiased questions; balanced answer choices of equal ranges; always a middle/neutral option; define the problem and target users first.
- Labs use Python (MediaPipe, dollarpy, sockets). DECIDED: training in Python (k-NN for static letters, $1 only for moving signs); the browser app consumes an exported model JSON. Tooling stops at the end of Phase 4.
