# Known issues

Youssef adds anything that is not 100% right from camera testing (gesture, screen, behaviour). Claude adds bugs found while building.
Rule: nothing here is fixed unless it blocks the phase being built. Fixes get a test that reproduces the problem first.

Severity: **blocker** (cannot continue / cannot use the app) · **annoying** (works but hurts) · **cosmetic**.
Status: open · blocked-phase (fix now, it stops the current phase) · fixed (commit) · wontfix.
Source: `camera` = found by Youssef on a real camera; `code` = found by reading/building, not yet seen on a camera.

| # | Description | Screen | How to reproduce | Severity | Status | Source |
| - | ----------- | ------ | ---------------- | -------- | ------ | ------ |
| 1 | Dead branch in `GestureController.track()`: `sorted.length === 2 && i === 1 && keys.size === 0` can never be true (keys already holds one entry at i = 1). Left/right keys still end up different, so nothing visibly breaks, but the line is misleading. | all | read `src/vision/controller.ts` `track()` | cosmetic | open | code |
| 2 | Real-camera behaviour of every gesture, pointer and dwell is unmeasured. Tracked in `docs/PHASE2_CHECKLIST.md`, not here, until Youssef reports specific failures. | all | – | – | open | code |
| 3 | "Extra large" text size (150%) makes 21 screen/size combinations scroll or overflow (e.g. screens 1, 7, 9, 11, 13, 14 at 1440x900; 13 and 14 at 1280x720 and 1920x1080). Normal and Large are clean on all 84 combinations. | 1, 7, 9, 11, 13, 14 | Screen 14, choose "Extra large", or `npm run layout` (prints each OVERFLOW line) | annoying | open | code |
| 4 | The browser console prints `<svg> attribute width: Expected length, "var(--s-22)"` (and similar) many times: the icon component passes a CSS variable as the SVG width/height attribute. The icons still render because CSS sizes them, so nothing is visible. | all | open any screen with the console open | cosmetic | fixed (fix/icon-svg-attrs: `Icon` sets width/height attributes only for numbers; `tests/icon.test.tsx`, e2e checks the console) | code |
| 5 | Missing size tokens `--s-44` and `--s-72`: the hand-lost warning icon fills the camera panel and cuts off "We lost your hand"; icons on 04 and 05 are far bigger than Figma. (FLOW_AUDIT F1) | 8, 4, 5 | `npm run compare -- --only 8` | blocker | fixed (fix/flow-blockers: tokens defined, `tests/tokens.test.ts`) | code |
| 6 | "Need to add more? Show a card or spell a word." has no gesture, dwell target or hint behind it; `CHOOSE_METHOD` is only sent by the dev panel. (F2) | 11 | read the screen, try every gesture | blocker | fixed (fix/flow-blockers: two point-and-hold targets on screen 11, e2e) | code |
| 7 | Hand-lost screen shows Space/Delete/Done/Cancel hints that do nothing, and has no timeout or second way out. (F6) | 8 | `#8` with `?dev=1`; thumbs-up/fist do nothing | blocker | fixed for the hints, and a tip after 10 s (fix/flow-blockers). There is still no second way out: leaving 08 needs a hand, by design | code |
| 8 | Spell is pre-selected on 05 but no letter model exists yet, so no word can be made on a real camera. UI should say so before the user commits (model itself is out of scope, see MODEL_HANDOFF.md). (F3) | 5, 6, 7 | real camera, no model file | blocker | open | code |
| 9 | Cancel (thumbs-down) goes back but keeps the typed letters/cards: 07 -> 06 -> 05 -> 06 shows "HE" again. (F4) | 6, 7, 10 | mock walk: spell "HE", Cancel twice, Yes | annoying | open | code |
| 10 | Finish (thumbs-up on 12) clears the message and returns to 01 with no confirm or undo; "Reading aloud..." shows even when voice is off. (F10) | 12 | thumbs-up 1.5 s on 12 | annoying | open | code |
| 11 | Fist "Delete" means different things per screen; on 11 with one word left it clears the whole message and jumps to 05 with no warning. (F9) | 6, 9, 10, 11 | read `machine.ts` | annoying | open | code |
| 12 | Gesture guide says "Undo is offered" for Delete. There is no undo in the app. (F5) | 13 | grep "undo" in `src` | annoying | open | code |
| 13 | Choose-then-thumbs-up (Figma: point and hold moves on); footer says "Continue" on 03/14 but "Yes" on 04/05; screen 14 has no Figma frame. (F8) | 3, 14, 4, 5 | follow the flow, compare with Figma Flow page | annoying | open | code |
| 14 | Hints that do nothing: "Done" on an empty 06 (no feedback), "Point and hold: choose" on 13 (no targets). (F7) | 6, 13 | mock walk | annoying | open | code |
