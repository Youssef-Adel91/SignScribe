"""Tests for the Bluetooth scanner with NO Bluetooth hardware: fake scans, a fake server, and the real protocol parser (node)."""
import asyncio
import json
import shutil
import socket
import subprocess
import sys
import threading
from pathlib import Path

import pytest

HERE = Path(__file__).parent
sys.path.insert(0, str(HERE))

import scan  # noqa: E402
from ble_logic import (  # noqa: E402
    ConfigError,
    Presence,
    Reporter,
    ServerLink,
    Settings,
    Sighting,
    Smoother,
    Found,
    Tracker,
    build_message,
    load_config,
    looks_like_address,
    match_scan,
    parse_config,
)

ROOT = HERE.parents[1]
ADDR = "AA:BB:CC:DD:EE:01"


def cfg(devices=None, **scan_over):
    return parse_config(
        {
            "scan": {"min_rssi": -85, "confirm_scans": 1, "lost_after_scans": 2, **scan_over},
            "devices": devices
            or [
                {"label": "band", "match": {"name": "Band"}, "userId": "youssef"},
                {"label": "phone", "match": {"address": ADDR}, "userId": "sara"},
                {"label": "beacon-clinic", "match": {"name_prefix": "SS-CLINIC"}, "place": "Clinic"},
                {"label": "beacon-shop", "match": {"name": "SS-SHOP"}, "place": "Shop"},
                {"label": "tag", "match": {"address": "aa-bb-cc-dd-ee-02"}, "userId": "youssef", "place": "Work"},
            ],
        }
    )


# ---------------------------------------------------------------- config
def test_the_shipped_example_is_a_valid_config():
    c = load_config(HERE / "devices.example.json")
    assert len(c.entries) == 5 and c.port == 8788


@pytest.mark.parametrize(
    "mutate,msg",
    [
        (lambda r: r.update(devices=[]), "non-empty"),
        (lambda r: r["devices"][0].update(match={"name": "x", "address": "y"}), "exactly one"),
        (lambda r: r["devices"][0].update(userId=None), "userId, a place or both"),
        (lambda r: r["devices"][0].update(place="Moon"), "place must be one of"),
        (lambda r: r["devices"][0].update(userId="bad id!"), "userId must be"),
        (lambda r: r["devices"][0].update(label="AA:BB:CC:DD:EE:01"), "not a device address"),
        (lambda r: r["devices"].append(dict(r["devices"][0])), "same device"),
        (lambda r: r.update(scan={"heartbeat_seconds": 30}), "heartbeat_seconds"),
        (lambda r: r.update(server={"port": 0}), "port"),
    ],
)
def test_bad_configs_are_refused_with_a_reason(mutate, msg):
    raw = json.loads((HERE / "devices.example.json").read_text())
    mutate(raw)
    with pytest.raises(ConfigError, match=msg):
        parse_config(raw)


def test_a_missing_or_broken_file_says_what_to_do(tmp_path):
    with pytest.raises(ConfigError, match="devices.example.json"):
        load_config(tmp_path / "nope.json")
    (tmp_path / "x.json").write_text("{nope")
    with pytest.raises(ConfigError, match="not valid JSON"):
        load_config(tmp_path / "x.json")


def test_what_looks_like_an_address():
    assert looks_like_address("AA:BB:CC:DD:EE:01") and looks_like_address("aa-bb-cc-dd-ee-01")
    assert looks_like_address("0F5C3B2A-1D4E-4A6B-9C8D-7E6F5A4B3C2D")
    assert not looks_like_address("my-band")


# ---------------------------------------------------------------- matching
def test_strongest_known_user_and_place_win_and_unknown_devices_are_only_counted():
    c = cfg()
    seen = [
        Sighting("11:22:33:44:55:66", "Someone's TV", -40),
        Sighting("A0:00:00:00:00:01", "Band", -70),
        Sighting("a0:00:00:00:00:02", "SS-CLINIC-3", -60),
        Sighting("A0:00:00:00:00:03", "SS-SHOP", -50),
        Sighting(ADDR.lower().replace(":", "-"), None, -55),  # sara's phone, other address spelling
    ]
    user, place, others = match_scan(seen, c)
    assert (user.value, user.rssi, user.label) == ("sara", -55, "phone")
    assert (place.value, place.rssi) == ("Shop", -50)
    assert others == 1


