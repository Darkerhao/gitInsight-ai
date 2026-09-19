"""Export the app icon from build/icon.svg.

Requires Pillow and resvg-py: python -m pip install Pillow resvg-py
Run from any directory: python scripts/generate-icons.py
"""

from io import BytesIO
from pathlib import Path

from PIL import Image
from resvg_py import svg_to_bytes


ROOT = Path(__file__).resolve().parents[1]
SIZES = (16, 24, 32, 48, 64, 128, 256, 512, 1024)


def main():
    images = {}
    for size in SIZES:
        image = Image.open(BytesIO(svg_to_bytes(
            svg_path=str(ROOT / "build/icon.svg"),
            width=size,
            height=size,
        ))).convert("RGBA")
        images[size] = image
        target = ROOT / f"build/icons/png/{size}x{size}.png"
        target.parent.mkdir(parents=True, exist_ok=True)
        image.save(target)

    for name in ("icon_1.png", "icon_2.png", "icon_4.png"):
        images[512].save(ROOT / "build" / name)
    images[256].save(ROOT / "src/renderer/src/assets/logo.png")

    win_icon = ROOT / "build/icons/win/icon.ico"
    mac_icon = ROOT / "build/icons/mac/icon.icns"
    win_icon.parent.mkdir(parents=True, exist_ok=True)
    mac_icon.parent.mkdir(parents=True, exist_ok=True)
    images[256].save(
        win_icon,
        sizes=[(size, size) for size in SIZES if size <= 256],
        append_images=[images[size] for size in SIZES if size < 256],
    )
    images[1024].save(mac_icon)
    print("Exported PNG, ICO, ICNS and renderer logo from build/icon.svg")


if __name__ == "__main__":
    main()
