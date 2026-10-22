# Phase 2: camera, hand tracking and gestures

Everything below is implemented in `src/vision/`. What was tested without a camera and what needs one is in `docs/DONE.md`.

## Pipeline

    camera (getUserMedia 1280x720, mirrored picture)
      -> MediaPipe HandLandmarker (VIDEO mode, 2 hands, GPU delegate, CPU fallback)
      -> HandFrame {t, hands[21 landmarks], width, height}
      -> GestureController.step(frame, {screen, signingHand, needsHand, viewport, checks})
           classify() per hand -> GestureStabilizer (debounce) -> wake / help / commands / pointer + dwell
      -> machine events (WAKE, YES, NO, SPACE, DELETE, HELP_TOGGLE, HAND_LOST, HAND_BACK, CHECKS_PASSED, CHOOSE_*, CARD_ADDED)
      -> state machine -> screen

`GestureController` has no DOM and no React: it takes a frame and returns events and UI numbers, so all of it is unit tested.
`VisionProvider` is the only part that touches the camera and reads the machine snapshot directly (not through React state).

## Gestures

| Gesture (what you show)        | Label   | Hold    | Where it counts                                   | Event                                   |
| ------------------------------ | ------- | ------- | ------------------------------------------------- | --------------------------------------- |
| Raise an open hand             | `open`  | 2 s     | screen 01                                         | WAKE                                    |
| Both open hands                | `open`x2| 1 s     | every screen                                      | HELP_TOGGLE (opens / closes screen 13)  |
| Index finger out, rest curled  | `point` | 0.8 s on a target (adapts 0.6-1.4 s) | any screen that has choices          | the target's event (CHOOSE_*, CARD_ADDED, YES/NO on 11) |
| Open palm                      | `open`  | 0.5 s   | 06, 07 in the command zone; 12 anywhere           | SPACE; NEW_SENTENCE on 12               |
| Fist                           | `fist`  | 0.5 s   | 06, 07, 10 in the command zone; 09, 11 anywhere   | DELETE                                  |
| Thumbs up                      | `up`    | 0.6 s   | 03-11 (06, 07, 10 only in the zone); 12 anywhere  | YES; FINISH on 12                       |
| Thumbs down                    | `down`  | 0.6 s   | 02-11 (06, 07, 10 only in the zone); 12, 13       | NO; EDIT on 12; closes help on 13       |
| No hand for 1 s (screens 06, 07, 09, 10) | -  | 1 s     | automatic                                       | HAND_LOST; HAND_BACK after 0.3 s        |
| All three setup checks green   | -       | 1.5 s   | screen 02, automatic                              | CHECKS_PASSED                           |

What thumbs down (NO) does, screen by screen: 02 back to the welcome screen, 03 back to the camera check, 04 back to preferences,
05 back to context, 06 back to the method choice, 07 drop the guessed letter, 09 reject the suggestion and keep the typed word,
10 back to the method choice, 11 try another wording, 12 edit (back to review), 13 close help.

A command must be released before it can fire again, and a gesture still held when the screen changes is ignored until released
(otherwise the thumbs up that confirms the sentence would also press Finish on the next screen).

## Command zone

The zone is on the side opposite the signing hand (settings, screen 03): the outer 40% of the mirrored picture. On the spelling screens
(06, 07) and the card screen (10) the command gestures only count there, because the signing hand makes fists, open hands and thumbs as
letters. On every other screen thumbs, fist and open palm count anywhere.

## Pointer and dwell

Index fingertip -> viewport pixel (mirrored, the outer 12% of the camera picture is cut so screen edges are reachable) -> One-Euro
filter (min cutoff 1 Hz, beta 0.01). `DwellEngine` fires a target after the hold time. Every target has a hit area of at least 96 px,
the pointer may drift 16 px outside it, and may disappear for 250 ms, without losing progress. After firing, the same target needs the
pointer to leave first. Holding more than half way and then leaving makes the hold time 100 ms longer (max 1.4 s); three
successes in a row make it 50 ms shorter (min 0.6 s).

Screens register targets with `useDwellTarget(event)` (`src/vision/targets.ts`); `Tile` takes a `dwell` prop. Nothing in `src/screens` or `src/ui` has a click or key handler (tested).

## Setup checks (screen 02), all heuristics to tune with a camera

Light: mean luma between 70 and 215. Distance: palm length between 12% and 45% of the frame height. Hand: all 21 landmarks inside the picture.

## Known limits

- The classifier is rule-based on the 2D landmarks. It has only been exercised on synthetic hands (anatomical model in `src/vision/testing/fixtures.ts`), never on a real person.
- Two hands on top of each other, a hand very close to the camera, or strong side light will confuse MediaPipe itself.
- Thumb direction uses image vertical, so a thumbs up with the hand tilted more than about 35 degrees is not recognised.
- Left and right hand are told apart by position, not by the label MediaPipe gives (that label is unreliable when both hands are visible).
