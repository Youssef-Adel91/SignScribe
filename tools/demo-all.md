# Demo script: everything running together

For the Phase II demo. One command starts the sentence server, the Bluetooth scanner, the DollarPy client and the web app; or start them one by one in four terminals. **Say clearly which mode you are in.** The FAKE mode proves the software chain, not the hardware.

## One command
    npm ci && pip install -r tools/bluetooth/requirements.txt -r tools/dollarpy/requirements.txt     # once
    npm run models                                                                                    # once (MediaPipe hand and pose models)

    npm run demo                       # FAKE: a SIMULATED Bluetooth device and SIMULATED hand paths, no hardware
    npm run demo -- --real             # REAL: your Bluetooth adapter + your webcam (needs devices.json and recorded templates)
    npm run demo -- --check            # starts everything in FAKE mode, waits until the chain works, prints PASS/FAIL, stops

Options: `--fake-device sara:Shop` (or `sara:Clinic:female` to show the profile colours: pink pages), `--letters "J"`, `--python path/to/venv/python`, `--no-web`. Then open the address it prints (`http://localhost:5173/?server=ws://localhost:8787`, add `&dev=1` for the developer panels).

## The same thing by hand (four terminals)
| Terminal | FAKE (no hardware) | REAL |
| -------- | ------------------ | ---- |
| 1 server | `npm run server` | `npm run server` |
| 2 web app | `npm run dev` | `npm run dev` |
| 3 Bluetooth | `python tools/bluetooth/scan.py --fake youssef:Clinic` | `cp tools/bluetooth/devices.example.json tools/bluetooth/devices.json`, edit it, then `python tools/bluetooth/scan.py -v` |
| 4 DollarPy | `python tools/dollarpy/classify_live.py --simulate J Z --synthetic-templates` | `python tools/dollarpy/record_templates.py` once, then `python tools/dollarpy/classify_live.py` |

Open `http://localhost:5173/?server=ws://localhost:8787` (the server address is accepted only for localhost). The camera asks for permission; the app itself is controlled with the hands, as always.

## What to show, in order (and which grading row it is)
1. **Server (socket programming).** Terminal 1 prints the two doors: WebSocket for the app, plain TCP for Python. Show `python server/examples/client.py doctor help` getting a JSON answer: "Python talks to the server with the socket module, one JSON line per message".
2. **Bluetooth (UserID and discovery).** Start the scanner. The server log says `presence: user youssef, place Clinic`. In the app a chip `Bluetooth: youssef · Clinic (demo device)` appears in the top bar **on every screen**. FAKE: the chip says "(demo device)" on purpose. REAL: carry the device you listed in `devices.json` near the computer.
3. **Load different content based on context.** On "Where are you today?" the detected place is already selected. Run the fake scanner with another place (`--fake youssef:Shop`) and show the Shop words and cards; with a saved profile (change the text size once while detected) the person's settings come back next time. Show the override: point and hold on "Wrong? Point and hold here to ignore": place and settings go back. Stop the scanner: after about 15 s the chip disappears and the app works exactly as before.
4. **MediaPipe + DollarPy.** Go to the spelling screen. FAKE: the client prints `recognised J` and a card "dollarpy: J (simulated)" appears; point and hold to add it. REAL: draw J or Z in the air with the index finger. Say what it tracks: the hand skeleton (21 landmarks) and the twelve Lab 5 pose landmarks (MediaPipe Pose, `--no-pose` to switch off), the fingertip path, `Recognizer/Template/Point` from the dollarpy package.
5. **Profile colours (added Phase II criterion).** Start with `--fake-device sara:Clinic:female`: the pages are pink before the message starts. On screen 03 choose Male (blue and green) or Not set (teal).
6. **Figma interface, PACT, scenario, survey.** Not part of these tools: see `docs/PHASE2_SUBMISSION.md` (all rows, the demo on the day) and `docs/phase1/`.

## Before you present (checklist)
- [ ] `npm run demo -- --check` prints three PASS lines.
- [ ] `python -m pytest tools/bluetooth tools/dollarpy` passes.
- [ ] REAL only: your devices are in `devices.json`, Bluetooth is on, templates are recorded (`tools/dollarpy/templates.json`), the room is lit, `npm run models` was run.
- [ ] You decided what to say about FAKE: "this is a simulated device and simulated hand paths so the demo works without hardware; the code path from the server to the screen is the real one".
- [ ] `tools/bluetooth/devices.json` and `tools/dollarpy/templates.json` are **not** committed (they are git-ignored).

## If something does not work
| Symptom | Likely cause |
| ------- | ------------ |
| No `Bluetooth:` chip | the page has no `?server=ws://localhost:8787`; or the scanner could not reach the server (look at terminal 3); or an old tab still holds the previous state: reload |
| `Bluetooth is off or not available` | switch Bluetooth on; on Linux `bluez` must run |
| The chip says "demo device" and you wanted real | you started the FAKE scanner; use `--real` |
| No letter card | the page must be on the spelling screens (6, 7); the card stays 8 s; the letter must be in the active alphabet |
| `dollarpy` / `bleak` not found | `pip install -r tools/dollarpy/requirements.txt -r tools/bluetooth/requirements.txt`, or `--python` |
| Ports 8787 / 8788 / 5173 busy | stop the old run (`Ctrl+C` stops everything this script started) |
| The `--real` webcam window stays black | wrong `--camera` number in `classify_live.py` |

## What this does not prove
Not tried here: a real Bluetooth adapter and devices, a real webcam for recording and live classification, how well real moving letters are recognised. Everything in FAKE mode uses generated data and says so on screen and in every message.
