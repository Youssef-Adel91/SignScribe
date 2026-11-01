# Phase II submission: every grading row, where it is, how to show it

The course sheet `HCI_Project_Phase_II_Fall_2026.docx`, row by row, plus the criterion the team added (content by user profile) and
the lab topics. Honest status words as everywhere in this repo: **verified here** (tests in the build environment prove the logic),
**needs real hardware / camera** (only checkable on a real machine), **not met**. Nothing below states an accuracy.

## Sheet header
| Field | Value |
| --- | --- |
| Project name | SignScribe: a camera-based interface for turning hand signs into written sentences |
| GitHub link | https://github.com/Youssef-Adel91/SignScribe |
| Trello link | **missing: add it here and on the sheet** (it is blank in the Phase I report too) |
| Figma | https://www.figma.com/design/11g6ZDeS8xInkvy58p7yMO (13 screens + flow); Phase II changes (profile colours): https://www.figma.com/design/oBk8Xo9wJL2Uj9dyOUQd0h |

| ID | Name |
| --- | --- |
| 247687 | David Nashaat |
| 247121 | Youssef Adel |
| 247223 | Mohamed Hany |
| 245999 | Moustafa Wael |
| 246977 | Youssef Wael |

(from the Phase I report; signatures and grades are filled in by hand on the day)

## Two things to settle with the TA before the day
1. **The sheet adds up to 9, not 10** (1+1+1+1+1+1+1+2). Ask what the tenth point is.
2. **Which two techniques are compared.** Phase I: spelling with signs vs picture cards. The study in the app: camera hand signs vs
   keyboard and mouse. Use one in the presentation and say why it changed (if it did).

## Row by row
| Row | Pts | What to show | Where | Status |
| --- | --- | --- | --- | --- |
| Scenario | 1 | Nour at the clinic (concrete scenario), and its Phase II variant with Bluetooth and the profile colours | `docs/phase1/SCENARIO_AND_PACT.md` (from the Phase I report) | written |
| PACT analysis | 1 | People, Activities, Context, Technology and their design implications; Phase II additions | `docs/phase1/SCENARIO_AND_PACT.md` | written |
| Survey & critical analysis | 1 | The needs survey with draft -> problem -> final for every question; the study survey (13 items + SUS + comparison) in the app; the critical analysis against the Lab 3 rules with 8 weaknesses and the fixes | `docs/phase1/SURVEY_PHASE1.md`, `docs/SURVEY_CRITIQUE.md`, `src/study/survey.ts`, `/?study=1` | written and built; **not met: nobody has answered it yet** (needs participants and a pilot) |
| Implementation of the Figma interface | 1 | The 14 screens driven by gestures only; side-by-side with the Figma frames; screen 03's new profile question also drawn in Figma | `src/screens/`, `npm run compare`, `docs/FLOW_AUDIT.md`, Figma Phase II file | verified here with the differences listed in `docs/FLOW_AUDIT.md` |
| Track the skeleton with MediaPipe and classify the movement with DollarPy | 1 | `classify_live.py`: MediaPipe Hands (21 points) + Pose (the 12 Lab 5 points), the fingertip path, dollarpy `Recognizer/Template/Point`; the letter goes over the socket to the app | `tools/dollarpy/` | verified here with simulated paths; **needs a webcam and recorded templates** |
| Use Bluetooth to capture UserID and discover | 1 | `scan.py` with Bleak: devices in range -> user id + place (+ profile), smoothed, sent to the server; never an address | `tools/bluetooth/` | verified here with a FAKE device; **needs a real adapter and a band / beacon / tag** |
| Socket programming between the parts | 1 | Python tools -> TCP -> Node server -> WebSocket -> app; app -> server -> sentence; threads in the Python client (camera reader + sender) | `server/`, `tools/common/server_link.py`, `tools/dollarpy/camera_thread.py` | verified here (real sockets in the tests) |
| Load different content based on context | 2 | The detected place loads that place's words, picture cards and sentence style; the recognised person's saved settings load; **the person's profile sets the page colours (male: blue and green, female: pink)**; light and distance advice; a visible "ignore" | `src/state/machine.ts`, `src/nlp/ContextBridge.tsx`, `src/data/contexts.json`, `src/styles/tokens.css`, `src/screens/S03Preferences.tsx` | verified here with a FAKE device; **needs real Bluetooth** for the live demo |

