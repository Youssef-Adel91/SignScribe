# Phase 4: letter recognition tooling

The model is not part of Phase 4: only the tooling around it. See `docs/MODEL_HANDOFF.md` for how the team builds and installs it.

## Pipeline in the app
    camera -> MediaPipe -> HandFrame -> GestureController (commands, pointer, dwell)         -> machine events
                                     -> LetterController (letters, only on screens 06 and 07) -> LETTER_CANDIDATE / LETTER_CONFIRMED / CANDIDATE_LOST

`LetterController` is pure (no DOM, no React). It takes two optional recognizers behind interfaces:
`StaticRecognizer` (k-NN today) and `MotionRecognizer` ($P today). With no model files it does nothing and the app says so ("No letter model yet").

- **Which hand signs:** the hand OUTSIDE the command zone. The zone hand makes space / delete / done / cancel and is never read as a letter.
- **Static letters:** a guess needs `LETTER.minConfidence` and must stay the same for `stableMs` before a candidate is shown; it is written after `holdMs` with at least `confirmConfidence`. The same sign cannot be written twice until the hand has shown something else (or nothing) for `releaseMs`.
- **Moving letters (J, Z):** a movement of the tracked fingertip starts above `motionStartSpeed` and ends when it slows down; the path is matched with $P; a score of at least `motionMinScore` writes the letter at once (the movement is the confirmation). While a movement is drawn the static guess is held back.
- A command given while a letter is held (for example thumbs down) blocks that letter until it is released, so cancelling really cancels.
- Screen 07 shows the real hold ring; `LetterNotice` says plainly when letters cannot be read (no model, broken model, model trained on generated data).

## Tools
| Tool | URL / command | For |
| ---- | ------------- | --- |
| Collection mode | `/?collect=1` | record takes, see counts per letter, export / import JSONL |
| Wizard of Oz | `/?woz=1` | a facilitator types the letters; same events as the recogniser |
| Trainers | `ml/train_knn.py`, `ml/train_dollar.py` | model JSON + evidence report |
| Validator | `ml/validate_model.py` | checks a model file |
| Tests | `npm run ml:test` (Python), `npm run test` (TypeScript), `npm run e2e:collect` | pipeline checks on generated data and synthetic hands |

## What is verified, and what is not
Verified here: file formats, validation, feature and $P parity between Python and TypeScript (golden files; our $P against `dollarpy`), a Python-written model gives the same answers in TypeScript, the recorder's rules, the letter hold / release / command logic, the collection and Wizard-of-Oz pages in a browser with synthetic hands.
Not verified: **everything about real hands**: whether the features separate real letters, how good the model is, whether the thresholds feel right, whether collection works with a real camera. No accuracy number exists.
