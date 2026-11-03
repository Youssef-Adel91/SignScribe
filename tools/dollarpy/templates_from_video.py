#!/usr/bin/env python3
"""Make DollarPy templates for the moving letters from VIDEO FILES instead of a live webcam (same tracking, same cutting).

    python tools/dollarpy/templates_from_video.py --video J=J_Letter.mp4 --video Z=Z_letter.mp4
    python tools/dollarpy/templates_from_video.py --video J=a.mp4 --video J=b.mp4 --video Z=c.mp4 --out my-templates.json

Each video is one person signing one letter, hand visible. MediaPipe Hand Landmarker follows the hand frame by frame, the path of the
index fingertip is cut into one movement by the same `Segmenter` the live tool uses (time comes from the video's frame rate), and the
path is saved as a template. Fingertip only: no body tracking, so use `classify_live.py --no-pose` with these templates.

Things to know before trusting the result:
- The templates are the movement of whoever is in the video. A video of another person is not the same as your own hand on your own
  webcam; record yourself with record_templates.py for the real demo when you can, or mix both in one file.
- One video is one take. dollarpy works with one template per letter, but one take of one person says very little about other
  people. The more people and takes, the better.
- The output file is a person's movement data: git-ignored, never commit it. Keep the videos out of git too."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from dollar_logic import Segmenter, load_alphabet, save_templates  # noqa: E402

DEFAULT_OUT = Path(__file__).parent / "templates.json"


def movements_from_frames(frames, fps: float, settle_ms: float = 1000.0) -> list:
    """frames: iterable of (landmarks or None, width, height), one per video frame. Returns the movements (paths) found.

    When the video stops in the middle of a movement the last picture is held for `settle_ms`, as a still hand, so the movement can end."""
    seg = Segmenter()
    dt = 1000.0 / fps
    found, t, last = [], 0.0, None
    for lm, w, h in frames:
        _, path = seg.feed(t, lm, w, h)
        if path is not None:
            found.append(path)
        last = (lm, w, h)
        t += dt
    if last is not None and last[0] is not None:
        for _ in range(int(settle_ms / dt)):
            _, path = seg.feed(t, last[0], last[1], last[2])
            if path is not None:
                found.append(path)
            t += dt
    return found


def drop_jumps(frames, max_jump: float = 0.12, accept_after: int = 8) -> tuple[list, int]:
    """MediaPipe may flip for single frames to a second hand that rests in the picture (folded hands, the other hand on a desk):
    the path then jumps across the picture and back. A frame whose wrist is further than `max_jump` (picture width or height
    units) from the last accepted wrist is replaced by that last frame. After `accept_after` such frames in a row the hand is
    taken to really be somewhere else, and the new place is accepted. Returns (frames, number replaced)."""
    out, last, run, replaced = [], None, 0, 0
    for lm, w, h in frames:
        if lm is None:
            out.append((lm, w, h))
            continue
        if last is not None:
            far = max(abs(lm[0][0] - last[0][0]), abs(lm[0][1] - last[0][1])) > max_jump
            run = run + 1 if far else 0
            if far and run < accept_after:
                out.append((last, w, h))
                replaced += 1
                continue
        last = lm
        out.append((lm, w, h))
    return out, replaced


def video_frames(path: str, tracker):
    """Yields (landmarks or None, width, height) for every frame of a video, and sets the frame rate on the generator's `.fps`."""
    import cv2

    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise SystemExit(f"error: cannot open the video {path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    w, h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    frames = []
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        frames.append((tracker.track(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)), w, h))
    cap.release()
    return frames, fps


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--video", action="append", required=True, metavar="LETTER=FILE", help="one video of one letter; repeat for more letters and more takes")
    ap.add_argument("--alphabet", help="config/alphabets/<name>.json (default: the active one)")
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--model", help="hand_landmarker.task (default: public/models)")
    a = ap.parse_args(argv)
    alphabet = load_alphabet(a.alphabet)
    jobs = []
    for spec in a.video:
        label, sep, file = spec.partition("=")
        if not sep or len(label) != 1 or not file:
            print(f"error: --video wants LETTER=FILE, got '{spec}'", file=sys.stderr)
            return 2
        if label not in alphabet.letters:
            print(f"error: {label} is not a letter of the alphabet '{alphabet.id}'", file=sys.stderr)
            return 2
        if not Path(file).exists():
            print(f"error: {file} not found", file=sys.stderr)
            return 2
        jobs.append((label, file))
    from hand_tracker import DEFAULT_MODEL, HandTracker

    tracker = HandTracker(a.model or DEFAULT_MODEL)
    print(f"tracker: {tracker.describe()}")
    saved, problems = [], 0
    try:
        for label, file in jobs:
            frames, fps = video_frames(file, tracker)
            seen = sum(1 for lm, _, _ in frames if lm is not None)
            frames, replaced = drop_jumps(frames)
            moves = movements_from_frames(frames, fps)
            print(f"{label}: {file}: {len(frames)} frames at {fps:.1f} fps, hand seen in {seen}, {replaced} jumpy frame(s) replaced, {len(moves)} movement(s) found")
            if len(moves) != 1:
                problems += 1
                print(f"  -> expected exactly one movement; {'none found: is the hand visible and does it move?' if not moves else 'trim the video to one letter'}; this video is NOT saved")
                continue
            saved.append((label, moves[0]))
    finally:
        tracker.close()
    if not saved:
        return 1
    save_templates(a.out, saved, alphabet.id, pose_parts=())
    print(f"{len(saved)} template(s) in {a.out}: {', '.join(l for l, _ in saved)} (fingertip only: classify with --no-pose)")
    return 0 if not problems else 1


if __name__ == "__main__":
    raise SystemExit(main())
