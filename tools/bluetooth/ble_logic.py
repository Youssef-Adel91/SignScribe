"""The parts of the Bluetooth scanner that do not need Bluetooth: reading the config, matching what was seen to a
UserID and a place, smoothing, building the message and sending it to the sentence server's TCP socket.

Privacy rules (tested): a device address is read from the local config and compared in memory. It is never logged,
never printed, and never put in a message. Logs show only the `label` from the config (or "device #N").
"""
from __future__ import annotations

import json
import re
import socket
import time
from dataclasses import dataclass, field
from pathlib import Path

PLACES = ("Clinic", "Shop", "Work", "Home")
FAKE_BANNER = "*** FAKE BLE DEVICE: this is a demo, no Bluetooth hardware is being scanned ***"


class ConfigError(ValueError):
    pass


def looks_like_address(text: str) -> bool:
    """A 48-bit Bluetooth address (AA:BB:CC:DD:EE:FF) or a 128-bit id as macOS shows it: never allowed as a log label."""
    return bool(re.fullmatch(r"(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}", text) or re.fullmatch(r"[0-9A-Fa-f]{8}(?:-[0-9A-Fa-f]{4}){3}-[0-9A-Fa-f]{12}", text))


def norm_address(a: str) -> str:
    return "".join(c for c in a.lower() if c.isalnum())


@dataclass(frozen=True)
class Entry:
    index: int
    label: str
    user_id: str | None
    place: str | None
    address: str | None = None
    name: str | None = None
    name_prefix: str | None = None

    def matches(self, address: str | None, name: str | None) -> bool:
        if self.address is not None:
            return address is not None and norm_address(address) == self.address
        if name is None:
            return False
        if self.name is not None:
            return name == self.name
        return self.name_prefix is not None and name.startswith(self.name_prefix)


@dataclass(frozen=True)
class Settings:
    seconds: float = 4.0
    pause_seconds: float = 1.0
    min_rssi: int = -85
    confirm_scans: int = 2
    lost_after_scans: int = 3
    heartbeat_seconds: float = 5.0


@dataclass(frozen=True)
class Config:
    host: str
    port: int
    settings: Settings
    entries: tuple


def _need(cond, msg):
    if not cond:
        raise ConfigError(msg)


def parse_config(raw: dict) -> Config:
    _need(isinstance(raw, dict), "the config must be a JSON object")
    srv = raw.get("server", {})
    host, port = srv.get("host", "127.0.0.1"), srv.get("port", 8788)
    _need(isinstance(host, str) and isinstance(port, int) and 0 < port < 65536, "server.host must be text and server.port a port number")
    sc = raw.get("scan", {})
    base = Settings()
    s = Settings(
        seconds=float(sc.get("seconds", base.seconds)),
        pause_seconds=float(sc.get("pause_seconds", base.pause_seconds)),
        min_rssi=int(sc.get("min_rssi", base.min_rssi)),
        confirm_scans=int(sc.get("confirm_scans", base.confirm_scans)),
        lost_after_scans=int(sc.get("lost_after_scans", base.lost_after_scans)),
        heartbeat_seconds=float(sc.get("heartbeat_seconds", base.heartbeat_seconds)),
    )
    _need(0.5 <= s.seconds <= 30, "scan.seconds must be between 0.5 and 30")
    _need(s.confirm_scans >= 1 and s.lost_after_scans >= 1, "confirm_scans and lost_after_scans must be at least 1")
    _need(-127 <= s.min_rssi <= 0, "scan.min_rssi must be a dBm value from -127 to 0")
    _need(1 <= s.heartbeat_seconds <= 10, "scan.heartbeat_seconds must be 1 to 10 (the server forgets a presence after 15 s)")
    devices = raw.get("devices")
    _need(isinstance(devices, list) and devices, "devices must be a non-empty list")
    entries, seen = [], set()
    for i, d in enumerate(devices):
        where = f"devices[{i}]"
        _need(isinstance(d, dict), f"{where} must be an object")
        m = d.get("match")
        _need(isinstance(m, dict) and len(m) == 1 and next(iter(m)) in ("address", "name", "name_prefix"), f"{where}.match needs exactly one of address, name, name_prefix")
        key, val = next(iter(m.items()))
        _need(isinstance(val, str) and val.strip(), f"{where}.match.{key} must be text")
        uid, place = d.get("userId"), d.get("place")
        _need(uid is not None or place is not None, f"{where} needs a userId, a place or both")
        _need(uid is None or (isinstance(uid, str) and re.fullmatch(r"[A-Za-z0-9_-]{1,32}", uid)), f"{where}.userId must be 1-32 letters, digits, - or _")
        _need(place is None or place in PLACES, f"{where}.place must be one of {', '.join(PLACES)}")
        kw = {"address": norm_address(val)} if key == "address" else {key: val}
        ident = (key, kw.get("address") or val)
        _need(ident not in seen, f"{where} matches the same device as an earlier entry")
        seen.add(ident)
        label = d.get("label") or f"device #{i + 1}"
        _need(isinstance(label, str) and len(label) <= 40 and not looks_like_address(label), f"{where}.label must be a short text that is not a device address (it is what appears in logs)")
        entries.append(Entry(i, str(label), uid, place, **kw))
    return Config(host, port, s, tuple(entries))