def test_weak_devices_are_ignored_and_a_tag_can_give_user_and_place():
    c = cfg()
    assert match_scan([Sighting(None, "Band", -90)], c)[:2] == (None, None)
    u, p, _ = match_scan([Sighting("AA:BB:CC:DD:EE:02", None, -60)], c)
    assert (u.value, p.value) == ("youssef", "Work")


def test_names_are_exact_and_prefixes_are_prefixes():
    c = cfg()
    assert match_scan([Sighting(None, "Band 2", -50)], c)[0] is None
    assert match_scan([Sighting(None, "SS-CLINIC", -50)], c)[1].value == "Clinic"
    assert match_scan([Sighting(None, "XSS-CLINIC", -50)], c)[1] is None


# ---------------------------------------------------------------- smoothing
def found(v, rssi=-50):
    return Found("l", v, rssi)


def test_a_new_value_needs_confirming_scans_and_loss_needs_several_empty_scans():
    s = Smoother(confirm=2, lost=3)
    assert s.update(found("a")) is None and s.update(found("a")).value == "a"
    assert s.update(found("b")).value == "a"  # one odd scan does not switch
    assert s.update(found("a")).value == "a"
    assert s.update(None).value == "a" and s.update(None).value == "a"
    assert s.update(None) is None
    assert s.update(found("a")) is None  # coming back also needs confirming


def test_tracker_reports_user_place_and_signal():
    t = Tracker(Settings(confirm_scans=1, lost_after_scans=1))
    p = t.update(Found("b", "youssef", -61), Found("c", "Clinic", -70))
    assert (p.user_id, p.place, p.rssi) == ("youssef", "Clinic", -61)
    assert t.update(None, Found("c", "Clinic", -70)).rssi == -70
    assert t.update(None, None).key() == (None, None)


# ---------------------------------------------------------------- message and the real parser
def test_messages_have_exactly_the_documented_fields():
    m = build_message(3, Presence("youssef", "Clinic", -58), demo=False)
    assert m == {"id": "p3", "type": "presence", "userId": "youssef", "place": "Clinic", "rssi": -58, "demo": False}
    n = build_message(4, Presence(), demo=True)
    assert n["userId"] is None and n["place"] is None and n["rssi"] is None and n["demo"] is True


