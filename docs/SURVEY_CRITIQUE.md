# Survey and critical analysis (Phase II row "Survey & Critical Analysis")

Two questionnaires belong to SignScribe:

1. **The needs survey** (before design, Phase I report section 4, copied in `docs/phase1/SURVEY_PHASE1.md`): six questions to Deaf
   and hard-of-hearing adults about how often and where communication is hard, what they use now, and how they feel about a camera
   and hands-only control. Each question has a first draft, the problem with it, and the final wording.
2. **The study survey** (after each method, built into the app, `src/study/survey.ts`, `src/study/profile.ts`): background
   questions, 13 items on satisfaction, engagement and usability, the 10-item System Usability Scale (SUS), and 3 comparison
   questions after both methods.

This file checks the **study survey** against the Lab 3 rules, says what is good, what is weak, and what to change before the first
participant. No answers exist yet (nobody has taken part), so nothing here is a result.

## The Lab 3 rules, one by one

| Lab 3 rule | Study survey | Verdict |
| --- | --- | --- |
| Start with the problem | `docs/STUDY.md`: writing a short message when speech or a keyboard is not an option; compare camera hand signs with keyboard and mouse on satisfaction, engagement and usability | met |
| Identify the target users | The target users are Deaf and hard-of-hearing adults (PACT). **The study participants are MSA students and acquaintances, mostly hearing** (`docs/STUDY.md`) | met for the definition; **a real limit for the results** (see below) |
| Closed questions | All 13 items, the 10 SUS items, the 5 background questions and the 3 comparison questions are closed. There is no open question | met (Lab 3: open questions are hard to analyse) |
| Specific questions (one idea each) | 12 of 13 items ask one thing; `fee1` asks two (see below) | mostly met |
| Not biased (no leading words) | No praise or blame words; the method is named the same way for both ("this method"); 2 of 13 items are worded negatively (`sat3`, `eng3`) so agreeing is not always the "good" answer; SUS alternates positive and negative | met |
| Balanced choices of equal range | One 5-point agreement scale for all items: Strongly disagree / Disagree / Neither agree nor disagree / Agree / Strongly agree. Age groups 18-24, 25-34, 35-44, 45+ (10-year ranges after the first) | met |
| A neutral middle | "Neither agree nor disagree" on every item; "No difference" in the middle of every comparison question, and the two real answers swap sides for every second participant so the position does not favour one method | met |

## What is good
- **Same wording for both methods.** Each participant answers the same items after the camera block and after the keyboard block,
  so the two sets of answers can be compared item by item (within-subject design, order counterbalanced with a Latin square over 4).
- **A standard scale next to our own items.** SUS (Brooke, 1996) is published, unchanged and scored 0-100, so our usability numbers
  can be compared with other systems. Our own items map to the three course dimensions and to the seven Lab 2 usability rules
  (`nav1`, `fam1`, `con1`, `err1`, `fee1`, `vis1`, `eff1`).
- **Reverse-worded items** (`sat3`, `eng3`) catch people who agree with everything; they are flipped when scored (`oriented()`).
- **Measured behaviour next to opinions.** Time per message, mistakes, corrections and give-ups are logged for every trial, so an
  answer such as "I could finish a message as fast as I wanted to" can be read next to the time it really took.
- **No personal data.** A participant is a number; no name, picture or video is stored; under-18s cannot take part.

## What is weak (critical analysis)
1. **`fee1` asks two things.** "The system showed me straight away *what it had understood*" mixes speed ("straight away") and
   content ("what it had understood"). A participant who saw the right letter late cannot answer it honestly. Split it into
   "The system responded straight away" and "I could see what the system had understood".
2. **`err1` cannot be answered by someone who made no mistake.** "It was easy to correct a mistake" forces a person with no
   mistakes to pick the neutral middle, which then mixes "no opinion" with "did not happen". Add a separate choice "I did not need
   to correct anything" (outside the scale, not scored), or ask it only when the log shows a correction.
3. **`fam1` measures the person, not the design.** "This method felt familiar to me" will favour the keyboard for every hearing
   student, whatever the camera interface does, because nobody has used a sign-language interface before. Keep it (familiarity is a
   Lab 2 rule) but read it next to the background question on earlier gesture interfaces, and do not count it as a design result.
4. **The participants are not the target users.** The needs survey and the PACT are about Deaf signers; the study runs with hearing
   students who do not sign. Their answers say how first-time users find the two **interaction techniques**, not whether SignScribe
   helps Deaf people. The report must say so (already required in `docs/STUDY.md`).
5. **The camera method today measures point-and-hold on picture tiles.** No letter model is trained yet, so in a session the camera
   method builds words from picture cards pointed at on the screen (or with Wizard of Oz). Satisfaction with "camera hand signs"
   would then be satisfaction with pointing, not with signing. Either train the letter model first (`notebooks/kaggle/`), or name
   the method honestly in the report.
6. **Length.** 13 + 10 items after each method plus 5 + 3 = 54 answers per participant. Fatigue makes the second block less careful.
   The order of the two blocks is counterbalanced, which spreads the effect evenly, but a pilot should time it.
7. **The two documents compare different techniques.** The Phase I report compares spelling with picture cards; the study compares
   camera with keyboard and mouse. Pick one for the Phase II submission (`docs/PHASE2_SUBMISSION.md`).
8. **No pilot yet.** Lab 3 and the Phase I report both plan a pilot with two or three people to find confusing wording. It has not
   happened.

## Changes recommended before the first participant
| # | Change | Who decides |
| --- | --- | --- |
| 1 | Split `fee1` into a speed item and an "understood" item | team (wording) |
| 2 | Give `err1` a "did not need to correct anything" choice outside the scale | team (wording) |
| 3 | Keep `fam1`, report it next to the gesture-experience background question | team |
| 4 | Pilot with 2-3 people, time it, fix wording | team |
| 5 | Name the camera method as it really works on the day (signs, pointing at cards, or Wizard of Oz) | team |
| 6 | Run at least 8 participants (a multiple of 4 for the Latin square); export after every session; `ml/analysis/study_report.py` | team |

These are wording decisions for the team and the TA (the survey wording "needs a human review", `docs/PROJECT_STATUS.md`). The code
was not changed by this analysis.
