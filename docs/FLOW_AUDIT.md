# Flow audit: Figma vs built app

> **Status (branch fix/flow-blockers):** the three blockers are fixed: **F1** (size tokens `--s-44`, `--s-72` defined, with a test that every `var(--s-N)` is defined), **F2** (screen 11 now has "Add a card" and "Spell more" point-and-hold targets that keep the words) and **F6** (screen 08 offers one hint, "Bring your hand back", and says what to check after 10 s without a hand; there is still no second way out because every exit needs a hand). Correction: F1 is **not** the cause of console issue #4 (the `<svg>` width errors are still printed, because the attribute itself is invalid). Everything else below is still open.

Date: 2026-10-22. Branch `docs/flow-audit`. **Audit only: no application code was changed.**
Figma file `11g6ZDeS8xInkvy58p7yMO`, page "Screens" (13 frames) and page "Flow" (intended order).

## How it was done (and what it can not tell you)

| Method | Used for | Status |
| ------ | -------- | ------ |
| `get_design_context` for all 13 frames | exact copy, hints, icons, states, colours | verified here |
| `npm run compare` (1440x900, design left, app right) | layout, icon size, spacing | verified here (looked at all 13 by eye; no pixel metric) |
| Source read of `src/state/machine.ts` and `commandEvent()` in `src/vision/controller.ts` | which gesture/dwell does what on which screen | verified here |
| Mock-hand walk (Playwright, `?dev=1&vision=mock`): hints on all 14 screens, held thumbs-up 11 -> 12, Finish, Cancel from 07, hand lost 06 -> 08 | dead ends, missing back paths | verified here (synthetic hands: proves logic only) |
| Real camera | anything about feel, fps, misfires | **needs my camera, not done** |

The compare screenshots show the dev "Vision debug" panel on top of the left part of the app (it only exists with `?dev=1`). It is not a finding.

## Table 1: per screen (Figma vs built, and flow problem)

Severity: **blocker** (user cannot continue or cannot understand an error) · **annoying** · **cosmetic**.

