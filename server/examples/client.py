#!/usr/bin/env python3
"""A plain socket client for the sentence server, written like the lab clients (socket module, no libraries).

    python server/examples/client.py doctor help --place Clinic
Needs the server running:  npm run server   (TCP port 8788 by default)
"""
import argparse
import json
import socket


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("words", nargs="+")
    ap.add_argument("--place", default="Clinic", choices=["Clinic", "Shop", "Work", "Home"])
    ap.add_argument("--attempt", type=int, default=0)
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8788)
    a = ap.parse_args()
    request = {"id": "1", "type": "suggest", "words": [w.upper() for w in a.words], "place": a.place, "attempt": a.attempt}
    with socket.create_connection((a.host, a.port), timeout=6) as s:
        s.sendall((json.dumps(request) + "\n").encode("utf-8"))  # one JSON message per line
        data = b""
        while not data.endswith(b"\n"):
            chunk = s.recv(4096)
            if not chunk:
                break
            data += chunk
    reply = json.loads(data.decode("utf-8"))
    print(json.dumps(reply, indent=2))
    return 0 if reply.get("ok") else 1


if __name__ == "__main__":
    raise SystemExit(main())
