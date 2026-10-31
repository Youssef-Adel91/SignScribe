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

## Context from Bluetooth (branch feat/context-push)
Course Phase II row "Load different content based on context". The place and the person can come from Bluetooth instead of being chosen by hand.

Chain: `tools/bluetooth/scan.py` -> sentence server (TCP, `presence` message) -> server pushes `context` over WebSocket -> `ContextBridge` -> state machine events.

What the app does (`src/state/machine.ts`, `src/ui/DetectedChip.tsx`, `src/nlp/ContextBridge.tsx`):
- **Before the first letter or card** (screens 1-5 and 14) a detection loads the detected place (the "Where are you today?" choice, the card pack and the word list follow `place` as they always did) and the recognised person's **saved settings** (hand, text size, contrast, hold time, voice), kept in this browser under that person's id (`src/state/profiles.ts`). A person seen for the first time keeps the current settings, which are then saved as theirs.
- **After the message has started** a detection is only shown, never applied: the words and cards must not change under the person.
- **Shown on every screen** as a chip in the top bar: `Bluetooth: youssef · Clinic`, with `(demo device)` for a fake one, and announced to screen readers.
- **Override**, by pointing and holding like everything else: on screens 1-5 and 14 a dashed target "Wrong? Point and hold here to ignore" restores the place and settings from before the detection and ignores that detection (the chip becomes "Bluetooth ignored"). Choosing a place yourself always wins over Bluetooth for the rest of the session. The ignore is forgotten when nothing is detected any more or when a sentence is finished.
- **Bluetooth off, scanner stopped, server not running, nothing known nearby**: nothing arrives, no chip is shown and the app behaves exactly as before (manual choice). A presence that is not refreshed for 15 s is dropped by the server.
- Not used in `?study=1` (both methods must get the same conditions) or `?collect=1`.

Verified here: the machine rules (`tests/bluetooth-context.test.ts`), the push over a real WebSocket and TCP socket (`tests/presence.test.ts`), the whole chain in a browser with the scanner in FAKE mode (`npm run e2e:context`). Not verified: real Bluetooth hardware, and what it feels like to override by pointing with a real camera.

## Moving letters from the dollarpy client (branch feat/dollarpy-demo)
`tools/dollarpy/` (see its README) recognises a moving letter from a webcam with MediaPipe + the `dollarpy` package and sends it to the server (`letter` message). The server relays it over the WebSocket; on screens 6 and 7 the app shows a card "dollarpy: J" (with "(simulated)" for generated input) that is added to the message only when the person points at it and holds (`LETTER_ADD`). A letter that is not in the active alphabet is ignored; the card disappears after 8 s or after it was added. Not used in the study or collection modes.

