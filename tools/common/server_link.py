"""A tiny client for the sentence server's plain TCP socket: one JSON message per line, one JSON answer per line (server/README.md).

Shared by tools/bluetooth/scan.py and tools/dollarpy/classify_live.py. Written with the socket module like the lab clients."""
from __future__ import annotations

import json
import socket


class ServerLink:
    """The sentence server's plain TCP socket, one JSON line per message (server/README.md). Reconnects by itself."""

    def __init__(self, host: str, port: int, timeout: float = 3.0):
        self.host, self.port, self.timeout = host, port, timeout
        self._sock: socket.socket | None = None
        self._buf = b""

    def close(self):
        if self._sock:
            try:
                self._sock.close()
            finally:
                self._sock = None

    def send(self, msg: dict) -> dict:
        """Returns the server's answer. Raises OSError when the server cannot be reached."""
        line = (json.dumps(msg, separators=(",", ":")) + "\n").encode("utf-8")
        for attempt in (0, 1):
            try:
                if self._sock is None:
                    self._sock = socket.create_connection((self.host, self.port), timeout=self.timeout)
                    self._buf = b""
                self._sock.sendall(line)
                while b"\n" not in self._buf:
                    chunk = self._sock.recv(4096)
                    if not chunk:
                        raise ConnectionError("server closed the connection")
                    self._buf += chunk
                reply, _, self._buf = self._buf.partition(b"\n")
                return json.loads(reply.decode("utf-8"))
            except (OSError, ValueError):
                self.close()
                if attempt:
                    raise
        raise OSError("unreachable")


class BackgroundLink:
    """Lab 4 (threads): sends on its own thread so a slow or missing server never stalls the caller's loop.

    The camera loop (producer) calls submit() and goes on at once; one worker thread (consumer) takes the messages from a
    bounded queue and sends them over a ServerLink, in order. When the queue is full the NEWEST message is dropped and
    counted (a letter recognised while the server is away is not worth a frozen camera). `on_answer(msg, answer)` and
    `on_error(msg, exc)` run on the worker thread. close() lets the worker finish what is queued (up to `timeout`)."""

    def __init__(self, link, maxsize: int = 16, on_answer=None, on_error=None):
        import queue
        import threading

        self.link = link
        self.on_answer, self.on_error = on_answer, on_error
        self._q: "queue.Queue" = queue.Queue(maxsize=maxsize)
        self._lock = threading.Lock()
        self.sent = self.failed = self.dropped = 0
        self._stop = object()
        self._thread = threading.Thread(target=self._work, name="server-link-sender", daemon=True)
        self._thread.start()

    def submit(self, msg: dict) -> bool:
        """Queue one message. False when the queue is full (the message is dropped and counted). Never blocks."""
        import queue

        try:
            self._q.put_nowait(msg)
            return True
        except queue.Full:
            with self._lock:
                self.dropped += 1
            return False

    def _work(self):
        while True:
            msg = self._q.get()
            try:
                if msg is self._stop:
                    return
                try:
                    ans = self.link.send(msg)
                except OSError as e:
                    with self._lock:
                        self.failed += 1
                    if self.on_error:
                        self.on_error(msg, e)
                    continue
                with self._lock:
                    self.sent += 1
                if self.on_answer:
                    self.on_answer(msg, ans)
            finally:
                self._q.task_done()

    def counts(self) -> dict:
        with self._lock:
            return {"sent": self.sent, "failed": self.failed, "dropped": self.dropped, "queued": self._q.qsize()}

    def close(self, timeout: float = 5.0):
        """Send what is queued (up to `timeout` seconds), stop the worker, close the socket."""
        import queue

        try:
            self._q.put(self._stop, timeout=timeout)
        except queue.Full:
            pass
        self._thread.join(timeout)
        self.link.close()
