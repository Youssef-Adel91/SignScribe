"""Static-letter features ("hand60-v1"). Must stay identical to src/recognition/features.ts."""
from __future__ import annotations

import math

FEATURES_ID = "hand60-v1"
FEATURE_LENGTH = 60


def static_features(landmarks, width: float, height: float, mirror_x: bool = False):
    """landmarks: 21 x (x, y, z) in MediaPipe's normalised coordinates. Returns 60 floats or None.

    1. to pixel units (x*width, y*height, z*width)
    2. optional mirror of x
    3. subtract the wrist, divide by wrist -> middle-finger-knuckle distance (2D, pixels)
    4. drop the wrist: 20 landmarks x 3 numbers
    """
    if len(landmarks) != 21:
        return None
    sign = -1.0 if mirror_x else 1.0
    wx, wy, wz = landmarks[0][0] * width, landmarks[0][1] * height, landmarks[0][2] * width
    scale = math.hypot((landmarks[9][0] - landmarks[0][0]) * width, (landmarks[9][1] - landmarks[0][1]) * height)
    if not scale > 1e-6:
        return None
    out = []
    for i in range(1, 21):
        out.append(sign * (landmarks[i][0] * width - wx) / scale)
        out.append((landmarks[i][1] * height - wy) / scale)
        out.append((landmarks[i][2] * width - wz) / scale)
    return out
