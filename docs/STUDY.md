# Comparison study: camera hand signs vs keyboard and mouse

Course requirement: compare two different interaction techniques and evaluate them on user satisfaction, engagement, usability and surveys.

> **Never commit participant data to this repository (it is public).** That means the study exports (trials, survey, scores, profile, session, comparison, JSON), the recorded takes of hand landmarks, the card photographs and anything in `exports/`, `docs/reports/` or `takes/`. They are in `.gitignore` as a safety net, not as permission: keep them on an access-controlled drive, check `git status` before every commit, and if something was committed by mistake tell the team at once (deleting it in a later commit does not remove it from the history).

## Problem and target users (defined first, as Lab 3 asks)
- **Problem:** writing a short message when speech or a keyboard is not an option. SignScribe lets a person build the message with hand signs and picture cards in front of a camera.
- **Target users of the product:** people who communicate with signs (deaf or hard of hearing) and who need to write messages in everyday places (clinic, shop, work, home).
- **Participants of this study:** MSA students and acquaintances of the team. They are NOT the target users, so results say something about the interaction techniques for first-time users, not about signers. This limit must be written in the report.

## Participant information sheet
Give this to every participant (or read it out) before the session. Fill in the two places marked `<…>`.

> **SignScribe: writing a message with hand signs or with a keyboard**
>
> **What this is.** A university course project (<course, university>) comparing two ways of writing a short message: a camera that follows your hand, and a keyboard and mouse. We are testing the *program*, not you. There are no right or wrong answers. You must be 18 or older.
>
> **What you will do (about <20-30> minutes).** Answer a few questions about yourself, write three short messages with one method and answer a questionnaire, then do the same with the other method and answer a last questionnaire.
>
> **What is recorded.** Your *participant number* (not your name); your answers to the background questions (age group, writing hand, how much sign language you know, experience with gesture interfaces, comfort with keyboard and mouse); for every message the time it took, the mistakes and corrections, how many sentences you were shown, the final sentence, and whether you gave up; your questionnaire answers; and, once per session, technical details of the computer (browser, screen size, number of processor cores, the app version) plus, for the camera method, how fast the camera and hand tracking ran.
>
> **What is NOT recorded.** Your name, your face, any picture or video, or sound. The camera picture is processed inside the browser on this computer and is not saved or sent anywhere. Only the numbers that describe your hand are used, while you are using the program, and they are not stored in the study.
>
> **Words and the internet.** In this study the program works offline: your words are *not* sent to any server. (Outside the study, if the sentence server is switched on with an API key, the words you choose and the place are sent to the Anthropic API to write a nicer sentence; this is off for study sessions. Some browsers also read text aloud with an online voice, which can send the text to the browser's maker: before the first task the facilitator sets the app's voice to Silent.)
>
> **Where the data goes.** It is saved in the browser of the facilitator's computer until it is exported to a file, which is kept on <access-controlled storage> and used only for this course project and its report. The report shows summaries, never one person's answers. Data are kept until <date> and then deleted.
>
> **You can stop at any time**, without giving a reason and without any consequence: say "stop" to the facilitator, or just stop, or close the window. The facilitator ends your session ("Participant gave up") and nothing you did is kept against you. **To have your data deleted**, give the facilitator your participant number during the session or contact <name and email> afterwards, before <date>.
>
> **Questions?** <name and email of a team member and of the course instructor>.

Notes for the team:
- Check with the course instructor or TA whether the course needs an ethics review for a study with people, and keep the signed or ticked consent record with the participant number.
- The sheet is written for the study as it is built. If you turn on the sentence server, record cameras, store takes, or change what is exported, change the sheet first.
- Collection mode (`/?collect=1`) is a separate activity: it stores hand-landmark numbers. Tell those participants what is recorded (numbers describing the hand, no pictures; signer code instead of a name), and apply the same rules about 18+ and stopping.

## Design
- **Technique 1:** camera hand signs (this app). **Technique 2:** keyboard and mouse (`KeyboardTask`).
- **Within-subject:** every participant uses both. **Order counterbalanced** with a Latin square over 4 participants (`planFor`, `src/study/design.ts`): the first mode and the task set both alternate, so each mode is first for half of the people and each task set is used with each mode equally often. Use a multiple of 4 participants.
- **Task:** write a two-word message for a given place (for example "at the Clinic: doctor, help"). Three tasks per method; set A in one method and set B in the other. **The two sets share no word** (A: doctor, help, price, bag, water, medicine; B: food, family, size, pay, meeting, break), so a word typed or shown in the first method is not met again in the second. Letter counts are matched task by task (A: 10, 8, 13; B: 10, 7, 12 letters). Letter counts are only a proxy: typing and signing cost differently, and the sets also differ in place (A: clinic, shop, home; B: home, shop, work). Report this as a limit.
- Both methods use the same sentence builder and the same steps (choose place, add words, look at the sentence, accept or ask for another), so only the input differs.
- **Today the camera method can only add words with picture cards pointed at on screen.** Letter recognition (Phase 4) and card detection with a real card (Phase 5) are not built yet, so the camera numbers measure point-and-hold on picture tiles. The report must say so.

