# Phase 2: check on your machine

Nothing below has been measured yet. Fill the tables on a real laptop webcam; do not copy numbers from anywhere else.

## Setup
1. `npm ci && npm run models && npm run dev`, open `http://localhost:5173/?dev=1` in Chrome or Edge, allow the camera.
2. Note: laptop model, camera, room light (day / lamp / dim), distance to the screen, left- or right-handed signer.
3. Keep the **Vision debug** panel visible. It shows fps, inference ms, gesture + confidence, pointer, dwell, checks.

## A. Speed
Best: open `/?perf=1`, press **Record 30 s**, use the app, export the JSON (see `docs/PERF.md`) and paste the summary below. Quick alternative: look at the Vision debug panel for 30 s with one hand in view.
| Item | Value | Note |
| --- | --- | --- |
| camera fps | | |
| inference ms (typical / worst) | | |
| GPU delegate or CPU fallback? | | |

## B. Gestures: 20 attempts each
Per attempt: show the gesture, hold about 1 s, tick whether the panel label was correct. Record the wrong label when it was wrong.
Do it on screen 02 (any screen with `?dev=1#N` works). Repeat in a second light/distance if you can.

| Gesture | Correct /20 | Missed (label `none`) | Confused with (label + count) | Avg confidence shown | Notes |
| --- | --- | --- | --- | --- | --- |
| open | | | | | |
| fist | | | | | |
| thumbs up | | | | | |
| thumbs down | | | | | |
| point | | | | | |

Also try on purpose and write what the label does: thumbs up tilted about 30 degrees, hand very close, hand half out of frame, two hands overlapping.

## C. Commands (do each 20 times on the right screen; count only if it fired exactly once)
| Action | Screen | Fired right /20 | Misfires (wrong or double) | Notes |
| --- | --- | --- | --- | --- |
| Raise open hand 2 s = start | 01 | | | |
| Both open hands 1 s = help | any | | | |
| Point + hold on a tile = choose | 03/04/05 | | | |
| Thumbs up = yes | 03/11 | | | |
| Thumbs down = no/back | 03/11 | | | |
| Fist = delete (command zone) | 06/07 | | | |
| Open palm = space (command zone) | 06/07 | | | |
| Hand lost 1 s -> screen 08, hand back -> returns | 06/07 | | | |

## D. Pointer and setup checks
| Question | Answer |
| --- | --- |
| Can you reach all four screen corners with the fingertip? | |
| Is the pointer jittery when you hold still? (none / a little / a lot) | |
| Is the pointer laggy when you move fast? | |
| Does the dwell time (0.8 s) feel too short / right / too long? | |
| Setup check light: values in the panel in good light / dim light | |
| Setup check distance: palm length % at a comfortable distance | |
| Setup check hand in frame works? | |
| Command zone: is the outer 40% comfortable for your non-signing hand? | |

## E. Report back
Send the tables. For every misfiring gesture also say light, distance and what you did; I will reproduce it as a test before changing any threshold (constants live in `src/vision/gestures.ts`, `checks.ts`, `zones.ts`, `controller.ts`) and note it in `docs/PHASE2.md`.
