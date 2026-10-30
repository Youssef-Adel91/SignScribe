#!/usr/bin/env python3
"""Bluetooth presence scanner (Bleak, like Lab 3).

Scans for nearby BLE devices, turns the ones listed in a local config file into a UserID and a place
(Clinic / Shop / Work / Home) and sends  {userId, place, rssi}  to the sentence server's TCP socket, one JSON line per
message. The server tells the web app, which then loads that place and that person's saved settings.

    pip install -r tools/bluetooth/requirements.txt
    cp tools/bluetooth/devices.example.json tools/bluetooth/devices.json      # then edit it (git-ignored)
    npm run server
    python tools/bluetooth/scan.py

    python tools/bluetooth/scan.py --fake youssef:Clinic     # DEMO WITHOUT HARDWARE: a simulated device, clearly labelled

Device addresses stay in your config file: they are never logged, printed or sent.
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from ble_logic import (  # noqa: E402
    FAKE_BANNER,
    PLACES,
    Config,
    ConfigError,
    Entry,
    Reporter,
    ServerLink,
    Settings,
    Sighting,
    Tracker,
    load_config,
    match_scan,
)

DEFAULT_CONFIG = Path(__file__).parent / "devices.json"
FAKE_NAME = "FAKE-DEVICE"


class BluetoothUnavailable(Exception):
    pass


async def bleak_scan(seconds: float) -> list:
    """One real scan with Bleak. Needs a Bluetooth adapter that is switched on."""
    try:
        from bleak import BleakScanner
        from bleak.exc import BleakError
    except ImportError as e:
        raise SystemExit("Bleak is not installed: pip install -r tools/bluetooth/requirements.txt") from e
    try:
        found = await BleakScanner.discover(timeout=seconds, return_adv=True)
    except (BleakError, OSError, PermissionError) as e:
        raise BluetoothUnavailable(str(e) or type(e).__name__) from e
    out = []
    for dev, adv in found.values():
        out.append(Sighting(dev.address, adv.local_name or dev.name, int(adv.rssi)))
    return out


def fake_config(spec: str, host: str, port: int, settings: Settings) -> tuple[Config, str]:
    """`--fake USER:PLACE` (either may be empty). Returns a config with one simulated device."""
    user, _, place = spec.partition(":")
    user, place = user.strip() or None, place.strip() or None
    if place is not None and place not in PLACES:
        raise ConfigError(f"--fake place must be one of {', '.join(PLACES)}")
    if user is None and place is None:
        raise ConfigError("--fake needs USER:PLACE, for example youssef:Clinic")
    entry = Entry(0, "fake-device", user, place, name=FAKE_NAME)
    return Config(host, port, settings, (entry,)), FAKE_NAME


async def run(cfg: Config, scan, reporter: Reporter, log=print, max_scans: int | None = None, verbose: bool = False, sleep=asyncio.sleep) -> None:
    tracker = Tracker(cfg.settings)
    n = 0
    unavailable = False
    while max_scans is None or n < max_scans:
        n += 1
        try:
            sightings = await scan(cfg.settings.seconds)
            if unavailable:
                log("Bluetooth is back")
            unavailable = False
        except BluetoothUnavailable as e:
            if not unavailable:
                log(f"Bluetooth is off or not available ({e}). Nothing is reported; the app keeps its manual place choice.")
            unavailable, sightings = True, []
        user, place, others = match_scan(sightings, cfg)
        if verbose:
            log(f"scan {n}: user {'yes' if user else 'no'}, place {'yes' if place else 'no'}, {others} other devices ignored")
        reporter.report(tracker.update(user, place))
        await sleep(cfg.settings.pause_seconds)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", default=str(DEFAULT_CONFIG), help="devices.json (see devices.example.json)")
    ap.add_argument("--host", help="sentence server host (default from the config, else 127.0.0.1)")
    ap.add_argument("--port", type=int, help="sentence server TCP port (default from the config, else 8788)")
    ap.add_argument("--fake", metavar="USER:PLACE", help="DEMO ONLY: simulate one device, e.g. youssef:Clinic or :Shop. No Bluetooth hardware is used")
    ap.add_argument("--fake-rssi", type=int, default=-55)
    ap.add_argument("--fake-seconds", type=float, help="the fake device disappears after this many seconds (shows the app falling back)")
    ap.add_argument("--scans", type=int, help="stop after this many scans (default: run until Ctrl+C)")
    ap.add_argument("-v", "--verbose", action="store_true", help="one line per scan with counts only (never a device)")
    a = ap.parse_args(argv)
    try:
        if a.fake is not None:
            base = Settings(seconds=0.5, pause_seconds=0.5)
            cfg, _ = fake_config(a.fake, a.host or "127.0.0.1", a.port or 8788, base)
        else:
            cfg = load_config(a.config)
            if a.host or a.port:
                cfg = Config(a.host or cfg.host, a.port or cfg.port, cfg.settings, cfg.entries)
    except ConfigError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2
    demo = a.fake is not None
    if demo:
        print(FAKE_BANNER)
        started = [None]

        async def scan(seconds):
            loop = asyncio.get_running_loop()
            started[0] = started[0] if started[0] is not None else loop.time()
            await asyncio.sleep(seconds)
            if a.fake_seconds is not None and loop.time() - started[0] > a.fake_seconds:
                return []
            return [Sighting(None, FAKE_NAME, a.fake_rssi)]
    else:
        scan = bleak_scan
    link = ServerLink(cfg.host, cfg.port)
    reporter = Reporter(link, demo, cfg.settings.heartbeat_seconds, log=print)
    print(f"{'FAKE ' if demo else ''}scanner running; sending to {cfg.host}:{cfg.port}. Ctrl+C to stop.")
    try:
        asyncio.run(run(cfg, scan, reporter, print, a.scans, a.verbose))
    except KeyboardInterrupt:
        pass
    finally:
        link.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
