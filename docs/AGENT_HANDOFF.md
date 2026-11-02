# Agent handoff (state of 2026-11-02)

For any coding agent (Claude Code, Antigravity, Codex) working on SignScribe. This replaces the earlier handoff text that lived outside the repo. Read `CLAUDE.md` first; it wins over this page.

## Rules that matter most
- Talk to Youssef in plain Egyptian Arabic. Code, commits, docs: English.
- Never state an accuracy / fps / latency number unless it comes from `docs/MODEL_RESULTS.md` (written by `ml/evaluate.py`) or was measured on a real camera. Image-dataset results are not webcam results.
- Never commit data, takes, landmarks, `*-knn.json`, `.env`, keys, `devices.json`, `templates.json`. Run `npm run check:staged` before committing.
- Branch + PR only. **Merging into `main` needs Youssef to ask for it in that message.**
- `npm run check` green on every commit. Docs are part of the work.
- The Phase II demo must use **real** Bluetooth and DollarPy (`docs/REAL_HARDWARE.md`). FAKE modes are for rehearsal and automatic tests only.
- Trello is postponed until the end by Youssef's decision. Do not work on it.

## Where things are
| Thing | State |
| --- | --- |
| `main` | at `9bc949d` (includes the three Phase II branches: profile theme, Lab 4 threads, submission docs; merged by PRs #31-#33) |
| PR #34 | Kaggle ArSL + ASL results into `docs/MODEL_RESULTS.md`, `PROJECT_STATUS.md`, credits (open) |
| PR #35 | Arabic MLP weights in `public/models/letters-arsl-mlp.json`; stacked on #34 (open) |
| PR #36 | study survey: `fee1` split into `fee1` + `fee2` (open) |
| PR #37 | real-hardware guide + this page (open) |
| Arabic letters | MLP trained on ArSL21L pictures, leave-one-person-out result in `docs/MODEL_RESULTS.md`; **not measured on a webcam** |
| English letters | trained once on a different dataset, experimental, not shipped |
| Moving letters | DollarPy templates must be recorded by the team (`tools/dollarpy/record_templates.py`) |
| Sentence server | built; the live LLM path was never tried (no key) |

## What only Youssef / the team can do
1. Real webcam test with `docs/PHASE2_CHECKLIST.md`; misfires into `docs/KNOWN_ISSUES.md`.
2. Real Bluetooth: adapter + band + beacon (`docs/REAL_HARDWARE.md`), then fill the evidence into `docs/DONE.md`.
3. Record DollarPy templates with a webcam.
4. Confirm the 11 ArSL mappings marked TODO in `config/alphabets/arsl.json`; decide the control signs. Never guess them.
5. Say which ArSL21L Mendeley record was downloaded (`8hrn3bvdvk` or `f63xhm286w`).
6. Ask the TA: the missing 10th point of the Phase II sheet, the two techniques compared, Phase 3 / 4 requirements, deadline weeks.
7. Study pilot and participants; citations in `docs/CREDITS.md` (`TODO(Youssef)`).
8. A live sentence-server test needs an API key in `.env` (never commit it).

## What an agent can still do without his machine
- Keep docs and tests in step (`tests/project-status.test.ts` ties every percentage in `PROJECT_STATUS.md` to `MODEL_RESULTS.md`).
- Survey item `err1` ("did not need to correct anything" option) needs form and export support.
- English data plan (more signers, closed-hand letters lost by the hand detector).
- Prompts and checklists for the camera sessions.

## Checks
`npm run check` (typecheck, lint, tests, build). `npm run verify` runs every automatic check in one table; it passed 13/13 on Windows (2026-11-01). Playwright steps need the matching browser build installed.
