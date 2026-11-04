"""Crashout Cam: local, caption-free webcam + meme window."""
import argparse
import json
from pathlib import Path
import sys
import time

from detection import classify, Stabilizer

ROOT = Path(__file__).resolve().parents[1]


def points(landmarks):
    return [{"x": p.x, "y": p.y} for p in landmarks]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--camera", type=int, default=0, help="Camera index (default: 0)")
    parser.add_argument("--preview", action="store_true", help="Preview the 5 images without opening a camera")
    parser.add_argument("--check", action="store_true", help="Load both models and run blank-frame inference without a camera")
    args = parser.parse_args()
    import cv2
    import numpy as np
    import mediapipe as mp
    config = json.loads((ROOT / "dist/config.json").read_text())
    images = {}
    for state in config["states"]:
        image = cv2.imread(str(ROOT / "dist" / state["image"]))
        if image is None:
            raise RuntimeError(f"Cannot read image: {state['image']}")
        images[state["id"]] = image
    face = hands = cap = None
    window_created = False
    title = "Crashout Cam"

    def fit(image, width=640, height=480):
        h, w = image.shape[:2]
        scale = min(width / w, height / h)
        resized = cv2.resize(image, (max(1, round(w * scale)), max(1, round(h * scale))))
        canvas = np.full((height, width, 3), 16, dtype=np.uint8)
        y, x = (height - resized.shape[0]) // 2, (width - resized.shape[1]) // 2
        canvas[y:y + resized.shape[0], x:x + resized.shape[1]] = resized
        return canvas

    try:
        if not args.preview:
            for model in ("face_landmarker", "hand_landmarker"):
                if not (ROOT / f"dist/models/{model}.task").is_file():
                    raise RuntimeError("Model missing. Run: python scripts/download_models.py")
            vision = mp.tasks.vision
            face = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
                base_options=mp.tasks.BaseOptions(model_asset_path=str(ROOT / "dist/models/face_landmarker.task")),
                running_mode=vision.RunningMode.VIDEO, num_faces=1, output_face_blendshapes=True,
            ))
            hands = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
                base_options=mp.tasks.BaseOptions(model_asset_path=str(ROOT / "dist/models/hand_landmarker.task")),
                running_mode=vision.RunningMode.VIDEO, num_hands=2,
            ))
            if args.check:
                blank = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.zeros((480, 640, 3), dtype=np.uint8))
                face_result = face.detect_for_video(blank, 1)
                hand_result = hands.detect_for_video(blank, 1)
                assert not face_result.face_landmarks and not hand_result.hand_landmarks
                print("OK: 5 images, both models, and blank-frame inference. No camera opened.")
                return
            cap = cv2.VideoCapture(args.camera)
            if not cap.isOpened():
                raise RuntimeError("Cannot open camera. Allow camera access for your terminal in macOS System Settings, or try --camera 1.")
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cv2.namedWindow(title, cv2.WINDOW_NORMAL)
        window_created = True
        cv2.resizeWindow(title, 1280, 480)
        print("Q / Esc: quit | F: fullscreen | R: reset | Preview mode: 1–5 switches images")
        state = "neutral"
        stabilizer = Stabilizer(config)
        thumbnails = {key: fit(image) for key, image in images.items()}
        fullscreen = False
        timestamp = 0
        while True:
            started = time.monotonic()
            if args.preview:
                panel = thumbnails[state]
            else:
                ok, frame = cap.read()
                if not ok:
                    raise RuntimeError("Camera disconnected or could not provide a frame.")
                frame = cv2.flip(frame, 1)
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                image = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(rgb))
                timestamp = max(timestamp + 1, int(time.monotonic() * 1000))
                face_result = face.detect_for_video(image, timestamp)
                hand_result = hands.detect_for_video(image, timestamp)
                face_points = points(face_result.face_landmarks[0]) if face_result.face_landmarks else None
                scores = {b.category_name: b.score for b in face_result.face_blendshapes[0]} if face_result.face_blendshapes else {}
                raw = classify(face_points, [points(h) for h in hand_result.hand_landmarks], scores, config, frame.shape[1] / frame.shape[0], stabilizer.current)
                state = stabilizer.update(raw, timestamp)
                panel = np.hstack((fit(frame), thumbnails[state]))
            cv2.imshow(title, panel)
            delay = max(1, int(1000 / config["maxFps"] - (time.monotonic() - started) * 1000))
            key = cv2.waitKey(delay) & 0xFF
            if key in (ord("q"), 27) or cv2.getWindowProperty(title, cv2.WND_PROP_VISIBLE) < 1:
                break
            if args.preview and ord("1") <= key <= ord("5"):
                state = config["states"][key - ord("1")]["id"]
            if key == ord("r"):
                stabilizer.reset()
                state = "neutral"
            if key == ord("f"):
                fullscreen = not fullscreen
                cv2.setWindowProperty(title, cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN if fullscreen else cv2.WINDOW_NORMAL)
    finally:
        if cap is not None:
            cap.release()
        if face is not None:
            face.close()
        if hands is not None:
            hands.close()
        if window_created:
            cv2.destroyAllWindows()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
    except Exception as error:
        print(f"Error: {error}", file=sys.stderr)
        sys.exit(1)
