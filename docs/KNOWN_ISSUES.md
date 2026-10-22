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
| 4 | The browser console prints `<svg> attribute width: Expected length, "var(--s-22)"` (and similar) many times: the icon component passes a CSS variable as the SVG width/height attribute. The icons still render because CSS sizes them, so nothing is visible. | all | open any screen with the console open | cosmetic | open | code |
