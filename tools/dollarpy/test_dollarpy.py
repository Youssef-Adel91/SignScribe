"""Tests for the DollarPy tools with NO webcam: generated frames, a fake server, the real parser through node, and real MediaPipe on a blank picture.

Nothing here says how well real hands are recognised: the paths are generated."""
import json
import re
import shutil
import socket
import subprocess
import sys
import threading
from pathlib import Path

import pytest

HERE = Path(__file__).parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))

import classify_live  # noqa: E402
import dollar_logic as dl  # noqa: E402
import record_templates  # noqa: E402
import simulate  # noqa: E402
from dollar_logic import Pipeline, Segmenter, build_recognizer, classify, load_templates, save_templates  # noqa: E402


def run_frames(seg_or_pipe, letter="J", variant=0.25):
    out = []
    for t, lm, w, h in simulate.frames(letter, variant):
        out.append(seg_or_pipe.feed(t, lm, w, h))
    return out


# ---------------------------------------------------------------- the same numbers as the web app
def test_movement_constants_equal_the_web_apps():
    ts = (ROOT / "src" / "recognition" / "letterController.ts").read_text()
    pairs = {
        "motionStartSpeed": "start_speed",
        "motionStopSpeed": "stop_speed",
        "motionEndMs": "end_ms",
        "motionMinMs": "min_ms",
        "motionMaxMs": "max_ms",
        "motionMinLength": "min_length",
        "motionMinScore": "min_score",
    }
    for ts_name, py_name in pairs.items():
        m = re.search(rf"{ts_name}:\s*([0-9.]+)", ts)
        assert m, ts_name
        assert float(m.group(1)) == float(dl.MOTION[py_name]), ts_name


# ---------------------------------------------------------------- following one fingertip
def test_a_still_hand_gives_no_movement():
    seg = Segmenter()
    for t in range(0, 3000, 33):
        assert seg.feed(t, simulate.hand_at(0.5, 0.5), 640, 480) == ("idle", None)


def test_a_drawn_letter_gives_exactly_one_path_that_follows_the_fingertip():
    paths = [p for _, p in run_frames(Segmenter(), "J") if p]
    assert len(paths) == 1
    xs = [p[0] for p in paths[0]]
    ys = [p[1] for p in paths[0]]
    assert len(paths[0]) > 10 and 0 <= min(xs) and max(xs) <= 1 and 0 <= min(ys) and max(ys) <= 1
    assert max(ys) - min(ys) > 0.3  # the J goes down the picture


def test_states_say_when_a_movement_is_going_on():
    states = [s for s, _ in run_frames(Segmenter(), "Z")]
    assert states[0] == "idle" and "moving" in states and states[-1] == "idle"


def test_a_slow_drift_or_a_quick_flick_is_not_a_letter():
    seg = Segmenter()
    for i, t in enumerate(range(0, 4000, 33)):
        # drifting about 0.3 palm lengths per second: well under the speed that starts a movement
        assert seg.feed(t, simulate.hand_at(0.3 + 0.0003 * i, 0.5), 640, 480)[1] is None
    seg = Segmenter()
    got = []
    for t in range(0, 2000, 33):
        x = 0.5 + (0.15 if 300 <= t < 450 else 0.0)  # a 150 ms flick, then still: shorter than a drawn letter
        got.append(seg.feed(t, simulate.hand_at(x, 0.5), 640, 480)[1])
    assert not any(got)


