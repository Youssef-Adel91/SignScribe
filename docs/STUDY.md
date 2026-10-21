# Comparison study: camera hand signs vs keyboard and mouse

Course requirement: compare two different interaction techniques and evaluate them on user satisfaction, engagement, usability and surveys.

## Problem and target users (defined first, as Lab 3 asks)
- **Problem:** writing a short message when speech or a keyboard is not an option. SignScribe lets a person build the message with hand signs and picture cards in front of a camera.
- **Target users of the product:** people who communicate with signs (deaf or hard of hearing) and who need to write messages in everyday places (clinic, shop, work, home).
- **Participants of this study:** MSA students and acquaintances of the team. They are NOT the target users, so results say something about the interaction techniques for first-time users, not about signers. This limit must be written in the report.

## Design
- **Technique 1:** camera hand signs (this app). **Technique 2:** keyboard and mouse (`KeyboardTask`).
- **Within-subject:** every participant uses both. **Order counterbalanced** with a Latin square over 4 participants (`planFor`, `src/study/design.ts`): the first mode and the task set both alternate, so each mode is first for half of the people and each task set is used with each mode equally often. Use a multiple of 4 participants.
- **Task:** write a two-word message for a given place (for example "at the Clinic: doctor, help"). Three tasks per method; set A in one method and set B in the other, so nobody writes the same message twice.
- Both methods use the same sentence builder and the same steps (choose place, add words, look at the sentence, accept or ask for another), so only the input differs.
- **Today the camera method can only add words with picture cards pointed at on screen.** Letter recognition (Phase 4) and card detection with a real card (Phase 5) are not built yet, so the camera numbers measure point-and-hold on picture tiles. The report must say so.

## Measures (all logged per trial, `TrialLog`)
Time (ms), corrections (delete / backspace), rejections ("try another"), backs (thumbs down), hand lost (camera), attempts, success (both target words in the final sentence), ended by (done / gave up), final text. Errors = corrections + rejections + backs.

## Surveys (`src/study/survey.ts`)
After each method: 11 closed statements, one idea each, same wording for both methods, 5 balanced choices of equal range with a neutral middle ("Neither agree nor disagree"). 2 items satisfaction, 2 engagement, 7 usability (one per Lab 2 heuristic: navigation, familiarity, consistency, error prevention, feedback, visual clarity, flexibility and efficiency).
After both: 3 questions (easier, more enjoyable, would choose), answers camera / no difference / keyboard and mouse; the two real choices swap sides for every second participant.

## How to run a session
1. `npm run build && npm run preview` (or `npm run dev`), open `/?study=1` (add `&dev=1` only for developers). Allow the camera. The Study console is at the bottom left.
2. Type the participant number, Start session. The console says which method comes first.
3. Camera block: before the first task let the participant do the wake-up, camera check and comfort screens (not logged). "Start task" restarts the app at the context screen with their settings kept; the trial ends when the sentence is confirmed (screen 12) or you press "Participant gave up".
4. Keyboard block: a plain form opens over the app.
5. After each block the participant fills the survey; after both, the comparison.
6. Export with the CSV / JSON buttons (also visible before the next participant). Data stays in the browser (`localStorage`) until cleared; export after every session.

## Analysis (to do with real data)
No results exist yet. Do not quote any number from this document. Suggested: paired comparison of time and errors per participant (Wilcoxon signed-rank, small n), medians of the Likert scores per dimension, and the counts of the comparison questions.
