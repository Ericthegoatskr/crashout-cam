# Crashout Cam

**Mentally? This bird.**

A webcam meme toy with five original images, no captions, and two working versions: browser + Python. English is the default; Traditional Chinese is available from the language button and remembered locally.

**[Play Crashout Cam](https://crashout-cam.boundlessforge.chatgpt.site)** — open the link, click **Start camera**, and allow camera access.

[繁體中文說明](README.zh-TW.md)

**Source:** [Ericthegoatskr/crashout-cam](https://github.com/Ericthegoatskr/crashout-cam). The browser app is a static site; the Python app runs locally.

## Browser

No npm installation or build required:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open **http://localhost:4173**, click **Start camera**, and allow camera access. Or click the five thumbnails to preview without a camera. On this Mac, you can also double-click `start-web.command`.

- **Space** — start / stop camera.
- **1–5** — preview reactions while the camera is off.
- **F** — fullscreen camera + meme; **Esc** to leave.
- **Fine-tune reactions** — smile sensitivity, mouth sensitivity, and switching delay. Settings stay in this browser.
- **繁中 / EN** — change language without resetting your reaction or camera session.
- Switching tabs or leaving the page stops the camera; press Start camera when you return.
- Use a current Chrome, Edge, or Safari. Mobile fullscreen availability varies by browser.
- Remote hosting requires **HTTPS**. `file://` and ordinary LAN HTTP cannot request camera access.

Camera frames are processed in device memory. No video uploads, recordings, microphone access, or analytics. The site serves its own images, models, and WebAssembly runtime. Inference runs in a Web Worker, capped at 30 FPS; actual speed depends on the device.

## Python

Python 3.11 is recommended. A ready-to-use `.venv` is already installed on the current machine:

```sh
.venv/bin/python python/app.py
```

Or double-click `start-python.command` on this Mac.

First-time setup on another machine:

```sh
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python scripts/download_models.py
python python/app.py
```

On Windows, activate with `.venv\Scripts\activate`. If macOS blocks the camera, allow your terminal in **System Settings → Privacy & Security → Camera**, then restart the app.

```sh
# Preview images without opening a camera
.venv/bin/python python/app.py --preview

# Choose a different camera
.venv/bin/python python/app.py --camera 1

# Load both models and run inference without a camera or GUI
.venv/bin/python python/app.py --check
```

**Q / Esc** to quit, **F** for fullscreen, **R** to reset. Preview mode supports **1–5**. Live mode shows your camera on the left and the meme on the right, without captions or landmark overlays.

## Reactions

| Gesture | Reaction |
| --- | --- |
| Relax your face | Neutral |
| One hand beside either ear | All ears |
| Two hands, one on each side of your head | Overload |
| Open your mouth wide | Shocked |
| Smile | Happy |

Priority: **two hands → one hand → mouth open → smile → neutral**. The default Instant mode switches on the first recognized result, with no added hold delay. Optional 150/300/500 ms delays are available if you prefer steadier reactions. Existing v1 sensitivity preferences migrate automatically; the old delay is reset to Instant. Expression thresholds have hysteresis to reduce flicker. Losing the face for 700 ms returns to neutral.

Hand detection compares palms and knuckles to the sides of the face, normalized by face width. It does not detect precise ear locations or physical contact. Face the camera, use even lighting, and keep palms visible; hands hidden behind your head may not be detected. This toy reacts to visible geometry, not real emotions.

Both implementations share `dist/config.json`, images, and model files. Browser sliders are browser-local overrides; edit the shared config to change Python defaults too. Replace the five image files to customize the memes. Main images keep their original aspect ratio without cropping.

## Verification

```sh
node --test tests/detection.test.mjs
.venv/bin/python -m unittest discover -s tests
.venv/bin/python python/app.py --check
python3 scripts/download_models.py
```

The JavaScript and Python implementations share 29 behavior scenarios covering priority, face scale, mirrored coordinates, same-side hands, hysteresis, transient noise, and face loss. Asset and model integrity checks are included.

For browser integration checks, temporarily copy `tests/browser-smoke.html` to `dist/_qa.html`, start the local server, and open **http://localhost:4173/_qa.html**. It substitutes synthetic video for the physical camera inside an iframe, then tests the real WASM models, restart, track cleanup, permission failure, late permission cancellation, and English / Traditional Chinese switching. Remove `_qa.html` before publishing.

## Project layout

- `dist/` — deployable static browser app; no backend required.
- `python/` — native OpenCV window and matching detection logic.
- `tests/` — shared behavior fixtures and browser integration checks.
- `models-manifest.json` — official model URLs and SHA-256 hashes.
- `scripts/download_models.py` — verifies or restores the pinned model files.

## Sources and assets

The five meme images were supplied by the user. No ownership of the original characters or artwork is claimed.

MediaPipe Tasks Vision **1.2.2** is licensed under Apache-2.0; its license is included in `dist/vendor/mediapipe/LICENSE`. Face and hand models come from Google's official MediaPipe model storage. Implementation references: [Face Landmarker for Web](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js), [Hand Landmarker for Python](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/python).
