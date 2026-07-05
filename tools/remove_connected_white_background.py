"""Remove only the white background connected to an image edge.

Unlike a global chroma key, this preserves white artwork enclosed by a dark
outline (for example clouds, rabbit tails, and eggshells).
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--flood-threshold", type=int, default=76)
    parser.add_argument("--transparent-threshold", type=float, default=4.0)
    parser.add_argument("--opaque-threshold", type=float, default=62.0)
    args = parser.parse_args()

    source = Image.open(args.input).convert("RGB")
    key = np.asarray(source.getpixel((0, 0)), dtype=np.int16)

    flood_mask = source.copy()
    marker = (1, 2, 3)
    ImageDraw.floodfill(
        flood_mask,
        (0, 0),
        marker,
        thresh=max(0, min(255, args.flood_threshold)),
    )

    rgb = np.asarray(source, dtype=np.uint8)
    connected_background = np.all(np.asarray(flood_mask) == marker, axis=2)
    distance = np.max(np.abs(rgb.astype(np.int16) - key), axis=2).astype(np.float32)

    low = args.transparent_threshold
    high = max(low + 1.0, args.opaque_threshold)
    matte = np.clip((distance - low) / (high - low), 0.0, 1.0)
    alpha = np.where(connected_background, np.rint(matte * 255.0), 255).astype(np.uint8)

    rgba = np.dstack((rgb, alpha))
    output = Path(args.out)
    output.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgba, "RGBA").save(output, optimize=True)

    transparent = int(np.count_nonzero(alpha == 0))
    partial = int(np.count_nonzero((alpha > 0) & (alpha < 255)))
    print(f"Wrote {output} (transparent={transparent}, partial={partial})")


if __name__ == "__main__":
    main()
