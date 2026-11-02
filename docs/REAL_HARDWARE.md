# Real hardware run (no FAKE): Bluetooth, DollarPy, camera

Youssef's decision (2026-11-02): **the Phase II demo must use real hardware.** A FAKE device or simulated hand paths do not count. This page is the procedure and the evidence to keep. Everything here was written without the hardware: **nothing on this page has been run on a real adapter, band or webcam yet**; each step says what to look for and what to write down.

`npm run demo -- --real` starts the server, the real scanner, the real DollarPy client and the web app (`tools/demo-all.md`). Do the parts one by one first.

## 0. What you need
| Part | Needs |
| --- | --- |
| Bluetooth row (UserID and discovery) | a computer with a working Bluetooth adapter, and **one or more advertising devices you control**: a fitness band, a BLE beacon or a tag. A phone is a poor choice: phones usually rotate their Bluetooth address for privacy, so the match breaks after a few minutes |
| Context row (content by place and by person) | at least one *person* device (a band) and one *place* device (a beacon or tag) so the person and the place come from two different devices |
| DollarPy row | a webcam, good light, the templates you record yourself (`tools/dollarpy/templates.json`, git-ignored) |
| Camera test | the laptop webcam and `docs/PHASE2_CHECKLIST.md` |

## 1. Find out how your devices advertise
The scanner never prints a device address or name (privacy). So find the name on your phone first: install a free BLE scanner app (nRF Connect, LightBlue or similar), switch your band / beacon on, and read its **advertised name** (and note whether the name stays the same after you walk away and come back). Prefer matching by `name` or `name_prefix`. Use `address` only for a device that keeps a fixed address (many beacons do). Write down: device, advertised name, stable or changing.

## 2. Bluetooth, real
1. `pip install -r tools/bluetooth/requirements.txt`
2. `cp tools/bluetooth/devices.example.json tools/bluetooth/devices.json` (PowerShell: `Copy-Item`). Edit it: one entry for your band (`userId`, optional `gender`) and one for the beacon or tag (`place`: Clinic, Shop, Work or Home). `devices.json` is git-ignored; never commit it.
3. Switch Bluetooth on. `npm run server` in one terminal, `python tools/bluetooth/scan.py -v` in another.
4. **Look for:** the scanner must NOT print `FAKE`. The server log shows `presence: user <your userId>, place <place>`. If it says Bluetooth is off or not available, fix that first (Windows: the adapter and the privacy setting for Bluetooth; Linux: `bluez`; macOS: permission for the terminal).
5. Walk away with the band (or switch the beacon off): after `lost_after_scans` scans the presence must disappear, and the app must fall back to the manual choice.
6. Tune `scan.min_rssi` (default -85) so "nearby" means the room you will present in.

**Write down (evidence):** the adapter / computer, the devices (kind only, no address), whether the name was stable, how many seconds from switching on to the first presence, how many seconds to lose it, `min_rssi` used. Put it in `docs/DONE.md` under the Bluetooth row as **verified on real hardware**, with the date.

## 3. Content by context, real
1. Server, scanner (real) and web app: `http://localhost:5173/?server=ws://localhost:8787`.
2. **Look for:** the chip `Bluetooth: <userId> · <place>` with **no** "(demo device)" text; the place already selected on screen 04; that place's words and picture cards; the person's saved settings; page colours from the profile (male blue and green, female pink) when the device entry has `gender`; "Wrong? Point and hold here to ignore" undoes it.
3. Change the beacon (a second place) and watch the content change.
4. Repeat the same with a second person device if you have one.

## 4. DollarPy, real
1. `pip install -r tools/dollarpy/requirements.txt`, `npm run models` (hand and pose models).
2. Record templates: `python tools/dollarpy/record_templates.py` records the moving letters of the active alphabet (ASL: J and Z; `--letters J Z --per-letter 5`, `--alphabet asl`). Draw the letter in the air with the index finger, same size and speed as you will use on the day. Record from more than one person if you can.
3. Live: `python tools/dollarpy/classify_live.py` (server running). `--no-window` hides the preview. **Never** use `--simulate` or `--synthetic-templates` for the real run.
4. **Look for:** `recognised J (score 0.xx) -> queued for the server (sender thread)`, then a card `dollarpy: J` in the app. At exit it prints `camera pictures skipped while busy` and the sender counts (sent / failed / dropped).
5. Try wrong shapes and a still hand: they must not produce a letter.

**Write down:** the camera, the light, how many of 20 attempts per letter were recognised, how many false letters in one minute with a still hand. Do not write an accuracy percentage anywhere else than the table of attempts you really made.

## 5. Camera test of the web app
Follow `docs/PHASE2_CHECKLIST.md` (20 attempts per gesture, commands, pointer, setup checks) and record `/?perf=1` (`docs/PERF.md`). Open `/?dev=1&letterdebug=1&alphabet=arsl` to see why a letter fires. Every misfire goes into `docs/KNOWN_ISSUES.md` (screen, how to repeat, severity); a fix starts from a test that reproduces it.

## 6. The whole chain on the day
`npm run demo -- --real` (or four terminals, `tools/demo-all.md`). Before presenting: Bluetooth on, devices charged and advertising, templates recorded, `npm run models` run, room lit, `devices.json` and `templates.json` **not** committed (`git status`). Say what is real and what is not: the Arabic letters from a hand sign use the model trained on dataset pictures (image-data result in `docs/MODEL_RESULTS.md`, **not measured on this webcam**), and the language model is the offline rule builder unless you tried the live one.

## 7. If a real part cannot be made to work
Say so plainly and ask the TA before the day; do not switch silently to a simulated part. A simulated part is always labelled on screen and in the terminal (`FAKE`, `SIMULATED`, "demo device").
