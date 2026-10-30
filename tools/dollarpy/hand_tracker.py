"""MediaPipe hand tracking for the webcam tools (the hand's skeleton: 21 landmarks per hand).

Uses MediaPipe's Hand Landmarker (the tasks API: newer MediaPipe versions no longer ship the old `mp.solutions.hands` that
Lab 5 used). The model file is the one the web app uses: `npm run models` puts it in public/models/hand_landmarker.task."""
from __future__ import annotations

import hashlib
from pathlib import Path

DEFAULT_MODEL = Path(__file__).resolve().parents[2] / "public" / "models" / "hand_landmarker.task"


class HandTracker:
    def __init__(self, model_path: str | Path = DEFAULT_MODEL, min_confidence: float = 0.5, num_hands: int = 1):
        try:
            import mediapipe as mp
            from mediapipe.tasks import python as mpp
            from mediapipe.tasks.python import vision
        except (ImportError, OSError) as e:
            raise SystemExit(f"mediapipe cannot be loaded ({e}). pip install -r tools/dollarpy/requirements.txt (Linux also needs libegl1 libgles2)") from e
        if not Path(model_path).exists():
            raise SystemExit(f"hand model not found: {model_path} (run `npm run models`)")
        self._mp, self._model = mp, Path(model_path)
        self.min_confidence = min_confidence
        self._lm = vision.HandLandmarker.create_from_options(
            vision.HandLandmarkerOptions(
                base_options=mpp.BaseOptions(model_asset_path=str(model_path)),
                running_mode=vision.RunningMode.IMAGE,
                num_hands=num_hands,
                min_hand_detection_confidence=min_confidence,
                min_hand_presence_confidence=min_confidence,
            )
        )

    def describe(self) -> str:
        return f"mediapipe {self._mp.__version__}, {self._model.name} (sha256 {hashlib.sha256(self._model.read_bytes()).hexdigest()[:16]}...)"

    def track(self, rgb):
        """rgb: a height x width x 3 uint8 array (RGB order). Returns 21 [x, y, z] landmarks (picture units) or None."""
        res = self._lm.detect(self._mp.Image(image_format=self._mp.ImageFormat.SRGB, data=rgb))
        if not res.hand_landmarks:
            return None
        return [[float(p.x), float(p.y), float(p.z)] for p in res.hand_landmarks[0]]

    def close(self) -> None:
        self._lm.close()