@pytest.mark.skipif(shutil.which("node") is None, reason="node is needed to run the server's own parser")
def test_every_message_we_build_passes_the_servers_parser_and_an_address_does_not():
    msgs = [
        build_message(1, Presence("youssef", "Clinic", -58), False),
        build_message(2, Presence(None, "Shop", -70), False),
        build_message(3, Presence("a_b-1", None, -90), True),
        build_message(4, Presence(), False),
        {**build_message(5, Presence("u", "Home", -50), False), "address": ADDR},  # must be refused
    ]
    js = (
        "import('./src/nlp/protocol.ts').then(m=>{const r=JSON.parse(process.argv[1]).map(x=>m.parseRequest(JSON.stringify(x)));"
        "console.log(JSON.stringify(r.map(x=>x.ok?'ok':x.message)))})"
    )
    out = subprocess.run(["node", "-e", js, json.dumps(msgs)], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    res = json.loads(out)
    assert res[:4] == ["ok"] * 4
    assert "unknown field 'address'" in res[4]


# ---------------------------------------------------------------- the link and the reporter
class FakeServer:
    """Plain TCP server that answers each JSON line like the sentence server does."""

    def __init__(self, reply=lambda m: {"id": m["id"], "ok": True, "type": "presence"}):
        self.sock = socket.socket()
        self.sock.bind(("127.0.0.1", 0))
        self.sock.listen(5)
        self.port = self.sock.getsockname()[1]
        self.got, self.reply, self.drop_after = [], reply, None
        threading.Thread(target=self._serve, daemon=True).start()

    def _serve(self):
        while True:
            try:
                c, _ = self.sock.accept()
            except OSError:
                return
            f = c.makefile("rwb")
            try:
                for line in f:
                    m = json.loads(line)
                    self.got.append(m)
                    f.write((json.dumps(self.reply(m)) + "\n").encode())
                    f.flush()
                    if self.drop_after and len(self.got) >= self.drop_after:
                        self.drop_after = None
                        break
            except OSError:
                pass
            finally:
                c.close()

    def close(self):
        self.sock.close()


def test_the_link_sends_one_json_line_and_reads_the_answer_and_reconnects():
    srv = FakeServer()
    link = ServerLink("127.0.0.1", srv.port)
    assert link.send({"id": "a", "type": "presence"})["ok"]
    srv.drop_after = 2
    assert link.send({"id": "b"})["ok"]
    assert link.send({"id": "c"})["ok"]  # the server closed the connection: a new one is opened
    assert [m["id"] for m in srv.got] == ["a", "b", "c"]
    link.close()
    srv.close()
    with pytest.raises(OSError):
        ServerLink("127.0.0.1", srv.port, timeout=0.3).send({"id": "x"})


class Clock:
    t = 100.0

    def __call__(self):
        return self.t


def reporter(link, clock, heartbeat=5.0, logs=None):
    return Reporter(link, False, heartbeat, clock=clock, log=(logs.append if logs is not None else print))


class Link:
    def __init__(self, answer=None, err=None):
        self.sent, self.answer, self.err = [], answer, err

    def send(self, m):
        if self.err:
            raise self.err
        self.sent.append(m)
        return self.answer or {"id": m["id"], "ok": True, "type": "presence"}


def test_it_sends_changes_at_once_a_heartbeat_otherwise_and_never_faster_than_once_a_second():
    clock, link, logs = Clock(), Link(), []
    r = reporter(link, clock, logs=logs)
    p = Presence("youssef", "Clinic", -60)
    assert r.report(p)
    clock.t += 0.4
    assert not r.report(Presence("sara", "Clinic", -60))  # changed, but under 1 s since the last message
    clock.t += 1
    assert r.report(Presence("sara", "Clinic", -60))
    clock.t += 2
    assert not r.report(Presence("sara", "Clinic", -61))  # same person and place: wait for the heartbeat
    clock.t += 3.5
    assert r.report(Presence("sara", "Clinic", -61))
    assert [m["userId"] for m in link.sent] == ["youssef", "sara", "sara"]
    assert len([l for l in logs if "user" in l]) == 2  # logged on change only


def test_an_unreachable_or_busy_server_makes_it_wait_and_never_crash():
    clock, logs = Clock(), []
    r = reporter(Link(err=ConnectionRefusedError()), clock, logs=logs)
    assert not r.report(Presence("u", None, -50))
    clock.t += 1
    assert not r.report(Presence("u", None, -50))  # still backing off (3 s)
    busy = Link(answer={"id": "p1", "ok": False, "error": "rate_limited", "message": "slow"})
    r2 = reporter(busy, clock, logs=logs)
    assert not r2.report(Presence("u", None, -50))
    clock.t += 5
    assert not r2.report(Presence("u", None, -50))  # backing off 10 s after rate_limited
    assert any("rate_limited" in l for l in logs)


# ---------------------------------------------------------------- the whole loop with fake scans
def run_loop(scans, config=None, **kw):
    config = config or cfg()
    logs, link, clock = [], Link(), Clock()
    r = Reporter(link, kw.get("demo", False), 5.0, clock=clock, log=logs.append)
    it = iter(scans)

    async def fake_scan(_seconds):
        s = next(it)
        if isinstance(s, Exception):
            raise s
        return s

    async def sleep(_):
        clock.t += 2.0

    asyncio.run(scan.run(config, fake_scan, r, logs.append, max_scans=len(scans), verbose=True, sleep=sleep))
    return logs, link.sent


def test_the_loop_never_logs_or_sends_a_device_address_or_name():
    secret = [Sighting(ADDR, "Sara's private phone", -50), Sighting("11:22:33:44:55:66", "Stranger's watch", -40)]
    logs, sent = run_loop([secret] * 4 + [[]] * 4)
    text = " ".join(logs) + json.dumps(sent)
    for needle in ("AA:BB", "aabbcc", "EE:01", "private", "Stranger", "11:22:33", "112233"):
        assert needle.lower() not in text.lower(), needle
    assert any("user sara" in l for l in logs) and any("nobody" in l for l in logs)
    assert [m["userId"] for m in sent][:1] == ["sara"] and sent[-1]["userId"] is None


def test_bluetooth_off_is_said_once_and_reports_nobody_after_a_while():
    off = scan.BluetoothUnavailable("adapter is powered off")
    on = [Sighting(None, "Band", -50)]
    logs, sent = run_loop([on, on, off, off, off, off, on, on])
    assert sum("Bluetooth is off" in l for l in logs) == 1
    assert any("Bluetooth is back" in l for l in logs)
    assert any(m["userId"] is None for m in sent)  # the app is told nobody is there, so it falls back


def test_fake_mode_is_labelled_in_the_banner_and_in_every_message(capsys):
    c, _ = scan.fake_config("youssef:Clinic", "127.0.0.1", 1, Settings(confirm_scans=1, lost_after_scans=1, seconds=0.5))
    logs, sent = run_loop([[Sighting(None, scan.FAKE_NAME, -55)]] * 2, config=c, demo=True)
    assert sent and all(m["demo"] is True for m in sent)
    assert {m["userId"] for m in sent} == {"youssef"} and sent[0]["place"] == "Clinic"
    assert any("FAKE DEVICE" in l for l in logs)
    assert "FAKE BLE DEVICE" in scan.FAKE_BANNER
    with pytest.raises(ConfigError):
        scan.fake_config("youssef:Moon", "h", 1, Settings())
    with pytest.raises(ConfigError):
        scan.fake_config(":", "h", 1, Settings())


def test_real_mode_never_marks_a_message_as_demo():
    _, sent = run_loop([[Sighting(None, "Band", -50)]] * 3, config=cfg())
    assert sent and all(m["demo"] is False for m in sent)


def test_the_bleak_wrapper_turns_adapter_errors_into_bluetooth_unavailable(monkeypatch):
    import types

    class BleakError(Exception):
        pass

    class Dev:
        address, name = ADDR, "x"

    class Adv:
        local_name, rssi = "Band", -60

    class Scanner:
        mode = "ok"

        @staticmethod
        async def discover(timeout, return_adv):
            if Scanner.mode == "err":
                raise BleakError("Bluetooth device is turned off")
            return {ADDR: (Dev(), Adv())}

    mod, exc = types.ModuleType("bleak"), types.ModuleType("bleak.exc")
    mod.BleakScanner, exc.BleakError = Scanner, BleakError
    monkeypatch.setitem(sys.modules, "bleak", mod)
    monkeypatch.setitem(sys.modules, "bleak.exc", exc)
    got = asyncio.run(scan.bleak_scan(0.1))
    assert got == [Sighting(ADDR, "Band", -60)]
    Scanner.mode = "err"
    with pytest.raises(scan.BluetoothUnavailable, match="turned off"):
        asyncio.run(scan.bleak_scan(0.1))


def test_cli_fake_end_to_end_against_a_fake_server(capsys):
    srv = FakeServer()
    code = scan.main(["--fake", "youssef:Clinic", "--port", str(srv.port), "--scans", "3"])
    srv.close()
    out = capsys.readouterr().out
    assert code == 0 and "FAKE BLE DEVICE" in out
    assert srv.got and all(m["demo"] is True and m["userId"] == "youssef" for m in srv.got)


def test_fake_banner_is_flushed_when_stdout_is_a_pipe():
    """A launcher reads the banner through a pipe; Python must not hold it back in its buffer (it is flushed at once)."""
    import os, subprocess, sys, time
    from pathlib import Path

    env = {k: v for k, v in os.environ.items() if k != "PYTHONUNBUFFERED"}
    scan = Path(__file__).with_name("scan.py")
    p = subprocess.Popen(
        [sys.executable, str(scan), "--fake", "x:Shop", "--port", "59999"],
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env,
    )
    try:
        t0 = time.time()
        first = p.stdout.readline()  # blocks until the line is really in the pipe
        assert "FAKE BLE DEVICE" in first, first
        assert time.time() - t0 < 8
    finally:
        p.kill()
        p.wait()
