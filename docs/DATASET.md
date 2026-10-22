# Dataset format

Written by the collection mode (`/?collect=1`), read by `ml/`. **JSONL**: one JSON object per line, one **take** per object.
A take is one short recording of one letter by one person: a few dozen frames of 21 hand landmarks. **No pictures are stored**, so a file contains no faces.

> **Never commit participant data to this repository (it is public).** That means the study exports (trials, survey, scores, profile, session, comparison, JSON), the recorded takes of hand landmarks, the card photographs and anything in `exports/`, `docs/reports/` or `takes/`. They are in `.gitignore` as a safety net, not as permission: keep them on an access-controlled drive, check `git status` before every commit, and if something was committed by mistake tell the team at once (deleting it in a later commit does not remove it from the history).

```json
{"v":1,"id":"6b0e…","label":"B","kind":"static","signer":"s01","session":"lamp-60cm","hand":"right",
 "width":1280,"height":720,"createdAt":"2026-10-21T20:00:00.000Z",
 "frames":[{"t":0,"lm":[[0.51,0.78,0.0],[0.49,0.73,-0.02], … 21 triples … ]}, …]}
```

| Field | Meaning |
| ----- | ------- |
| `v` | format version, always `1` |
| `id` | unique per take |
| `label` | one letter `A`-`Z` |
| `kind` | `static` (hold the sign still, about 1.5 s) or `dynamic` (a letter drawn in the air, about 2.2 s; J and Z by default) |
| `signer` | anonymous code such as `s01`. Never a name |
| `session` | one sitting: same light, distance and camera, for example `lamp-60cm`. Used to hold sessions out when testing |
| `hand` | the signing-hand setting while recording. `left` takes are mirrored when features are made, so a left-handed signer's letters look like a right-handed signer's |
| `width`, `height` | video size in pixels. x and y are normalised separately, so shapes can only be measured with both |
| `frames[].t` | ms since the start of the recording |
| `frames[].lm` | 21 MediaPipe hand landmarks `[x, y, z]`; x and y are 0..1 of the un-mirrored picture, z is MediaPipe's depth relative to the wrist |
| `synthetic` | `true` only for generated test data (and for takes made with the mock camera). Training refuses it without `--allow-synthetic` |

## What the collection mode keeps and refuses
- Static takes: up to one frame every 60 ms for 1.5 s, at least 12 frames. Dynamic takes: every frame for 2.2 s, at least 20 frames.
- A frame counts only if a hand is detected (score at least 0.5), is entirely inside the picture, and its size is within the same distance limits as the setup check (`PALM_MIN`..`PALM_MAX`).
- A take with more than 25% bad frames is **not saved** and the screen says why.
- Everything lives in the browser (IndexedDB) until you press Export. Export after every sitting; clearing browser data deletes the takes.

## Rules for a dataset that can be trusted
1. **Several signers.** One person's takes only show how repeatable that person is. With 2 or more signers the tools evaluate by leaving one signer out; with one signer they say the result is optimistic.
2. **Several sessions** per signer: change the light and the distance a little between sittings.
3. **Never split the frames of one take** between training and testing (they are almost identical). The tools group by take, session and signer for you.
4. Record both hands' worth of variation by also recording left-handed signers with `hand = left`, rather than flipping the data by hand.
5. Keep the raw JSONL files. Models can always be rebuilt from them; the other way round is impossible.
