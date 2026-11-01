# Scenario and PACT analysis (from the Phase I submission)

Copied from the team's Phase I report (`SignScribe_HCI_Phase_I_Submission.pdf`, sections 3.0 to 3.6) so that the two Phase II rows
"Scenario" and "PACT analysis" can be read next to the code. The PDF itself is not in the repository. Only the layout was changed.

Team: 247687 David Nashaat, 247121 Youssef Adel, 247223 Mohamed Hany, 245999 Moustafa Wael, 246977 Youssef Wael.

> **One difference from the code, to settle before Phase II is graded:** the Phase I report compares *spelling with signs*
> (technique A) with *picture cards* (technique B). The study built in `src/study/` compares *camera hand signs* with
> *keyboard and mouse* (decided later, `CLAUDE.md`). Say which comparison the Phase II submission uses, and update the other
> document so they agree (see `docs/PHASE2_SUBMISSION.md`).

## PACT analysis

We used PACT (People, Activities, Context, Technology) to understand who we design for and what that means for the interface.

### People
- **Who:** Deaf and hard-of-hearing adults (mainly 18 to 45) who sign and sometimes need to talk with hearing people. The second
  group is the hearing person who reads the result (receptionist, shop worker, colleague).
- **Physical differences:** users hear little or nothing, so all feedback must be visual first. Hands are their main way to
  communicate, so hand movement is natural and quick for them. Hand size, skin tone and signing style differ between people, and
  some users are left-handed.
- **Psychological differences:** many users are very good at signing but do not always read or write long sentences easily in a
  written language that is not their first language, so the text we show must be short and clear. Some users are tired of being
  misunderstood, so the system must be calm, must not blame them, and must let them fix mistakes easily.
- **Social differences:** users may feel shy or under pressure when other people are waiting. Privacy matters because a camera is
  on. The hearing person usually has no training and only a few seconds.
- **Design implications:** large targets, few choices, visual and spoken feedback, easy undo, a signing-hand setting, and a result
  screen made for a person who has never used the app.

### Activities
- **Purpose:** build a short written message (a word, a phrase or one sentence) and show it to another person.
- **Temporal aspects:** short and often interrupted use, usually under 2 minutes, at unpredictable times. There is no long session.
- **Cooperation:** two people are involved, the signer and the reader. The signer builds the message, the reader gets it.
- **Complexity:** the main task is simple (sign, confirm, share) but there are many small steps. We keep every step to one gesture.
- **Safety and errors:** a wrong word in a medical place can be serious, so the sentence is never shown until the user confirms it.
- **Content:** letters, short words, picture cards and sentences. Context (clinic, shop, work, home) changes the word list.

### Context
- **Physical:** a desk or counter with a webcam, indoor light that can be dim or strong from a window, the user standing or sitting
  at about one metre. Noise is not a problem for input because we do not use sound, but it matters for the spoken output.
- **Social:** other people may be watching or waiting. The user must not feel rushed. The screen shows the final text large so the
  other person can read it from the side.
- **Organisational:** clinics, shops and offices have their own words, so SignScribe uses a context choice. Some places will not
  allow video recording, so processing is done on the device and nothing is recorded.

### Technology
- **Input:** webcam only. Hand landmark tracking (MediaPipe Hands) finds 21 points on each hand. A classifier turns the landmarks
  into letters and control gestures. Object detection and tracking (a YOLO-type detector plus a tracker) finds and follows picture
  cards.
- **Processing:** dictionary correction first, then a language model that suggests a sentence. The user always confirms.
- **Output:** large text, colour and ring animations, and speech. A screen with large text is the main output because the user needs
  visual output.
- **Constraints:** one fixed camera, no touchscreen, no keyboard, no mouse. Recognition errors will happen, so the design needs
  confirmation, alternatives and undo. The browser asks for camera permission once; that is a one-time setup step.
- **Data:** public sign alphabet data exists but many datasets only contain still letters. Letters with movement need video data,
  and we will collect a small set ourselves if needed.

### Added in Phase II (not in the Phase I report)
- **People / Context:** the person's profile (Male, Female or Not set, screen 03) sets the page colours (blue and green, pink, or the
  standard teal). A person recognised by Bluetooth gets their saved profile, or the one in the scanner's device list, before the
  message starts. High contrast always wins over these colours.
- **Technology:** Bluetooth Low Energy (a band, beacon or tag) gives the user id and the place; the parts talk over sockets
  (WebSocket for the app, TCP for the Python tools). See `docs/PHASE2_SUBMISSION.md`.

## Scenario

### Conceptual scenario
A Deaf person needs to explain something quickly to a hearing person in a public place, such as a clinic reception or a shop
counter. Writing on a phone is slow, the hearing person often has no time or patience, and there is no interpreter nearby. The
person opens SignScribe on a laptop or kiosk that has a camera. They show a few signs and gestures. The system turns the signs into
a sentence, the person approves it, and the other person reads it on the screen and hears it aloud. The conversation goes on
without anyone touching the device.

### Concrete scenario
**Persona:** Nour is 24, studies accounting and is Deaf. She uses sign language every day with her family and friends but only a
few people at her clinic know it. She has a sore throat and goes to a clinic in Giza by herself. A tablet stand with a webcam is
placed on the reception desk and runs SignScribe. The receptionist, Mr. Hassan, does not know sign language.

1. **Start.** Nour stands about one metre from the camera and raises her open hand for two seconds. The ring around her hand fills
   and the app wakes up (screen 01).
2. **Setup check.** The app checks the light, her distance and whether her whole hand is visible. It says the distance is a bit far
   and also speaks the tip. Nour steps closer and all three checks turn green (screen 02). It remembers that she signs with her
   right hand (screen 03).
3. **Context.** She points at "Clinic" and holds for a moment, so the app prepares medical words and picture cards (screen 04).
4. **Choose a method.** She chooses "Spell with signs" for her name and a picture card for the medical words (screen 05).
5. **Spell.** She signs H, E, L, O. After each letter she holds still and the ring fills (screens 06 and 07). The app notices "HELO"
   is not a clinic word and offers "HELLO". She answers with a thumbs-up in the command zone (screen 09).
6. **Picture card.** She holds up the printed "Doctor" card. A green box follows the card and the app adds "doctor" after she holds
   it still (screen 10).
7. **Review.** The app shows her words and a suggested sentence: "Hello, I need a doctor." Nothing is shown to Mr. Hassan yet. Nour
   gives a thumbs-up (screen 11).
8. **Share.** The sentence appears in very large text for Mr. Hassan and is read aloud. He reads it, nods and calls the nurse
   (screen 12).
9. **If something goes wrong.** Halfway through, Nour turns to look at the door and her hand leaves the frame. The screen dims, shows
   "We lost your hand" and keeps her letters. When her hand returns, spelling continues (screen 08). If she forgets a gesture she
   raises both hands and sees the guide (screen 13).

**Goal of the scenario:** Nour tells the receptionist what she needs in under two minutes, without typing, without touching a
screen and without a sign language interpreter.

### Phase II variant of the same scenario (profile and Bluetooth)
Nour wears her fitness band, listed in the clinic's `devices.json` as `nour` with `"gender": "female"`, and the reception desk has
a clinic beacon. When she walks up, the scanner finds both. Before she starts, the app loads "Clinic" and her profile, so the pages
are pink and her right-hand setting is already chosen; a label at the top says who and where was detected, and she can point at
"Wrong? ignore" to undo it. Her brother Omar uses the same kiosk later with his own band (`"gender": "male"`): the pages are blue and
green for him. A visitor with no known device gets the standard colours and chooses everything on screens 03 and 04 as before.
