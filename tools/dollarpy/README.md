# DollarPy: moving letters from a webcam

Course Phase II row "Track human skeleton using MediaPipe and classify the movement using DollarPy". A Python demo like Lab 5: **MediaPipe** tracks the hand's skeleton (21 landmarks) from the webcam, the path of the **index fingertip** is cut into one movement, and the **`dollarpy`** package (`Recognizer`, `Template`, `Point`) classifies it as a moving letter (ASL J and Z; the moving letters of the active alphabet in `config/alphabets/*.json`). The recognised letter is sent to the sentence server over its TCP socket and the web app offers it on the spelling screen.

What it tracks is the **hand** skeleton, not the whole body (the sheet says "human skeleton"; a hand is what a sign-language app needs). Body tracking would need MediaPipe Pose and its own model: not done.

## Run it
    pip install -r tools/dollarpy/requirements.txt         # dollarpy, mediapipe, opencv
    npm run models                                         # the MediaPipe hand model (public/models/hand_landmarker.task)

    python tools/dollarpy/record_templates.py              # 1. record your templates (default: the moving letters, 5 each)
    npm run server                                         # 2. in another terminal
    python tools/dollarpy/classify_live.py                 # 3. classify live from the webcam
    npm run dev                                            # 4. open http://localhost:5173/?server=ws://localhost:8787 and go to the spelling screen

Recording: for each letter the prompt "Draw J (take 2/5)" and a 3 s countdown, then draw the letter in the air with your index finger; the take ends when your finger slows down. Keys: `q` quit, `s` skip the letter. Templates go to `tools/dollarpy/templates.json` (git-ignored: it is a person's movement data). Use `--letters J Z --per-letter 6 --alphabet asl --camera 1 --no-window` to change things.

Classifying: draw a letter; when the movement ends the program prints `recognised J (score 0.84) -> sent to the server`. A movement that matches nothing at `--min-score` (default 0.6, the same number as `LETTER.motionMinScore` in the web app) prints a notice. The score is dollarpy's match score `(2 - distance) / 2`, **not a probability of being right**.

In the web app (`?server=ws://localhost:8787`, localhost only): on the spelling screens a card "dollarpy: J, Point and hold here to add it" appears for 8 s. The letter is written into the message only when the person points at the card and holds, like any other choice. Letters that are not in the active alphabet are ignored.

## Demo without a webcam (SIMULATED)
    python tools/dollarpy/classify_live.py --simulate J Z --synthetic-templates [--fast] [--no-send]

Feeds generated hand frames (the fingertip follows a generated hook or zig-zag) through the same pipeline with generated templates. It prints `*** SIMULATED INPUT ***` and `*** SYNTHETIC TEMPLATES ***`, the messages carry `"demo": true` and the app says "(simulated)". Only J and Z can be simulated. **The scores it prints say nothing about real hands.**

## Moving letters of other alphabets
`config/alphabets/arsl.json` is an unchecked template with no moving letters. Once the team has decided which Arabic letters are drawn in the air, list them under `"dynamic"` in that file (the web app, the Python tools and this demo all read it) and run `record_templates.py --alphabet arsl`.

## How a movement is cut out of the fingertip path
Same rules and numbers as `followMotion` in `src/recognition/letterController.ts` (a test compares the numbers): speed in palm lengths per second (wrist to middle knuckle); a movement starts above 1.2, ends after 250 ms below 0.5, must last 300-2000 ms and be at least 0.8 palm lengths long. These are first guesses, not tuned on real hands.

## Messages
`{"id":"l1","type":"letter","letter":"J","score":0.83,"source":"dollarpy","demo":false}` -> `{"id":"l1","ok":true,"type":"letter"}`. Fields are closed, `letter` is exactly one letter, `score` is 0..1. The server relays it to the apps, does not store or log it, and rate-limits it (`LETTER_RATE_LIMIT`, 10 per 10 s for everyone). See `server/README.md`.

## Tests
    python -m pytest tools/dollarpy        # no webcam needed

## Verified, and not
Verified here: the movement cutting on generated frames, templates (save, load, refusals), classification with the real `dollarpy` package on generated shapes, the message against the server's own parser, sending to a real TCP socket, a server that is missing or refusing, the whole chain in a browser (`npm run e2e:context`), and the real MediaPipe hand tracker on a blank picture (no hand) and on three still photographs of hands (21 landmarks each).
**Not verified: a webcam.** The recording and live loops (`cv2.VideoCapture`, the preview windows, real finger paths) were not run, no accuracy on real movements is known, and the `--simulate` scores are meaningless for real people.
