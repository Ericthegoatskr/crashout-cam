import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "python"))
from detection import classify, Stabilizer

CONFIG = json.loads((ROOT / "dist/config.json").read_text())
CASES = json.loads((ROOT / "tests/cases.json").read_text())


class DetectionTests(unittest.TestCase):
    def test_classification(self):
        for case in CASES["classification"]:
            with self.subTest(case["name"]):
                def point(x, y):
                    scale = case.get("scale", 1)
                    return {"x": .5 + (x - .5) * scale, "y": .5 + (y - .5) * scale}
                face = [point(.5, .5) for _ in range(478)]
                face[234], face[454] = point(.35, .4), point(.65, .4)
                if case.get("mirrorFace"):
                    face[234], face[454] = face[454], face[234]
                hands = [[point(x, y) for _ in range(21)] for x, y in case.get("hands", [])]
                result = classify(None if case.get("missing") else face, hands, case.get("scores", {}), CONFIG, case.get("aspect", 4 / 3), case.get("previous", "neutral"))
                self.assertEqual(result, case["expected"])

    def test_temporal(self):
        for case in CASES["temporal"]:
            with self.subTest(case["name"]):
                state = Stabilizer({**CONFIG, "holdMs": case.get("holdMs", 300)})
                for raw, time, expected in case["sequence"]:
                    self.assertEqual(state.update(raw, time), expected)

    def test_reset(self):
        state = Stabilizer(CONFIG)
        state.update("happy", 0)
        state.update("happy", 300)
        state.reset()
        self.assertEqual(state.current, "neutral")


if __name__ == "__main__":
    unittest.main()