## Added by the team: content by user profile
"If the user is male, show the pages in blue and green; if the user is female, show the pages in pink."
- Screen 03 asks "Your profile (sets the page colours)": Male / Female / Not set. The colours change at once.
- A person found by Bluetooth gets their saved profile, or the `"gender"` from the scanner's `devices.json` the first time.
- High contrast always wins over the profile colours; every colour pair is checked for 4.5:1 (`tests/contrast.test.ts`).
- Figma: screen 03 and screen 12 in all three profiles, and the colour variables:
  https://www.figma.com/design/oBk8Xo9wJL2Uj9dyOUQd0h . The team file was view-only for the account that drew them; copy the frames
  across, or run `tools/figma/theme-recolour.js` in the team file to make male and female copies of all 13 frames.

## Lab topics in the project
| Lab | Topic | In SignScribe |
| --- | --- | --- |
| 1 | HCI, critical thinking (problem, solutions, implementation, evaluation) | the problem and users (PACT), the design (Figma), the system (this repo), the evaluation (study mode) |
| 2 | Usability rules, Figma | Figma file; every screen's Lab 2 rules in the Phase I report; the 7 rules as survey items (`nav1` ... `eff1`) |
| 3 | Bluetooth (location awareness), surveys | `tools/bluetooth/` (Bleak); the needs survey and the study survey |
| 4 | Sockets, threads | TCP + WebSocket server; `BackgroundLink` sender thread and `LatestFrame` camera thread in the DollarPy client |
| 5 | MediaPipe Hands / Pose / Holistic, DollarPy | MediaPipe Hands in the web app; Hands + Pose in `tools/dollarpy/`; dollarpy for moving letters |
| 6 | Face detection, recognition, expressions | **not used** (not on the Phase II sheet; a candidate for Phase III, e.g. recognising the user by face instead of by a Bluetooth device) |
| 10 | YOLO object detection and tracking | picture-card pipeline built (ONNX + YOLO decode + SORT); **no card detector trained** (later phase) |

## Demo on the day (about 5 minutes, FAKE mode unless you have the hardware)
    npm run demo -- --fake-device sara:Clinic:female        # server + FAKE scanner + simulated DollarPy + web app
1. Terminal: the server prints the WebSocket and TCP doors (sockets). The scanner prints `*** FAKE BLE DEVICE ***` and the server
   logs `presence: user sara, place Clinic`.
2. App: the chip "Bluetooth: sara · Clinic (demo device)"; the pages are **pink** (profile from the device list); "Clinic" is
   already chosen on screen 04 (content by context).
3. Point and hold "Wrong? ignore": the colours and the place go back.
4. Screen 03: choose Male, the pages turn blue and green; Female, pink; Not set, teal.
5. Spelling screen: "dollarpy: J (simulated)" arrives over the socket; point and hold to add it (MediaPipe + DollarPy row).
6. Say what is simulated and what is real (`tools/demo-all.md`, "Before you present").

## Still open (needs people, hardware or a decision)
- Trello link; the tenth point; which techniques are compared.
- A real camera test (`docs/PHASE2_CHECKLIST.md`), a real Bluetooth device, recorded DollarPy templates.
- Letter models: the Kaggle notebooks in `notebooks/kaggle/` train and export them; nothing is shipped in git yet.
- The survey: the wording fixes in `docs/SURVEY_CRITIQUE.md`, a pilot, then the participants.
