"""Extract transparent creator assets from the supplied checkerboard sprite sheets."""

from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT.parent / "images" / "source-sheets"
OUTPUT_DIR = ROOT / "static" / "assets" / "imagine" / "custom"


CROPS = {
    # These are the detached torso pieces from each supplied sheet, not the
    # complete reference animals.  Heads are kept separately so children can
    # mix them independently in the creator.
    "torsos": {
        "dog": (95, 780, 545, 1065),
        "duck": (540, 310, 1095, 665),
        "rabbit": (600, 380, 1025, 700),
        "cat": (320, 650, 735, 1020),
        "chick": (610, 950, 965, 1225),
        "pig": (715, 615, 1045, 920),
        "panda": (560, 640, 1100, 1020),
        "frog": (510, 110, 910, 480),
    },
    "heads": {
        "dog": (20, 65, 480, 415),
        "duck": (15, 45, 430, 385),
        "rabbit": (55, 135, 350, 395),
        "cat": (610, 55, 1110, 455),
        "chick": (410, 600, 800, 950),
        "pig": (645, 40, 1020, 365),
        "panda": (610, 70, 1110, 460),
        "frog": (25, 80, 475, 415),
    },
    "tails": {
        "dog": (585, 770, 790, 1030),
        "rabbit": (415, 605, 615, 815),
        "cat": (845, 760, 1122, 1295),
        "pig": (440, 1010, 675, 1295),
        "panda": (610, 1070, 860, 1330),
        "frog": (35, 430, 610, 650),
    },
    "wings": {
        "duck": (20, 570, 525, 860),
        "rabbit": (575, 660, 1110, 930),
        "chick": (790, 730, 1020, 930),
    },
    "specials": {
        "bamboo": (850, 1010, 1122, 1402),
    },
}

COMPONENT_COUNTS = {
    ("wings", "duck"): 2,
    ("wings", "rabbit"): 2,
}

ERASE_REGIONS = {
    # On the chick sheet, nearby reference pieces touch the detached head.
    # Mask only those edge fragments while preserving the head itself.
    ("heads", "chick"): [
        (410, 600, 545, 710),
        (750, 600, 800, 715),
        (410, 920, 475, 950),
        (760, 920, 800, 950),
    ],
}


def foreground_mask(image: Image.Image) -> Image.Image:
    """Build a clean mask while preserving pale regions enclosed by dark outlines."""
    rgb = np.asarray(image.convert("RGB"), dtype=np.int16)
    channel_min = rgb.min(axis=2)
    channel_spread = rgb.max(axis=2) - channel_min

    # Checkerboard tiles are bright, almost neutral gray. Dark outlines and
    # colored fills are reliable foreground seeds.
    seed = (channel_min < 208) | (channel_spread > 24)
    seed_image = Image.fromarray(np.where(seed, 255, 0).astype(np.uint8), "L")
    seed_image = seed_image.filter(ImageFilter.MaxFilter(5))

    # Fill pale/white interiors enclosed by the seeded outlines.
    flooded = seed_image.copy()
    ImageDraw.floodfill(flooded, (0, 0), 128, thresh=0)
    flooded_array = np.asarray(flooded)
    solid = Image.fromarray(np.where(flooded_array == 128, 0, 255).astype(np.uint8), "L")

    # Recreate the supplied white sticker edge without retaining checker tiles.
    return solid.filter(ImageFilter.MaxFilter(15))


def transparent_sheet(source: Image.Image) -> Image.Image:
    source = source.convert("RGBA")
    alpha = foreground_mask(source)
    pixels = np.asarray(source).copy()
    solid = np.asarray(alpha) > 0
    core = np.asarray(alpha.filter(ImageFilter.MinFilter(15))) > 0
    ring = solid & ~core
    pixels[ring, :3] = 255
    pixels[~solid, :3] = 255
    pixels[:, :, 3] = np.asarray(alpha)
    return Image.fromarray(pixels, "RGBA")


def trim(image: Image.Image, padding: int = 8) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        raise ValueError("crop contains no visible sprite")
    left = max(0, bbox[0] - padding)
    top = max(0, bbox[1] - padding)
    right = min(image.width, bbox[2] + padding)
    bottom = min(image.height, bbox[3] + padding)
    return image.crop((left, top, right, bottom))


def keep_largest_components(image: Image.Image, count: int = 1) -> Image.Image:
    """Remove neighboring sheet pieces accidentally included in a crop."""
    binary = np.asarray(image.getchannel("A")) > 0
    labels = np.zeros(binary.shape, dtype=np.int32)
    sizes: list[tuple[int, int]] = []
    next_label = 0

    for y, x in np.argwhere(binary):
        if labels[y, x]:
            continue
        next_label += 1
        labels[y, x] = next_label
        queue = deque([(int(y), int(x))])
        area = 0
        while queue:
            cy, cx = queue.popleft()
            area += 1
            for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                if 0 <= ny < binary.shape[0] and 0 <= nx < binary.shape[1] and binary[ny, nx] and not labels[ny, nx]:
                    labels[ny, nx] = next_label
                    queue.append((ny, nx))
        if area >= 80:
            sizes.append((area, next_label))

    sizes.sort(reverse=True)
    selected_labels = [label for _, label in sizes[:count]]
    selected = np.isin(labels, selected_labels)

    output = image.copy()
    output.putalpha(Image.fromarray(np.where(selected, 255, 0).astype(np.uint8), "L"))
    return output


def main() -> None:
    sheets = {
        animal: transparent_sheet(Image.open(SOURCE_DIR / f"{animal}.png"))
        for animal in ("dog", "duck", "rabbit", "cat", "chick", "pig", "panda", "frog")
    }

    for category, assets in CROPS.items():
        category_dir = OUTPUT_DIR / category
        category_dir.mkdir(parents=True, exist_ok=True)
        for name, box in assets.items():
            source_animal = "panda" if name == "bamboo" else name
            sprite = sheets[source_animal].crop(box)
            alpha = sprite.getchannel("A")
            alpha_draw = ImageDraw.Draw(alpha)
            for erase_box in ERASE_REGIONS.get((category, name), []):
                alpha_draw.rectangle((
                    erase_box[0] - box[0],
                    erase_box[1] - box[1],
                    erase_box[2] - box[0],
                    erase_box[3] - box[1],
                ), fill=0)
            sprite.putalpha(alpha)
            sprite = keep_largest_components(sprite, COMPONENT_COUNTS.get((category, name), 1))
            sprite = trim(sprite)
            output_path = category_dir / f"{name}.png"
            sprite.save(output_path, optimize=True)
            print(f"{output_path.relative_to(ROOT)} {sprite.width}x{sprite.height}")


if __name__ == "__main__":
    main()
