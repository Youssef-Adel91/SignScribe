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
| 3 | "Extra large" text size (150%) makes 24 screen/size combinations scroll or overflow on the integration branch (`npm run layout`, measured there; it was 21 before the flow-audit fixes and the later work came together: screen 11 now also overflows at 1280x720 and 1920x1080). E.g. screens 1, 7, 9, 11, 13, 14 at 1440x900; 11, 13 and 14 at 1280x720 and 1920x1080. Normal and Large are clean on all 84 combinations. | 1, 7, 9, 11, 13, 14 | Screen 14, choose "Extra large", or `npm run layout` (prints each OVERFLOW line) | annoying | open | code |
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
| 15 | **ArSL (Arabic) sentences are checked with a small word list, not a dictionary.** The English checks (word list, endings) are skipped for ArSL (`alphabet: "arsl"` in the request, mode `arabic` in `src/nlp/validate.ts`). What holds: at most 200 characters, 25 words, 2 sentences; no links or e-mail; only Arabic letters and punctuation (no digits); every chosen word appears; **every other word must be a chosen word (also with the joined small words و ف ب ل ك ال) or one of the ~50 helper words in `src/nlp/arabicWords.ts`** (`docs/ARABIC_WORDS.md`, written by us, no negation); the connection rate limits; the browser checks the answer again. Limits: the list is tiny, so many good sentences are refused and the plain chosen words are shown instead; endings and joined pronouns (`طبيبي`) are refused; there is no Arabic dictionary, so a spelling mistake is not corrected; the check does not know grammar. The review screen says this in plain words. | 11 | spell Arabic words, finish, read the note under the suggested sentence | annoying | open | code |
| 16 | A class whose Arabic letter is not confirmed (`display` is null or the class is in a `todo` question in `config/alphabets/arsl.json`: ta, taa, toot, ha, haa, ya, yaa, dha, dhad, al, la) is written as its Latin id between marks (for example `⟨ta⟩`), drawn dashed. A word that contains one is never sent to the sentence server. It is not an Arabic letter and must be replaced once the team decides. | 6, 7, 11 | choose Arabic, sign one of these classes | annoying | open | code |
| 17 | Arabic SpeechSynthesis voice: When Arabic is active, the app speaks with an Arabic voice (prioritising `ar-EG`, then `ar-SA`, then any `ar-*`). If no Arabic voice is installed on the device, the app NEVER uses an English voice to read Arabic text; it shows a notice on screen 14 and falls back to Sounds only. See instructions below for installing an Arabic voice on Windows, macOS, and Android. | 12, 14 | choose Arabic with no Arabic voice installed | annoying | open | code |
| 18 | ArSL has only the small helper-word list (#15), no Arabic dictionary, so the word suggestion screen (09) is skipped for Arabic words and the sentence is the words as spelt. `LETTER` thresholds were set for the English k-NN and are not tuned for Arabic classes or for the neural network. No ArSL model file is in `public/models/` (`letters-arsl-knn.json` / `letters-arsl-mlp.json` are read if you add them), so the spelling screen shows "No letter model yet" until then. | 6, 7, 9 | choose Arabic | annoying | open | code |
| 19 | Deleting a letter removes one glyph; when a glyph is two characters (`ال`, `لا`, after the team confirms them) a word spelt with the separate letters ا + ل and ending in them loses both. Rare; the fix is to keep the letters as a list, not only as text. | 6, 7 | confirm `al`, spell ا then ل, delete | cosmetic | open | code |
| 20 | **The letter gating, the `none` class and every letter setting are unmeasured.** `src/recognition/tuning.ts` holds first guesses per model type (k-NN, MLP) and alphabet; the MLP defaults are stricter because a softmax is confident also on poses it has never seen. A camera test with real hands decides them: use `?letterdebug=1` (panel + CSV log) and `docs/MODEL_HANDOFF.md`. The model only learns to answer `none` after takes labelled `none` (moving hand, relaxed hand, hand in the command zone) are recorded and it is retrained; until then the stillness and confidence rules are the only protection. | 6, 7 | `/?letterdebug=1`, sign, move the hand | annoying | open | camera |
| 21 | Before this change the app had no sound or vibration code: the repeating audio in the first camera test was the spoken "Looks like X" tip (read for every change of the guess). It is now spoken at most every 2 s, and one short tone + vibration is played per WRITTEN letter, once, with a switch (screen 14). Not tried on a real device: a phone's vibration motor and browsers that block audio before a first touch are untested. | 7, 14 | `/?letterdebug=1`, sign letters with voice on | annoying | open | code |
| 22 | The command gestures (delete, space, finish) were NOT changed: their hold times and thresholds are as before. The complaint that delete is not recognised reliably is still open; the debug panel and log now show the control gesture and its progress (`command_gesture`, `command_active`) so the cause can be seen. A letter can no longer be written while a command is in progress. | 6, 7 | hold a fist in the command zone, watch the panel | annoying | open | camera |
| 23 | **The ArSL controls (space, done static; delete, cancel dynamic) have no recordings, so no model for them exists yet**, and the static / dynamic split and the shapes / strokes are the team's to decide (`docs/CONTROLS.md`). The old rule gestures are unchanged and still the only working controls until a model with `ctl_*` classes (and `motion-arsl-dollar.json`) is trained. Why the old gestures miss is not known: use `?letterdebug=1` (the `decided_by` / `decided` / `score` columns) while using them, then decide whether a threshold is the cause. | 6, 7 | `/?letterdebug=1&alphabet=arsl`, give delete / space | annoying | open | camera |

## Adding an Arabic text-to-speech voice

If the app reports that no Arabic speech voice is installed, you can add an Arabic TTS voice to your operating system:

### Windows 10 & 11
1. Open **Settings** (`Win + I`) and go to **Time & Language** > **Speech** (or **Language & Region** > **Add a language**).
2. Under **Manage voices** (or **Installed voice packages**), click **Add voices**.
3. Search for **Arabic** (e.g. *Arabic (Egypt)* or *Arabic (Saudi Arabia)*), select the checkbox, and click **Add**.
4. Wait for the download to complete, then restart your browser so that `window.speechSynthesis.getVoices()` detects the new voice.

### macOS
1. Open **System Settings** (or System Preferences) > **Accessibility** > **Spoken Content**.
2. Click the **System Voice** dropdown menu and select **Manage Voices...**.
3. In the search field, type **Arabic**.
4. Choose an Arabic voice (e.g., *Maged*, *Laila*, *Tarik*, or *Mariam*) and click the download button.
5. Click **OK** when downloaded, then restart your browser.

### Android
1. Open **Settings** > **Accessibility** > **Text-to-speech output** (or **General Management** > **Text-to-speech**).
2. Tap the settings gear icon next to your **Preferred engine** (e.g. *Speech Services by Google*).
3. Select **Install voice data**.
4. Tap **Arabic** (e.g. *Arabic (Egypt)* or *Arabic (Saudi Arabia)*) and download the voice pack.
5. Reload the app in Chrome.