def load_config(path: str | Path) -> Config:
    p = Path(path)
    if not p.exists():
        raise ConfigError(f"{p} not found. Copy tools/bluetooth/devices.example.json to devices.json and edit it (or use --fake for a demo with no hardware)")
    try:
        return parse_config(json.loads(p.read_text(encoding="utf-8")))
    except json.JSONDecodeError as e:
        raise ConfigError(f"{p}: not valid JSON ({e.msg}, line {e.lineno})") from e


@dataclass(frozen=True)
class Sighting:
    """One device seen in one scan. The address is kept only for matching inside this process."""

    address: str | None
    name: str | None
    rssi: int


@dataclass(frozen=True)
class Found:
    label: str
    value: str
    rssi: int


def match_scan(sightings, cfg: Config):
    """Strongest known user device and strongest known place device in one scan, plus how many devices were ignored."""
    sightings = list(sightings)
    best_user: tuple | None = None
    best_place: tuple | None = None
    known = 0
    for sg in sightings:
        if sg.rssi < cfg.settings.min_rssi:
            continue
        for e in cfg.entries:
            if not e.matches(sg.address, sg.name):
                continue
            known += 1
            if e.user_id and (best_user is None or sg.rssi > best_user[1]):
                best_user = (Found(e.label, e.user_id, sg.rssi), sg.rssi)
            if e.place and (best_place is None or sg.rssi > best_place[1]):
                best_place = (Found(e.label, e.place, sg.rssi), sg.rssi)
            break
    return (best_user[0] if best_user else None, best_place[0] if best_place else None, max(0, len(sightings) - known))


class Smoother:
    """Switch to a new value only after `confirm` scans in a row, and forget it only after `lost` empty scans: Bluetooth signal strength jumps around."""

    def __init__(self, confirm: int, lost: int):
        self.confirm, self.lost = confirm, lost
        self.value: Found | None = None
        self._cand: str | None = None
        self._cand_n = 0
        self._miss = 0

    def update(self, found: Found | None) -> Found | None:
        if found is None:
            self._cand, self._cand_n = None, 0
            self._miss += 1
            if self.value is not None and self._miss >= self.lost:
                self.value = None
            return self.value
        self._miss = 0
        if self.value is not None and found.value == self.value.value:
            self.value = found  # same one: refresh the signal strength
            self._cand, self._cand_n = None, 0
        elif self.value is None and self.confirm <= 1:
            self.value = found
        else:
            if found.value == self._cand:
                self._cand_n += 1
            else:
                self._cand, self._cand_n = found.value, 1
            if self._cand_n >= self.confirm:
                self.value, self._cand, self._cand_n = found, None, 0
        return self.value


@dataclass
class Presence:
    user_id: str | None = None
    place: str | None = None
    rssi: int | None = None

    def key(self):
        return (self.user_id, self.place)


class Tracker:
    def __init__(self, s: Settings):
        self.user = Smoother(s.confirm_scans, s.lost_after_scans)
        self.place = Smoother(s.confirm_scans, s.lost_after_scans)

    def update(self, user: Found | None, place: Found | None) -> Presence:
        u, p = self.user.update(user), self.place.update(place)
        rssi = u.rssi if u else (p.rssi if p else None)
        return Presence(u.value if u else None, p.value if p else None, rssi)


def build_message(seq: int, p: Presence, demo: bool) -> dict:
    """The one JSON object sent per line. No address, no device name: only the ids from the config and a signal strength."""
    return {"id": f"p{seq}", "type": "presence", "userId": p.user_id, "place": p.place, "rssi": p.rssi if (p.user_id or p.place) else None, "demo": demo}


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


@dataclass
class Reporter:
    """Sends a presence when it changed and a heartbeat otherwise, never faster than once a second."""

    link: object
    demo: bool
    heartbeat: float
    clock: object = time.monotonic
    seq: int = 0
    last_key: tuple | None = None
    last_sent: float = -1e9
    log: object = print
    backoff_until: float = 0.0
    sent: list = field(default_factory=list)

    def report(self, p: Presence) -> bool:
        now = self.clock()
        if now < self.backoff_until:
            return False
        if self.last_key is None and not (p.user_id or p.place):
            return False  # nothing has been reported yet and nothing is found: stay quiet, the app already behaves as without Bluetooth
        changed = p.key() != self.last_key
        if not changed and now - self.last_sent < self.heartbeat:
            return False
        if now - self.last_sent < 1.0:
            return False
        self.seq += 1
        msg = build_message(self.seq, p, self.demo)
        try:
            ans = self.link.send(msg)
        except OSError as e:
            self.log(f"server not reachable ({type(e).__name__}); will try again")
            self.backoff_until = now + 3.0
            return False
        self.last_sent = now
        if not ans.get("ok"):
            self.log(f"server refused the message: {ans.get('error')}: {ans.get('message')}")
            if ans.get("error") == "rate_limited":
                self.backoff_until = now + 10.0
            return False
        if changed:
            self.last_key = p.key()
            self.log(describe(p, self.demo))
        self.sent.append(msg)
        return True


def describe(p: Presence, demo: bool) -> str:
    tag = " [FAKE DEVICE]" if demo else ""
    if not (p.user_id or p.place):
        return "nobody known nearby" + tag
    return f"user {p.user_id or '-'}, place {p.place or '-'}, signal {p.rssi} dBm{tag}"
