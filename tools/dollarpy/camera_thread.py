"""Lab 4 (threads): read the webcam on its own thread and keep only the newest picture.

`cap.read()` waits for the camera; MediaPipe and dollarpy take time too. With both on one thread, pictures pile up in the
camera driver and the movement is judged late. Here one thread (producer) reads pictures as fast as the camera gives them
and keeps only the newest under a lock; the main loop (consumer) takes the newest whenever it is ready, so it never works
on a stale picture. Pictures it was too slow for are counted as skipped."""
from __future__ import annotations

import threading
import time


class LatestFrame:
    def __init__(self, cap, clock=time.monotonic):
        self.cap, self.clock = cap, clock
        self._lock = threading.Lock()
        self._new = threading.Condition(self._lock)
        self._frame = None
        self._seq = 0
        self._taken = 0
        self.skipped = 0
        self.failed = False
        self._running = True
        self._thread = threading.Thread(target=self._read, name="camera-reader", daemon=True)
        self._thread.start()

    def _read(self):
        while self._running:
            ok, frame = self.cap.read()
            with self._new:
                if not ok:
                    self.failed = True
                    self._running = False
                    self._new.notify_all()
                    return
                if self._seq > self._taken:
                    self.skipped += 1  # the previous picture was never taken: the consumer was busy
                self._frame, self._seq = frame, self._seq + 1
                self._new.notify_all()

    def read(self, timeout: float = 2.0):
        """(ok, frame): waits for a picture newer than the last one taken. ok is False when the camera stopped."""
        with self._new:
            if not self._new.wait_for(lambda: self._seq > self._taken or self.failed, timeout):
                return False, None
            if self._seq <= self._taken:
                return False, None
            self._taken = self._seq
            return True, self._frame

    def stop(self, timeout: float = 2.0):
        self._running = False
        self._thread.join(timeout)
