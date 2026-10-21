# Phase 3: context, comfort settings, speech

## What was added
- **Context sensing** (`src/vision/context.ts`, `ContextNotice`): while a hand is needed (screens 06, 07, 09, 10) the app watches brightness and palm size. A problem must last 3 s before a one-sentence tip appears (dark / too bright / hand far / hand close) and be gone for 2 s before it disappears. Hysteresis margins stop flicker at the limits. The limits are the same constants as the setup check on screen 02 (`checks.ts`): all are heuristics to be tuned on a real camera.
- **Screen 14 "Comfort settings"** (new, no Figma frame): shown right after 03 (`03 -> 14 -> 04`, thumbs down goes back). Text size (normal / large / extra large), contrast (standard / high), hold time (automatic / slower 1.2 s / normal 0.8 s / faster 0.6 s) and voice (read aloud / silent). Each choice is applied at once and saved (`localStorage`, key `signscribe.settings.v2`; the old single "display" choice from Phase 1-2 is migrated). Screen 03 now asks only for hand and alphabet.
- **Adaptive dwell UI**: automatic keeps the adaptive 0.6-1.4 s behaviour from Phase 2 and shows the current hold time on screen 14 ("now 0.8 s"); the fixed options pin the time and switch learning off.
- **Speech** (`src/output/speech.ts`): browser SpeechSynthesis, English. `announce()` now writes to the aria-live region and speaks; the screen name is for screen readers only. Same text twice in a row is spoken once. Silent when switched off, when the browser has no voice, or on any error.
- **aria-live**: unchanged mechanism, now also used by the context tips.

## Limits (honest)
- No real-camera check of the light/distance limits or of the 3 s / 2 s timing.
- Speech was tested with a fake synth only; which voice you hear depends on the browser and OS.
- "Extra large" overflows some screens (docs/KNOWN_ISSUES.md #3).
