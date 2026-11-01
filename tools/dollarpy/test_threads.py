"""Lab 4 (threads): the sender thread and the camera reader thread, with no camera and a fake or real TCP server."""
import json
import socket
import sys
import threading
import time
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "common"))

from camera_thread import LatestFrame  # noqa: E402
from server_link import BackgroundLink, ServerLink  # noqa: E402
import classify_live  # noqa: E402


class SlowLink:
    def __init__(self, delay=0.2, fail=False):
        self.delay, self.fail, self.got, self.closed = delay, fail, [], False
        self.threads = set()

    def send(self, m):
        self.threads.add(threading.current_thread().name)
        time.sleep(self.delay)
        if self.fail:
            raise ConnectionRefusedError("down")
        self.got.append(m)
        return {"id": m["id"], "ok": True}

    def close(self):
        self.closed = True


def test_submit_never_waits_for_the_network_and_sends_in_order_on_another_thread():
    slow = SlowLink(delay=0.2)
    bl = BackgroundLink(slow)
    t = time.monotonic()
    for i in range(3):
        assert bl.submit({"id": f"m{i}"})
    assert time.monotonic() - t < 0.05  # three sends of 0.2 s each did not block the caller
    bl.close()
    assert [m["id"] for m in slow.got] == ["m0", "m1", "m2"]
    assert slow.threads == {"server-link-sender"} and slow.closed
    assert bl.counts()["sent"] == 3


def test_a_full_queue_drops_the_newest_and_counts_it():
    slow = SlowLink(delay=0.3)
    bl = BackgroundLink(slow, maxsize=2)
    results = [bl.submit({"id": f"m{i}"}) for i in range(6)]
    assert results.count(False) >= 3 and bl.counts()["dropped"] == results.count(False)
    bl.close()


def test_an_unreachable_server_is_reported_on_the_worker_and_never_raises_in_the_caller():
    errors = []
    bl = BackgroundLink(SlowLink(delay=0, fail=True), on_error=lambda m, e: errors.append((m["id"], type(e).__name__)))
    bl.submit({"id": "a"})
    bl.close()
    assert errors == [("a", "ConnectionRefusedError")] and bl.counts()["failed"] == 1


def test_the_sender_queues_letters_when_given_a_background_link():
    slow = SlowLink(delay=0)
    s = classify_live.Sender(BackgroundLink(slow), demo=True, log=lambda *_: None)
    assert s.send("J", 0.9) == "queued"
    s.link.close()
    assert slow.got[0]["letter"] == "J" and slow.got[0]["demo"] is True


def test_background_link_over_a_real_tcp_socket():
    srv = socket.socket()
    srv.bind(("127.0.0.1", 0))
    srv.listen(1)
    port, got = srv.getsockname()[1], []

    def serve():
        c, _ = srv.accept()
        f = c.makefile("rwb")
        for line in f:
            m = json.loads(line)
            got.append(m)
            f.write((json.dumps({"id": m["id"], "ok": True}) + "\n").encode())
            f.flush()
        c.close()

    threading.Thread(target=serve, daemon=True).start()
    answers = []
    bl = BackgroundLink(ServerLink("127.0.0.1", port), on_answer=lambda m, a: answers.append(a["id"]))
    for i in range(4):
        bl.submit({"id": f"x{i}"})
    bl.close()
    srv.close()
    assert answers == ["x0", "x1", "x2", "x3"] and [m["id"] for m in got] == answers


class FakeCap:
    """A camera that gives a numbered picture every `period` seconds, then stops."""

    def __init__(self, n=30, period=0.005):
        self.i, self.n, self.period = 0, n, period

    def read(self):
        time.sleep(self.period)
        self.i += 1
        return (self.i <= self.n), self.i


def test_the_reader_thread_always_gives_the_newest_picture_and_counts_the_skipped_ones():
    cam = LatestFrame(FakeCap(n=40, period=0.005))
    seen = []
    while True:
        ok, f = cam.read(timeout=1)
        if not ok:
            break
        seen.append(f)
        time.sleep(0.02)  # the consumer is slower than the camera (like MediaPipe)
    cam.stop()
    assert seen == sorted(seen) and len(set(seen)) == len(seen)  # newer each time, never the same picture twice
    assert cam.skipped > 0 and len(seen) + cam.skipped <= 40
    assert cam.failed  # the fake camera stopped, and read() said so


def test_a_fast_consumer_gets_every_picture():
    cam = LatestFrame(FakeCap(n=10, period=0.02))
    seen = []
    while True:
        ok, f = cam.read(timeout=1)
        if not ok:
            break
        seen.append(f)
    cam.stop()
    assert seen == list(range(1, 11)) and cam.skipped == 0
