#!/usr/bin/env python3
"""Record DollarPy templates for the moving letters from a webcam (like Lab 5, with MediaPipe hand tracking).

    pip install -r tools/dollarpy/requirements.txt
    npm run models                                         # the MediaPipe hand model
    python tools/dollarpy/record_templates.py              # the moving letters of the active alphabet (config/alphabets)
    python tools/dollarpy/record_templates.py --letters J Z --per-letter 6
    python tools/dollarpy/record_templates.py --no-pose            # fingertip only, no body tracking

For each letter: the prompt and a 3 second countdown, then draw the letter in the air with your index finger. A take is
accepted when the movement ends (finger slows down). Keys in the window: q quit, s skip this letter."""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from dollar_logic import DEFAULT_POSE_PARTS, INDEX_TIP, POSE_PARTS, Segmenter, load_alphabet, pose_keys, save_templates  # noqa: E402

DEFAULT_OUT = Path(__file__).parent / "templates.json"


def take(tracker, cap, cv2, label, n, total, pose_tracker=None, window=True, timeout_s=8.0):
    """Countdown, then wait for one movement. Returns a path, 'skip', 'quit' or None (no movement seen)."""
    t0 = time.monotonic()
    seg = Segmenter()
    while True:
        ok, frame = cap.read()
        if not ok:
            raise SystemExit("the camera gave no picture")
        now = (time.monotonic() - t0) * 1000
        h, w = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        lm = tracker.track(rgb)
        counting = now < 3000
        pose = pose_tracker.track(rgb) if pose_tracker else None
        state, path = (None, None) if counting else seg.feed(now, lm, w, h, pose)
        if window:
            view = cv2.flip(frame, 1)  # a mirror is easier to draw in; the landmarks above come from the un-mirrored picture
            if lm is not None:
                cv2.circle(view, (int((1 - lm[INDEX_TIP][0]) * w), int(lm[INDEX_TIP][1] * h)), 8, (0, 255, 255), -1)
            msg = f"Draw {label}  (take {n}/{total})  " + (f"starting in {int(3 - now / 1000) + 1}" if counting else "now!" if state != "moving" else "drawing...")
            cv2.putText(view, msg, (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 255, 0), 2)
            cv2.imshow("record templates", view)
            k = cv2.waitKey(1) & 0xFF
            if k == ord("q"):
                return "quit"
            if k == ord("s"):
                return "skip"
        if path is not None:
            return path
        if now > 3000 + timeout_s * 1000:
            return None


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--letters", nargs="+", help="letters to record (default: the dynamic letters of the alphabet)")
    ap.add_argument("--alphabet", help="config/alphabets/<name>.json (default: the active one)")
    ap.add_argument("--per-letter", type=int, default=5)
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--camera", type=int, default=0)
    ap.add_argument("--model", help="hand_landmarker.task (default: public/models)")
    ap.add_argument("--pose", action=argparse.BooleanOptionalAction, default=True, help="also track the body (MediaPipe Pose) and keep it in the template points (default on; --no-pose for the fingertip alone)")
    ap.add_argument("--pose-parts", nargs="+", default=list(DEFAULT_POSE_PARTS), choices=list(POSE_PARTS), help="which pose landmarks to add (default: all twelve of Lab 5: shoulders elbows wrists pinky index hips)")
    ap.add_argument("--pose-min-visibility", type=float, default=0.0, help="drop the pose of a frame when a landmark is less visible than this (default 0: use every landmark as MediaPipe gives it, like Lab 5)")
    ap.add_argument("--pose-model", help="pose_landmarker_lite.task (default: public/models)")
    ap.add_argument("--no-window", action="store_true", help="no preview window (progress only on the terminal)")
    a = ap.parse_args(argv)
    alphabet = load_alphabet(a.alphabet)
    letters = a.letters or list(alphabet.dynamic)
    if not letters:
        print(f"error: alphabet '{alphabet.id}' lists no moving letters. Name them with --letters, or add them under \"dynamic\" in config/alphabets/{alphabet.id}.json", file=sys.stderr)
        return 2
    bad = [l for l in letters if l not in alphabet.labels]
    if bad:
        print(f"error: {' '.join(bad)} is not a letter of the alphabet '{alphabet.id}'", file=sys.stderr)
        return 2
    try:
        import cv2
    except ImportError:
        print("error: OpenCV is not installed: pip install -r tools/dollarpy/requirements.txt", file=sys.stderr)
        return 2
    from hand_tracker import DEFAULT_MODEL, DEFAULT_POSE_MODEL, HandTracker, PoseTracker

    tracker = HandTracker(a.model or DEFAULT_MODEL)
    parts = tuple(a.pose_parts) if a.pose else ()
    pose_tracker = PoseTracker(pose_keys(parts), a.pose_model or DEFAULT_POSE_MODEL, min_visibility=a.pose_min_visibility) if parts else None
    cap = cv2.VideoCapture(a.camera)
    if not cap.isOpened():
        print(f"error: camera {a.camera} cannot be opened", file=sys.stderr)
        return 2
    print(f"tracker: {tracker.describe()}")
    print(pose_tracker.describe() if pose_tracker else "pose: off (fingertip only)")
    if pose_tracker:
        print("Stand so that your upper body is in the picture.")
    saved: list = []
    try:
        for letter in letters:
            n = 0
            while n < a.per_letter:
                r = take(tracker, cap, cv2, letter, n + 1, a.per_letter, pose_tracker, window=not a.no_window)
                if r == "quit":
                    raise KeyboardInterrupt
                if r == "skip":
                    break
                if r is None:
                    print(f"{letter}: no movement seen, try again")
                    continue
                saved.append((letter, r))
                n += 1
                save_templates(a.out, saved, alphabet.id, pose_parts=parts)
                print(f"{letter}: saved take {n}/{a.per_letter} ({len(r)} points)")
    except KeyboardInterrupt:
        print("stopped")
    finally:
        cap.release()
        tracker.close()
        if pose_tracker:
            pose_tracker.close()
        if not a.no_window:
            cv2.destroyAllWindows()
    print(f"{len(saved)} templates in {a.out}")
    return 0 if saved else 1


if __name__ == "__main__":
    raise SystemExit(main())
