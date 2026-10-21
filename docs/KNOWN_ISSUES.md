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
