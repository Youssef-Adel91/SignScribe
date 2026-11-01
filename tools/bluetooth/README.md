# Bluetooth presence scanner

Course Phase II row "Use Bluetooth to capture UserID and discover". A small Python program (Bleak, like Lab 3) that scans for nearby Bluetooth Low Energy devices, turns the ones you listed into a **UserID** and a **place** (Clinic / Shop / Work / Home) and sends `{userId, place, rssi}` to the sentence server over its plain TCP socket. What the web app does with it: see `docs/PHASE3.md` section "Context from Bluetooth" (and `server/README.md` for the message).

## Run it
    pip install -r tools/bluetooth/requirements.txt
    cp tools/bluetooth/devices.example.json tools/bluetooth/devices.json     # then edit it; it is git-ignored
    npm run server                                                            # in another terminal
    python tools/bluetooth/scan.py -v

You need a computer with a Bluetooth adapter that is switched on. Linux may need `bluez` and permission to use it; macOS asks for Bluetooth permission for the terminal. If Bluetooth is off the scanner says so once, reports nothing, and the app behaves exactly as it does without it (manual place choice).

## The config file (`devices.json`)
| Field | Meaning |
| ----- | ------- |
| `devices[].match` | exactly one of `address` (any spelling of a Bluetooth address), `name` (exact advertised name) or `name_prefix` |
| `devices[].userId` | who carries this device (your band or phone): 1-32 letters, digits, `-`, `_`. This is a label you choose, not a name |
| `devices[].place` | where this device is (a beacon on the wall, a tag on a desk): Clinic, Shop, Work or Home |
| `devices[].label` | what appears in logs instead of the device (default `device #N`); must not look like an address |
| `scan.min_rssi` | devices weaker than this are ignored (a rough "nearby", default -85 dBm) |
| `scan.confirm_scans` / `lost_after_scans` | a new person/place needs this many scans in a row to be believed; it is forgotten after this many empty scans (signal strength jumps around) |
| `scan.heartbeat_seconds` | the same presence is repeated this often so the server does not forget it (the server forgets after 15 s) |

An entry may have a `userId`, a `place` or both. In one scan the strongest known user device gives `userId` and the strongest known place device gives `place`. `rssi` in the message is the signal strength of the user device, or of the place device when there is no user.

## Privacy
Device addresses and names exist **only** in your local `devices.json` and in the scanner's memory for the moment of matching. They are never printed, logged or sent: the logs show your `label`s and counts ("5 other devices ignored"), the message has no address field and the server refuses a message that has one. `devices.json` is in `.gitignore`; commit only `devices.example.json`. Unknown devices are counted, never listed.

## Demo without hardware (FAKE)
    python tools/bluetooth/scan.py --fake youssef:Clinic [--fake-seconds 20]
    python tools/bluetooth/scan.py --fake sara:Clinic:female       # the person's profile too: the app shows pink pages

Simulates one device. It prints `*** FAKE BLE DEVICE ... ***`, marks every message `"demo": true` (the app shows "demo device") and, with `--fake-seconds`, makes the device disappear so you can show the app falling back. It exists only for demos and tests. It proves nothing about Bluetooth hardware.

## Tests
    python -m pytest tools/bluetooth        # no Bluetooth needed: fake scans, a fake server, a fake `bleak`, and the server's real message parser through node

## Verified, and not
Verified here: config rules, matching (address spellings, names, prefixes, signal threshold), smoothing, the message against the server's own parser, sending over a real TCP socket, reconnecting, backing off when the server is busy or away, that no address or device name ever reaches a log line or a message, the Bleak wrapper with a fake `bleak`.
**Not verified: a real Bluetooth adapter and real devices** (none here). Things to check on real hardware: that your devices advertise a stable name or address (phones often rotate their address for privacy: use a band, a beacon or a tag), and the `min_rssi` / scan times for your room.

### The person's profile (page colours)
A device entry with a `userId` may also say `"gender": "male"` or `"gender": "female"`. The scanner sends it with that person's presence
(never for a place-only device), the server checks it and pushes it to the app, and the app uses it for a person it has no saved
profile for yet: male = blue and green pages, female = pink pages. The person can change it on screen 03; their saved profile wins
from then on. It is never logged.