## Measures (all logged per trial, `TrialLog`)
Time (ms), corrections (delete / backspace), rejections ("try another"), backs (thumbs down), hand lost (camera), attempts, success (both target words in the final sentence), ended by (done / gave up), final text. Errors = corrections + rejections + backs.

## Surveys (`src/study/survey.ts`)
After each method, one form with **23 closed statements, the same wording for both methods** (no statement names a method; a test checks it), 5 balanced choices of equal range with a neutral middle ("Neither agree nor disagree"):
- **13 own statements**: satisfaction (3), engagement (3), usability (7, one per Lab 2 heuristic: navigation, familiarity, consistency, error prevention, feedback, visual clarity, flexibility and efficiency). **Two are reverse-worded** ("I felt frustrated while I wrote the messages with this method"; "My attention drifted away from the task while I used this method") and are flipped (6 minus the answer) before averaging. They catch people who tick the same column for everything.
- **System Usability Scale, 10 statements** (Brooke, 1996), published wording unchanged, scored 0 to 100 (odd items answer minus 1, even items 5 minus answer, sum times 2.5). The form says that "the system" means the way of writing just used. SUS gives a number comparable with other studies; cite Brooke when you use it.
After both methods: 3 questions (easier, more enjoyable, would choose), answers camera / no difference / keyboard and mouse; the two real choices swap sides for every second participant.
The analysis script flags surveys where all 23 answers are identical, or where a reverse-worded item contradicts the positive items about the same thing by 3 points or more. Flagged surveys are listed, not hidden; `--exclude-flagged` leaves them out of the survey table. **Decide the rule before you read the results.**

## Before the first task (Phase 7)
After "Start session" the participant answers five background questions (age group, writing hand, sign language, experience with gesture interfaces, comfort with keyboard and mouse) and the facilitator ticks the consent line (the participant is 18 or older, has read or heard the information sheet below, agrees, knows the data are anonymous, and can stop at any time). There is no age option below 18 because under-18s must not take part. Nothing starts without both. Each session also records, once, the computer it ran on (browser, screen, cores) and the settings (text size, contrast, hold time, voice, signing hand) and **which build** of the app (git commit), so results can be traced to the code.

## How to run a session
0. Hand out the information sheet above. Before the first task choose **Silent** for the voice on screen 14 (comfort settings): some browsers read text aloud with an online voice. Check that the browser is not signed in to a personal account and that no screen recorder is running.
1. `npm run build && npm run preview` (or `npm run dev`), open `/?study=1` (add `&dev=1` only for developers). Allow the camera. The Study console is at the bottom left.
2. Type the participant number, Start session. The console says which method comes first.
3. Camera block: before the first task let the participant do the wake-up, camera check and comfort screens (not logged). "Start task" restarts the app at the context screen with their settings kept; the trial ends when the sentence is confirmed (screen 12) or you press "Participant gave up".
4. Keyboard block: a plain form opens over the app.
5. After each block the participant fills the survey; after both, the comparison.
6. Export with the CSV / JSON buttons (Trials, Scores, Survey, Comparison, Profile, Session, and all as JSON) (also visible before the next participant). Data stays in the browser (`localStorage`) until cleared; export after every session.

## Analysis (to do with real data)
No results exist yet. Do not quote any number from this document. Suggested: paired comparison of time and errors per participant (Wilcoxon signed-rank, small n), medians of the Likert scores per dimension, and the counts of the comparison questions.

## Analysis script
    python ml/analysis/study_report.py --dir exports/ --out docs/reports/study.md
reads the CSV files and writes a report: who started with which method, time / errors / attempts / success per person (median of their tasks, then paired Wilcoxon signed-rank with exact p-values up to 25 pairs and the rank-biserial effect size), the three survey dimensions, the direct comparison questions (sign test), camera speed on the participants' computers, a summary of who took part. It warns when there are too few participants (with 5 pairs the smallest possible p is 0.0625), when sessions came from different builds, when a participant lacks one method, and when sessions were recorded in a headless test browser (test data, not people). The statistics are tested against a brute-force enumeration and against scipy (`ml/tests/test_study_report.py`).
