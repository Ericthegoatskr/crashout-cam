"""Download the pinned official Google models, safely replacing incomplete files."""
from pathlib import Path
import hashlib
import json
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / "models-manifest.json").read_text())
target = ROOT / "dist/models"
target.mkdir(parents=True, exist_ok=True)
for model in manifest:
    path = target / model["file"]
    if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest() == model["sha256"]:
        print(f"Verified {path.name}")
        continue
    temporary = path.with_suffix(".download")
    try:
        with urllib.request.urlopen(model["url"], timeout=60) as response, temporary.open("wb") as output:
            while chunk := response.read(1024 * 1024):
                output.write(chunk)
        if hashlib.sha256(temporary.read_bytes()).hexdigest() != model["sha256"]:
            raise RuntimeError(f"Checksum mismatch: {path.name}")
        temporary.replace(path)
        print(f"Downloaded and verified {path.name}")
    finally:
        temporary.unlink(missing_ok=True)
