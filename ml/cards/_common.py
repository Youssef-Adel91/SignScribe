import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTEXTS = ROOT / "src/data/contexts.json"


def classes():
    return json.loads(CONTEXTS.read_text(encoding="utf-8"))["classes"]
