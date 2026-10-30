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
