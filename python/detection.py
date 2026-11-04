"""Shared behavior with dist/detection.js; input points are plain dictionaries."""
from math import hypot


def classify(face, hands, scores, config, aspect=4 / 3, previous="neutral"):
    if not face:
        return None
    def distance(a, b):
        return hypot((a["x"] - b["x"]) * aspect, a["y"] - b["y"])
    left, right = sorted((face[234], face[454]), key=lambda p: p["x"])
    width = distance(left, right)
    if width < 0.02:
        return None
    middle_x = (left["x"] + right["x"]) / 2
    nearby = []
    for hand in hands:
        palm = [hand[i] for i in (0, 5, 9, 13, 17)]
        center_x = sum(p["x"] for p in palm) / len(palm)
        radius = config["handDistance"] * width
        nearby.append({
            "left": center_x < middle_x and any(distance(p, left) < radius for p in palm),
            "right": center_x > middle_x and any(distance(p, right) < radius for p in palm),
        })
    if any(h["left"] and any(j != i and other["right"] for j, other in enumerate(nearby)) for i, h in enumerate(nearby)):
        return "overload"
    if any(h["left"] or h["right"] for h in nearby):
        return "listen"
    jaw = scores.get("jawOpen", 0)
    smile = (scores.get("mouthSmileLeft", 0) + scores.get("mouthSmileRight", 0)) / 2
    if jaw >= config["jawThreshold"] * (config["releaseRatio"] if previous == "shock" else 1):
        return "shock"
    if smile >= config["smileThreshold"] * (config["releaseRatio"] if previous == "happy" else 1):
        return "happy"
    return "neutral"


class Stabilizer:
    def __init__(self, config):
        self.config = config
        self.reset()

    def reset(self):
        self.current = "neutral"
        self.candidate = "neutral"
        self.since = 0
        self.missing_since = None

    def update(self, raw, now):
        if raw is None:
            self.candidate = self.current
            self.since = now
            if self.missing_since is None:
                self.missing_since = now
            if now - self.missing_since >= self.config["lostFaceMs"]:
                self.current = "neutral"
            return self.current
        self.missing_since = None
        if raw != self.candidate:
            self.candidate, self.since = raw, now
        if raw != self.current and now - self.since >= self.config["holdMs"]:
            self.current = raw
        return self.current