| Screen | Figma vs built differences | Flow problem | Sev. | Proposed fix |
| ------ | -------------------------- | ------------ | ---- | ------------ |
| 01 Welcome | Copy, chips, headline match. Built adds a gesture hint bar (Figma has none) with a "Suggested" badge. Hold ring is larger and thicker than Figma. | Fine: only action is "open hand 2 s", it is shown. No way to read what "Suggested" means (new element, not in Figma). | cosmetic | Keep hint bar (it is the only place the gesture is shown); shrink ring to Figma size. |
| 02 Camera check | Copy and three check cards match. Built adds a "Back" hint (Figma has only "Hold still"). Camera frame is larger and the hand drawing bigger. | Back goes to 01. Good. Nothing says what to do when a check stays amber for a long time (the line "Spoken tip" repeats the same tip). | cosmetic | None needed; maybe show a "Still not green? Ask for help" line after 15 s (needs a decision). |
| 03 Preferences | (Phase II, after this audit: a third question "Your profile" with Male / Female / Not set sets the page colours; drawn in https://www.figma.com/design/oBk8Xo9wJL2Uj9dyOUQd0h because the team file is view-only for the account that made it.) Figma frame has two big hand tiles and three alphabet tiles that are all selectable. Built shows smaller tiles, and "Arabic" and "More..." are dashed with a "Coming soon" tag and cannot be chosen. Footer: Figma "Point and hold: choose / Continue / Back"; built same. | Next screen is NOT 04 as in Figma but 14 (Comfort, not in Figma). The footer label is "Continue" here but "Yes" on 04 and 05 for the same thumbs-up. | annoying | Use one label ("Continue") on 03, 14, 04, 05. Decide if 14 stays (see Table 2, F8). |
| 04 Context | Copy matches. Figma shows the hold ring on the Clinic tile and small icons. Built icons are huge (`--s-44` is not defined, see Table 2, F1). | Choosing a tile does not move on: the user must also show thumbs-up ("Yes"). In Figma the flow arrow says "point + hold" for 03 -> 04 -> 05. | annoying | Either make point-and-hold on a tile also advance (as in Figma) or say "Then thumbs up: continue" next to the tiles. |
| 05 Method | Matches well. Built "cross" in the card preview is larger (`--s-72` undefined). Default is "Spell with signs", pre-selected. | On a real camera with no letter model the pre-selected default leads to a screen that cannot read letters (Table 2, F3). Figma has no "not available" state. | blocker (until model exists) | When `letters.status` is `missing`, pre-select "Show a picture card" and put "Needs the letter model" on the Spell tile. UI only, no model work. |
| 06 Spell ready | Matches. Command zone title wraps onto two lines in built; only Space/Delete visible next to the debug panel in the screenshot, all four are present in the DOM. | Cancel (thumbs-down) on 06 goes back to 05 but keeps the letters (F4). Done (thumbs-up) on an empty message does nothing and says nothing. | annoying | Show "Nothing to finish yet" for an empty Done; make Cancel clear the letters or say "Letters kept". |
| 07 Spell recognizing | Matches (L ring, guesses, confirm time). | Cancel here only clears the guess (to 06); a second Cancel leaves the screen. Two different results for one gesture, but both are shown in the hint "Cancel". | cosmetic | Label the first one "Cancel guess" while a guess is shown. |
| 08 Hand lost | Figma: yellow card with a small warning icon, heading "We lost your hand" and one line, "Put your hand here" caption. **Built: the warning icon renders at the full size of the panel and pushes the heading out of the camera view: the words "We lost your hand" are cut off** (F1). Right-hand list matches. | The hint bar still shows Space / Delete / Done / Cancel as if usable, but none of them work while the hand is lost (verified: `commandEvent` returns null on 08 and `idle` is false). The only way out is to bring the hand back; there is no timeout or other way out (F6). | blocker | Define the missing tokens (F1). Replace the hints on 08 with one hint, "Bring your hand back". |
| 09 Word suggestion | Matches (copy, "Did you mean", three actions, ring on Done). Built adds a "Suggested" badge on the Yes tile. Figma caption "Thumbs up in the command zone = Yes" is present. | Delete letters (fist) re-opens the word minus its last letter. Same gesture means something different here than on 06, 10, 11 (F9). | annoying | Wording: "Edit word" for 09. |
| 10 Picture card | Matches (detection box, Tracking #1, "Hold the card still to add"). | Works without a detector because the six cards are also dwell targets (6 targets). Cancel goes back to 05 without clearing the words (like F4). | annoying | Same as F4. |
| 11 Review sentence | Figma "Clinic style" pill sits next to the heading; built puts it right-aligned. Built adds a line "Written by simple rules from your words." (honest, good). Camera panel shows the hand in a smaller picture. | The line "Need to add more? Show a card or spell a word." has no gesture, dwell target or hint behind it (F2). Fist ("Delete last word") with one word left clears the whole message and jumps to 05 without warning (F9). | blocker (F2) / annoying (F9) | F2: add two dwell targets "Add a card" / "Spell more", or remove the line. F9: confirm or undo. |
| 12 Share | Matches almost exactly (card, size, "Reading aloud...", hints). | Thumbs-up = Finish wipes the message and goes straight to 01 with no confirmation (verified: 1.5 s thumbs-up on 12 -> screen 1). Holding thumbs-up from 11 does NOT trigger Finish by accident (verified: 5 s held -> stays on 12). "Reading aloud..." is shown even if voice is off (F10). | annoying | Finish: keep the message for 5 s with "Message cleared. Undo", or require a longer hold. Show the chip only when speech is really running. |
| 13 Gesture guide | Copy, six cards, tags match. Built chip says "Both hands up: Close" (Figma "Help"), which is correct. Hint "Point and hold: choose" is as in Figma. | The page has no point targets, so "Point and hold: choose" does nothing. Thumbs-down also closes it but only thumbs-up is shown. The Delete card says "Undo is offered": there is no undo anywhere in the app (F5). | annoying | Remove the hint or add a "Close" dwell tile; show both Yes and No as close; remove "Undo is offered" until undo exists. |
| 14 Comfort (no Figma frame) | Not designed. 11 dwell targets on one screen, same style as 03. | Adds a whole screen and one more thumbs-up between 03 and 04. Figma flow goes 03 -> 04. | annoying | Product decision: keep (needed for text size and contrast) but design it in Figma. |

## Table 2: flow problems across screens

| ID | Problem | Where | How it was checked | Sev. |
| -- | ------- | ----- | ------------------ | ---- |
| F1 | Tokens `--s-44` and `--s-72` are used (`S04Context.tsx:60`, `S08HandLost.tsx:56`, `S05Method.tsx:99`, `InfoRow.module.css`) but not defined in `src/styles/tokens.css`. The icon size is then invalid and the SVG fills its box. This is also the cause of console issue #4 (so #4 is not only cosmetic). | 04, 05, 08 | compare screenshots; grep of defined tokens | blocker (08) |
| F2 | "Need to add more? Show a card or spell a word." on 11 promises a function. `CHOOSE_METHOD` from the review screen is sent only by the dev panel; the card controller runs only on 10. | 11 | grep `CHOOSE_METHOD`; read `controller.ts` | blocker |
| F3 | With no letter model (current state) the Spell path cannot make a word on a real camera. The notice says so, but 05 still pre-selects Spell. Not a code bug, a missing model (docs/MODEL_HANDOFF.md). | 05, 06, 07 | `LetterNotice` text seen in the mock walk | blocker until model |
| F4 | Cancel/back keeps the typed letters or cards in memory: 07 -> 06 -> 05 -> back to 06 shows "HE" again. Cancel does not cancel. | 06, 10 | mock walk: down, down, up -> message still "HE" | annoying |
| F5 | The guide says "Undo is offered" for Delete. No undo exists. | 13 | grep "undo" in `src` | annoying |
| F6 | Hand lost (08) has no timeout and no second way out. Commands are disabled; the hint bar still shows them. | 08 | `machine.ts`, `commandEvent`, hint inventory | blocker |
| F7 | Hints that do nothing: "Done" on empty 06, "Point and hold: choose" on 13, 08 hint bar. A hint with no effect and no feedback breaks "Feedback" and "Error prevention". | 06, 08, 13 | mock walk, hint inventory | annoying |
| F8 | Choosing and advancing are two actions (point-and-hold, then thumbs-up) on 03, 14, 04, 05. Figma shows point + hold as the way forward. Footer label differs: "Continue" (03, 14) vs "Yes" (04, 05). Screen 14 is not in Figma. | 03-05, 14 | hint inventory, Figma Flow page | annoying |
| F9 | Fist "Delete" does five different things: last letter, then last word (06/07); re-open word (09); last card (10); last word, or everything plus jump to 05 when one word is left (11). No confirmation or undo. | 06-11 | `machine.ts` | annoying |
| F10 | Finish (12) clears and jumps to 01 at once. "Reading aloud..." shown without checking voice setting. No "read again" action. | 12 | mock walk; `S12Share.tsx` | annoying |

## Top 10 (also in docs/KNOWN_ISSUES.md as #5 to #14)

1. F1 Missing size tokens: hand-lost message cut off, oversized icons on 04/05/08.
2. F2 "Add more" instruction on 11 has nothing behind it.
3. F6 Hand-lost screen: dead hints, no timeout, one exit.
4. F3 Spell is pre-selected but cannot work until the model exists.
5. F4 Cancel keeps the letters / cards.
6. F10 Finish wipes the message with no undo; "Reading aloud" always shown.
7. F9 Fist Delete is inconsistent and can silently clear the whole message.
8. F5 "Undo is offered" is not true.
9. F8 Choose-then-confirm vs Figma's point-and-hold; "Yes" vs "Continue"; undesigned screen 14.
10. F7 Hints that do nothing (empty Done on 06, "Point and hold" on 13).

Cosmetic differences (not in the top 10): 03 alphabet tiles are disabled and smaller than Figma; 01 ring size; 11 "Clinic style" pill position; "Suggested" badge is new; 06 command zone title wraps.

## Not checked

Real camera behaviour, permission-denied and no-camera paths with a real browser prompt, the "Extra large" text size, study mode screens, and the sentence server flow. Figma frame 11 shows the "How to answer" card; the card matches, only the missing function (F2) is a problem.