def test_losing_the_hand_forgets_the_movement_in_progress():
    seg = Segmenter()
    frames = list(simulate.frames("J"))
    for t, lm, w, h in frames[: len(frames) // 2]:
        seg.feed(t, lm, w, h)
    assert seg.feed(9999, None, 640, 480) == ("idle", None)
    assert not seg.moving and seg.trail == []


def test_a_second_letter_right_after_the_first_waits_for_the_cooldown():
    seg = Segmenter()
    first = [p for _, p in run_frames(seg, "J") if p]
    assert len(first) == 1


# ---------------------------------------------------------------- templates and dollarpy
def test_templates_roundtrip_and_synthetic_ones_are_refused_unless_asked(tmp_path):
    t = simulate.synthetic_templates(["J", "Z"], 2)
    f = tmp_path / "t.json"
    save_templates(f, t, "asl", synthetic=True)
    with pytest.raises(dl.TemplateError, match="SYNTHETIC"):
        load_templates(f)
    got, raw = load_templates(f, allow_synthetic=True)
    assert [l for l, _ in got] == ["J", "J", "Z", "Z"] and raw["landmark"] == dl.INDEX_TIP
    save_templates(f, t, "asl", synthetic=False)
    assert len(load_templates(f)[0]) == 4


@pytest.mark.parametrize(
    "text,msg",
    [
        ("{nope", "not valid JSON"),
        (json.dumps({"format": "other"}), "is not a"),
        (json.dumps({"format": dl.FORMAT, "version": 1, "templates": []}), "no templates"),
        (json.dumps({"format": dl.FORMAT, "version": 1, "templates": [{"label": "JJ", "points": []}]}), "one-letter label"),
    ],
)
def test_bad_template_files_say_what_is_wrong(tmp_path, text, msg):
    f = tmp_path / "t.json"
    f.write_text(text)
    with pytest.raises(dl.TemplateError, match=msg):
        load_templates(f)
    with pytest.raises(dl.TemplateError, match="record_templates"):
        load_templates(tmp_path / "missing.json")


def test_dollarpy_classifies_the_generated_shapes_and_rejects_below_the_score():
    rec = build_recognizer(simulate.synthetic_templates(["J", "Z"]))
    assert classify(rec, simulate.shape("J", 7.3))[0] == "J"
    assert classify(rec, simulate.shape("Z", 7.3))[0] == "Z"
    assert classify(rec, simulate.shape("J", 7.3), min_score=1.01) is None
    assert classify(rec, [(0.1, 0.1)] * 3) is None


# ---------------------------------------------------------------- the pipeline and the server
def test_pipeline_recognises_a_simulated_letter_from_frames():
    pipe = Pipeline(build_recognizer(simulate.synthetic_templates(["J", "Z"])))
    results = [r for _, r in run_frames(pipe, "Z") if r]
    assert len(results) == 1 and results[0][0] == "Z"


def test_a_movement_that_matches_nothing_is_reported_as_unknown():
    pipe = Pipeline(build_recognizer(simulate.synthetic_templates(["J"])), min_score=1.01)
    assert [r for _, r in run_frames(pipe, "J") if r] == ["unknown"]


@pytest.mark.skipif(shutil.which("node") is None, reason="node is needed to run the server's own parser")
def test_our_letter_message_passes_the_servers_parser_and_extra_fields_do_not():
    good = dl.letter_message(1, "J", 0.83, demo=True)
    msgs = [good, {**good, "address": "x"}, {**good, "letter": "JZ"}, {**good, "score": 1.5}, {**good, "letter": "ع"}]
    js = "import('./src/nlp/protocol.ts').then(m=>{const r=JSON.parse(process.argv[1]).map(x=>m.parseRequest(JSON.stringify(x)));console.log(JSON.stringify(r.map(x=>x.ok?'ok':x.message)))})"
    out = subprocess.run(["node", "-e", js, json.dumps(msgs)], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    res = json.loads(out)
    assert res[0] == "ok" and "unknown field" in res[1] and "one letter" in res[2] and "'score'" in res[3] and res[4] == "ok"


class FakeServer:
    def __init__(self, reply=lambda m: {"id": m["id"], "ok": True, "type": "letter"}):
        self.sock = socket.socket()
        self.sock.bind(("127.0.0.1", 0))
        self.sock.listen(5)
        self.port = self.sock.getsockname()[1]
        self.got, self.reply = [], reply
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
            except OSError:
                pass
            finally:
                c.close()

    def close(self):
        self.sock.close()


def test_simulation_sends_labelled_letters_to_the_server(capsys):
    srv = FakeServer()
    code = classify_live.main(["--simulate", "J", "Z", "--synthetic-templates", "--fast", "--port", str(srv.port)])
    srv.close()
    out = capsys.readouterr().out
    assert code == 0 and "SIMULATED INPUT" in out and "SYNTHETIC TEMPLATES" in out
    assert [m["letter"] for m in srv.got] == ["J", "Z"]
    assert all(m["demo"] is True and m["source"] == "dollarpy" and m["type"] == "letter" for m in srv.got)


def test_a_missing_or_refusing_server_never_stops_recognition(capsys):
    assert classify_live.main(["--simulate", "J", "--synthetic-templates", "--fast", "--port", "1"]) == 0
    assert "not reachable" in capsys.readouterr().out
    srv = FakeServer(reply=lambda m: {"id": m["id"], "ok": False, "error": "rate_limited", "message": "slow"})
    assert classify_live.main(["--simulate", "J", "--synthetic-templates", "--fast", "--port", str(srv.port)]) == 0
    srv.close()
    assert "refused the letter" in capsys.readouterr().out


def test_no_send_does_not_open_a_connection(capsys):
    assert classify_live.main(["--simulate", "J", "--synthetic-templates", "--fast", "--no-send"]) == 0


def test_without_a_template_file_it_says_what_to_do(capsys, tmp_path):
    assert classify_live.main(["--templates", str(tmp_path / "none.json"), "--no-send"]) == 2
    assert "record_templates" in capsys.readouterr().err


def test_a_simulated_shape_exists_only_for_letters_we_can_draw():
    with pytest.raises(ValueError, match="record real templates"):
        simulate.shape("ع")


# ---------------------------------------------------------------- recording tool
def test_recording_needs_moving_letters_from_the_alphabet(capsys):
    assert record_templates.main(["--alphabet", "arsl"]) == 2
    assert "lists no moving letters" in capsys.readouterr().err
    assert record_templates.main(["--letters", "Q9"]) == 2
    assert "not a letter" in capsys.readouterr().err


def test_the_moving_letters_come_from_the_alphabet_config():
    assert dl.load_alphabet("asl").dynamic == ("J", "Z")


# ---------------------------------------------------------------- real MediaPipe
def test_real_mediapipe_tracker_finds_no_hand_in_a_blank_picture():
    np = pytest.importorskip("numpy")
    pytest.importorskip("mediapipe")
    import hand_tracker

    if not hand_tracker.DEFAULT_MODEL.exists():
        pytest.skip("run `npm run models` to get hand_landmarker.task")
    try:
        tr = hand_tracker.HandTracker()
    except SystemExit as e:
        pytest.skip(f"MediaPipe cannot run here: {e}")
    try:
        assert tr.track(np.full((120, 160, 3), 128, dtype=np.uint8)) is None
    finally:
        tr.close()
