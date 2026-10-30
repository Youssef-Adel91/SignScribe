#!/usr/bin/env python3
"""Classify moving letters live from a webcam with DollarPy and send each recognised letter to the sentence server.

    python tools/dollarpy/classify_live.py                    # webcam + your recorded templates.json
    python tools/dollarpy/classify_live.py --no-send          # only print
    python tools/dollarpy/classify_live.py --simulate J --synthetic-templates     # DEMO without a webcam (generated paths)

The server relays the letter to the web app, which shows "dollarpy: J" and adds it when you point at it and hold."""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from dollar_logic import (  # noqa: E402
    MOTION,
    Pipeline,
    ServerLink,
    TemplateError,
    build_recognizer,
    letter_message,
    load_alphabet,
    load_templates,
)
from simulate import SIM_BANNER, SHAPES, frames, synthetic_templates  # noqa: E402

DEFAULT_TEMPLATES = Path(__file__).parent / "templates.json"


class Sender:
    """Sends a recognised letter; never lets a missing server stop the recognition."""

    def __init__(self, link, demo: bool, log=print):
        self.link, self.demo, self.log, self.seq = link, demo, log, 0

    def send(self, letter: str, score: float) -> bool:
        if self.link is None:
            return False
        self.seq += 1
        try:
            ans = self.link.send(letter_message(self.seq, letter, score, self.demo))
        except OSError as e:
            self.log(f"server not reachable ({type(e).__name__}): the letter was recognised but not sent")
            return False
        if not ans.get("ok"):
            self.log(f"server refused the letter: {ans.get('error')}: {ans.get('message')}")
            return False
        return True


def handle(result, sender: Sender, log=print) -> None:
    if result == "unknown":
        log("a movement was seen but it did not match any template well enough")
    elif result:
        letter, score = result
        sent = sender.send(letter, score)
        log(f"recognised {letter}  (score {score:.2f}){'  -> sent to the server' if sent else ''}")


def run_simulation(letters, pipe: Pipeline, sender: Sender, realtime: bool, log=print) -> list:
    log(SIM_BANNER)
    found = []
    for k, letter in enumerate(letters):
        last = 0.0
        for t, lm, w, h in frames(letter, variant=k + 0.25):
            if realtime:
                time.sleep(max(0.0, (t - last) / 1000))
                last = t
            _, res = pipe.feed(t + k * 10_000, lm, w, h)
            if res:
                handle(res, sender, log)
                found.append(res)
    return found


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--templates", default=str(DEFAULT_TEMPLATES))
    ap.add_argument("--alphabet", help="config/alphabets/<name>.json (default: the active one)")
    ap.add_argument("--min-score", type=float, default=MOTION["min_score"], help="dollarpy score needed to accept a letter (same default as the web app)")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8788)
    ap.add_argument("--no-send", action="store_true", help="do not talk to the server")
    ap.add_argument("--camera", type=int, default=0)
    ap.add_argument("--model", help="hand_landmarker.task (default: public/models)")
    ap.add_argument("--no-window", action="store_true")
    ap.add_argument("--simulate", nargs="+", metavar="LETTER", help=f"DEMO: feed generated paths instead of a webcam ({', '.join(SHAPES)})")
    ap.add_argument("--synthetic-templates", action="store_true", help="DEMO: use generated templates instead of a recorded file")
    ap.add_argument("--fast", action="store_true", help="with --simulate: do not wait in real time")
    a = ap.parse_args(argv)
    try:
        alphabet = load_alphabet(a.alphabet)
        if a.synthetic_templates:
            letters = sorted(set(a.simulate or SHAPES))
            templates = synthetic_templates(letters)
            print("*** SYNTHETIC TEMPLATES: generated shapes, not a person's movement ***")
        else:
            templates, _ = load_templates(a.templates)
        unknown = sorted({l for l, _ in templates if l not in alphabet.labels})
        if unknown:
            raise TemplateError(f"templates for {' '.join(unknown)} are not letters of the alphabet '{alphabet.id}'")
    except (TemplateError, ValueError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    pipe = Pipeline(build_recognizer(templates), a.min_score)
    link = None if a.no_send else ServerLink(a.host, a.port)
    sender = Sender(link, demo=a.simulate is not None or a.synthetic_templates)
    try:
        if a.simulate:
            found = run_simulation(a.simulate, pipe, sender, not a.fast)
            return 0 if found else 1
        import cv2
        from hand_tracker import DEFAULT_MODEL, HandTracker

        tracker = HandTracker(a.model or DEFAULT_MODEL)
        cap = cv2.VideoCapture(a.camera)
        if not cap.isOpened():
            print(f"error: camera {a.camera} cannot be opened", file=sys.stderr)
            return 2
        print(f"tracker: {tracker.describe()}\nDraw a moving letter in the air with your index finger. q quits.")
        t0 = time.monotonic()
        try:
            while True:
                ok, frame = cap.read()
                if not ok:
                    print("the camera gave no picture")
                    return 2
                h, w = frame.shape[:2]
                lm = tracker.track(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                _, res = pipe.feed((time.monotonic() - t0) * 1000, lm, w, h)
                if res:
                    handle(res, sender)
                if not a.no_window:
                    cv2.imshow("classify live", cv2.flip(frame, 1))
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break
        except KeyboardInterrupt:
            pass
        finally:
            cap.release()
            tracker.close()
            if not a.no_window:
                cv2.destroyAllWindows()
        return 0
    finally:
        if link:
            link.close()


if __name__ == "__main__":
    raise SystemExit(main())
