# DollarPy: moving letters from a webcam

Course Phase II row "Track human skeleton using MediaPipe and classify the movement using DollarPy". A Python demo like Lab 5: **MediaPipe** tracks the hand's skeleton (21 landmarks) from the webcam, the path of the **index fingertip** is cut into one movement, and the **`dollarpy`** package (`Recognizer`, `Template`, `Point`) classifies it as a moving letter (ASL J and Z; the moving letters of the active alphabet in `config/alphabets/*.json`). The recognised letter is sent to the sentence server over its TCP socket and the web app offers it on the spelling screen.

It tracks the **hand skeleton** (MediaPipe Hand Landmarker, 21 landmarks) and, by default, the **body skeleton** next to it (MediaPipe Pose Landmarker: the twelve landmarks Lab 5 uses), like Lab 5. The pose is optional: `--no-pose` uses the fingertip alone.

## Run it
    pip install -r tools/dollarpy/requirements.txt         # dollarpy, mediapipe, opencv
    npm run models                                         # MediaPipe models: the hand model, and the pose model for this tool (public/models/)

    python tools/dollarpy/record_templates.py              # 1. record your templates (default: the moving letters, 5 each)
    npm run server                                         # 2. in another terminal
    python tools/dollarpy/classify_live.py                 # 3. classify live from the webcam
    npm run dev                                            # 4. open http://localhost:5173/?server=ws://localhost:8787 and go to the spelling screen

Stand or sit so that your upper body is in the picture. The hips are usually outside a desk webcam's picture: MediaPipe then estimates them (see `--pose-min-visibility`). With `--no-pose`, only the fingertip is used.

Recording: for each letter the prompt "Draw J (take 2/5)" and a 3 s countdown, then draw the letter in the air with your index finger; the take ends when your finger slows down. Keys: `q` quit, `s` skip the letter. Templates go to `tools/dollarpy/templates.json` (git-ignored: it is a person's movement data). Use `--letters J Z --per-letter 6 --alphabet asl --camera 1 --no-window` to change things.

Classifying: with templates that were recorded with pose the program also tracks the body; with templates recorded by `--no-pose` it compares the fingertip alone and says so. Draw a letter; when the movement ends the program prints `recognised J (score 0.84) -> sent to the server`. A movement that matches nothing at `--min-score` (default 0.6, the same number as `LETTER.motionMinScore` in the web app) prints a notice. The score is dollarpy's match score `(2 - distance) / 2`, **not a probability of being right**.

In the web app (`?server=ws://localhost:8787`, localhost only): on the spelling screens a card "dollarpy: J, Point and hold here to add it" appears for 8 s. The letter is written into the message only when the person points at the card and holds, like any other choice. Letters that are not in the active alphabet are ignored.

## The pose, and what goes into the template points
This follows the Lab 5 notebook: the points come from MediaPipe **Pose** landmarks 11 and 12 (shoulders), 13 and 14 (elbows), 15 and 16 (wrists), 17 and 18 (pinky), 19 and 20 (index) and 23 and 24 (hips), **x and y only**. **Each landmark is one stroke** (`Point(x, y, stroke_id)`) and its **whole trajectory over the movement** is that stroke (one point per camera frame, nothing thinned out); then `Template(label, points)` and `Recognizer(templates).recognize(points)` as in the lab. The one addition: the **index fingertip of the hand** (MediaPipe Hand Landmarker) is one extra stroke, id 1, the pose landmarks are ids 2 to 13.

| Flag | Meaning |
| ---- | ------- |
| `--pose` / `--no-pose` | on by default. `--no-pose`: only the index fingertip path is recorded and compared (one stroke) |
| `--pose-parts shoulders elbows wrists pinky index hips` | the default is all twelve landmarks above; name fewer to use fewer |
| `--pose-min-visibility 0.5` | default 0: every landmark is used as MediaPipe gives it, like Lab 5 (MediaPipe estimates a landmark that is outside the picture, for example the hips of someone at a desk). A value above 0 drops the pose of a frame when a landmark is less visible than that |
| `--pose-model PATH` | default `public/models/pose_landmarker_lite.task` (downloaded by `npm run models`; the web app does not use it) |

dollarpy resamples the whole cloud to 32 points by path length and compares clouds as a whole, so a landmark that hardly moves (a shoulder) contributes few of the 32 points and the strokes that move most (fingertip, wrist, elbow) dominate. That is how the lab's recogniser behaves, and **how much the pose helps or hurts the fingertip alone is a guess**: it has not been compared on real recordings. Record the same letters with and without `--no-pose` and compare before trusting either.
Rules: the pose is used only when the movement has the whole pose in at least 80% of its frames (a frame without it repeats the nearest earlier one) **and** every template has the same pose landmarks; otherwise (or when dollarpy cannot resample the cloud) the fingertip alone is compared. Template files are version 2 (`pose_parts` and a `pose` per template, one point per path point; the file grows by 12 strokes); version 1 files (fingertip only) still load.

## Demo without a webcam (SIMULATED)
    python tools/dollarpy/classify_live.py --simulate J Z --synthetic-templates [--fast] [--no-send]

Feeds generated hand frames (the fingertip follows a generated hook or zig-zag, and with pose a simulated arm trails it) through the same pipeline with generated templates. It prints `*** SIMULATED INPUT ***` and `*** SYNTHETIC TEMPLATES ***`, the messages carry `"demo": true` and the app says "(simulated)". Only J and Z can be simulated. **The scores it prints say nothing about real hands.**

## Moving letters of other alphabets
`config/alphabets/arsl.json` is an unchecked template with no moving letters. Once the team has decided which Arabic letters are drawn in the air, list them under `"dynamic"` in that file (the web app, the Python tools and this demo all read it) and run `record_templates.py --alphabet arsl`.

## How a movement is cut out of the fingertip path
Same rules and numbers as `followMotion` in `src/recognition/letterController.ts` (a test compares the numbers): speed in palm lengths per second (wrist to middle knuckle); a movement starts above 1.2, ends after 250 ms below 0.5, must last 300-2000 ms and be at least 0.8 palm lengths long. These are first guesses, not tuned on real hands.

## Messages
`{"id":"l1","type":"letter","letter":"J","score":0.83,"source":"dollarpy","demo":false}` -> `{"id":"l1","ok":true,"type":"letter"}`. Fields are closed, `letter` is exactly one letter, `score` is 0..1. The server relays it to the apps, does not store or log it, and rate-limits it (`LETTER_RATE_LIMIT`, 10 per 10 s for everyone). See `server/README.md`.

## Tests
    python -m pytest tools/dollarpy        # no webcam needed

## Verified, and not
Verified here: the movement cutting on generated frames, the pose in the template points (generated body; the 12 landmarks, one whole-trajectory stroke each; save, load, fallbacks), templates (save, load, refusals), classification with the real `dollarpy` package on generated shapes, the message against the server's own parser, sending to a real TCP socket, a server that is missing or refusing, the whole chain in a browser (`npm run e2e:context`), the real MediaPipe hand tracker on a blank picture (no hand) and on three still photographs of hands (21 landmarks each), and the real MediaPipe pose tracker on a blank picture (no body) and on one still photograph of a person (the twelve Lab 5 landmarks are returned).
**Not verified: a webcam.** The pose model on a moving person in front of a webcam, whether the pose improves recognition, the recording and live loops (`cv2.VideoCapture`, the preview windows, real finger paths) were not run, no accuracy on real movements is known, and the `--simulate` scores are meaningless for real people.

## Threads (Lab 4)
The live client runs three threads, so a slow camera or a missing server never freezes the recognition:
- **camera reader** (`camera_thread.py`, `LatestFrame`): reads pictures as fast as the camera gives them and keeps only the newest
  under a lock; the main loop always works on the newest picture, and pictures it was too slow for are counted ("skipped").
- **main loop**: MediaPipe hand + pose, then dollarpy.
- **sender** (`tools/common/server_link.py`, `BackgroundLink`): a recognised letter goes into a bounded queue and the main loop goes on
  at once; one worker thread sends the queue over the TCP socket in order. A full queue drops the newest letter and counts it.
On exit it prints the counts (skipped pictures; sent / failed / dropped letters). `--simulate` keeps sending on the main thread so
the end-to-end check stays deterministic. Tests: `python -m pytest tools/dollarpy/test_threads.py` (no camera; a real TCP socket).

