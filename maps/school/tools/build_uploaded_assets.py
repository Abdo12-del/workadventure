#!/usr/bin/env python3
"""Prepare the uploaded school asset sheets for a 32x32 Tiled map.

The uploaded sheets are kept at their original 1536x1024 resolution.  This
script only removes the presentation background by a corner flood-fill and
writes a manifest describing every source.  Each processed sheet is a real
32px tile sheet (48 columns x 32 rows), so no source art is scaled, blurred,
or flattened into a background image.

ImageMagick is used deliberately here: the repository's existing Python
asset builder uses Pillow, while the Arena image workspace may not have
Pillow installed.  Run from the repository root:

    python3 maps/school/tools/build_uploaded_assets.py
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parent / "assets"
SOURCES = ASSETS / "source-sheets"
PROCESSED = SOURCES / "processed"
TILE = 32
COLS = 48
ROWS = 32
BACKGROUND_FUZZ = "12%"
BASE_TILECOUNT = 214  # ng-tiles.png; existing GIDs must remain unchanged.

# Stable keys are used by build_map.py.  Original Arabic filenames remain in
# the manifest and on disk; keys are only code-facing labels.
CATALOG = [
    ("hall_a", "أصول قاعة النجوم ورقة A — الأرضيات والجدران والمسرح .png", "hall / floors, walls, stage", "magenta"),
    ("chess", "اصول فصل الشطرنج.png", "chess room", "magenta"),
    ("math_b", "الحساب الذهني ورقة B — الوسائل التعليمية والتخزين وركن التحدي.png", "mental math / manipulatives and storage", "blue"),
    ("seating", "المقاعد والردهة والإخراج.png", "seating, lobby, production", "magenta"),
    ("library_a", "المكتبة ورقة A — الأرضيات، الجدران، الرفوف، مكتب أمين المكتبة.png", "library / floors, walls, shelves, librarian", "cream"),
    ("stage", "عناصر المسرح والاحتفالات.png", "stage and celebrations", "magenta"),
    ("math_a", "فصل الحساب الذهني ورقة A — الأرضيات، الجدران، طاولات الأطفال، منطقة المدرب.png", "mental math / classroom and trainer", "blue"),
    ("fixed_style", "كتلة  الأسلوب الثابتة.png", "fixed style primitives", "magenta"),
    ("director_b", "مكت المدير ورقة B — الأرشيف، طاولة الاجتماعات، الباب المزدوج، الديكور.png", "director office / archive, meeting table, doors", "cream"),
    ("director_a", "مكتب المدير ورقة A — الأرضيات، الجدران، المكتب الرئيسي وأدواته.png", "director office / executive desk and tools", "cream"),
    ("library_b", "مكتبة ورقة B — طاولات القراءة، ركن القصص، ركن الحاسوب، الديكور.png", "library / reading, story and computer corners", "cream"),
    ("club_a", "نادي المبدعين الصغار ورقة A — الأرضيات، الجدران، دائرة الحوار.png", "creative club / floors, walls, dialogue circle", "cream"),
    ("club_b", "نادي المبدعين ورقة B — الرفوف، ألعاب التفكير، ركن القصص، الديكور.png", "creative club / shelves, games and story corner", "cream"),
    ("outdoor", "ورقة  العناصر الخارجية.png", "outdoor campus and play area", "magenta"),
    ("science_a", "ورقة A — الأرضيات، الجدران، طاولات المختبر، منطقة المدرب.png", "science / floors, walls, lab benches, trainer", "blue"),
    ("science_b", "ورقة B — الحوض والسلامة والتخزين وركن الاستكشاف.png", "science / sink, safety, storage and discovery", "blue"),
    ("classroom_furniture", "ورقة أثاث الفصول والممرات.png", "classrooms and corridors furniture", "magenta"),
    ("floors", "ورقة الأرضيات.png", "shared floors and paths", "magenta"),
    ("walls", "ورقة الجدران والأبواب والنوافذ.png", "shared walls, doors and windows", "magenta"),
]

# These are intentionally named semantic samples, not replacements for the
# whole library.  Coordinates are source-sheet tile coordinates.  They are
# used for the first visual pass in build_map.py and make the provenance of
# every new map tile explicit.
CURATED = {
    "floor_grass": ("floors", 2, 3),
    "floor_grass_flowers": ("floors", 8, 3),
    "floor_stone_path": ("floors", 20, 3),
    "floor_pale_tile": ("floors", 8, 15),
    "floor_wood": ("floors", 14, 15),
    "floor_red_carpet": ("floors", 43, 15),
    "floor_blue_rug": ("floors", 25, 15),
    "floor_sand": ("floors", 14, 21),
    "wall_cap": ("walls", 4, 2),
    "wall_body": ("walls", 4, 3),
    "wall_base": ("walls", 4, 4),
    "wall_window": ("walls", 41, 3),
    "door_wood": ("walls", 3, 17),
    "window_double": ("walls", 8, 22),
    "fence": ("walls", 3, 29),
    "office_desk": ("director_a", 8, 16),
    "library_shelf": ("library_a", 0, 15),
    "lab_bench": ("science_a", 4, 15),
    "lab_trainer": ("science_a", 0, 22),
    "chess_table": ("chess", 5, 15),
    "math_table": ("math_a", 5, 15),
    "club_circle": ("club_a", 7, 15),
    "hall_seat": ("hall_a", 5, 15),
}


def identify(path: Path) -> dict[str, str]:
    out = subprocess.check_output(
        ["identify", "-format", "%wx%h|%m|%[channels]|%[colorspace]|%[pixel:p{0,0}]", str(path)],
        text=True,
    ).strip()
    size, fmt, channels, colorspace, corner = out.split("|", 4)
    width, height = (int(v) for v in size.split("x", 1))
    return {
        "width": width,
        "height": height,
        "format": fmt,
        "channels": channels,
        "colorspace": colorspace,
        "corner": corner,
    }


def transparent_rgba(source: Path) -> bytes:
    # A corner flood-fill preserves white pixels inside books, screens and
    # paper while removing only the connected presentation background.
    return subprocess.check_output(
        [
            "convert", str(source),
            "-alpha", "on", "-fuzz", BACKGROUND_FUZZ,
            "-fill", "none", "-draw", "matte 0,0 floodfill",
            "-depth", "8", "rgba:-",
        ]
    )


def write_rgba(path: Path, width: int, height: int, raw: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        ["convert", "-size", f"{width}x{height}", "-depth", "8", "rgba:-", "png32:" + str(path)],
        input=raw,
        check=True,
    )


def nonempty_tiles(raw: bytes, width: int, height: int) -> int:
    count = 0
    stride = width * 4
    for ty in range(0, height, TILE):
        for tx in range(0, width, TILE):
            present = False
            for y in range(ty, min(ty + TILE, height)):
                row = raw[y * stride : (y + 1) * stride]
                for x in range(tx, min(tx + TILE, width)):
                    if row[x * 4 + 3]:
                        present = True
                        break
                if present:
                    break
            count += int(present)
    return count


def gid_for(firstgid: int, col: int, row: int) -> int:
    if not (0 <= col < COLS and 0 <= row < ROWS):
        raise ValueError(f"source tile outside 48x32 grid: {col},{row}")
    return firstgid + row * COLS + col


def main() -> None:
    PROCESSED.mkdir(parents=True, exist_ok=True)
    missing = [filename for _, filename, _, _ in CATALOG if not (SOURCES / filename).exists()]
    if missing:
        raise SystemExit("Missing uploaded source sheet(s):\n" + "\n".join(missing))

    sheets = []
    firstgid = BASE_TILECOUNT + 1
    for key, filename, category, background in CATALOG:
        source = SOURCES / filename
        meta = identify(source)
        if (meta["width"], meta["height"]) != (1536, 1024):
            raise ValueError(f"{filename}: expected 1536x1024, got {meta['width']}x{meta['height']}")
        raw = transparent_rgba(source)
        expected = meta["width"] * meta["height"] * 4
        if len(raw) != expected:
            raise ValueError(f"{filename}: ImageMagick returned {len(raw)} bytes, expected {expected}")
        processed = PROCESSED / filename
        write_rgba(processed, meta["width"], meta["height"], raw)
        sheets.append({
            "key": key,
            "source": f"assets/source-sheets/{filename}",
            "processed": f"assets/source-sheets/processed/{filename}",
            "originalFilename": filename,
            "category": category,
            "background": background,
            "width": meta["width"],
            "height": meta["height"],
            "format": meta["format"],
            "channelsBeforeProcessing": meta["channels"],
            "colorspace": meta["colorspace"],
            "tileSize": TILE,
            "columns": COLS,
            "rows": ROWS,
            "nonEmptyTiles": nonempty_tiles(raw, meta["width"], meta["height"]),
            "transparentAfterProcessing": True,
            "sha256Source": hashlib.sha256(source.read_bytes()).hexdigest(),
            "firstgid": firstgid,
            "tilecount": COLS * ROWS,
        })
        firstgid += COLS * ROWS

    by_key = {sheet["key"]: sheet for sheet in sheets}
    curated = {}
    for name, (key, col, row) in CURATED.items():
        sheet = by_key[key]
        curated[name] = {
            "gid": gid_for(sheet["firstgid"], col, row),
            "sheet": key,
            "sourceTile": {"column": col, "row": row},
            "image": sheet["processed"],
        }

    manifest = {
        "version": 1,
        "description": "Uploaded NG Academy school sheets, organized without scaling and cut on a 32x32 grid.",
        "sourceRoot": "assets/source-sheets",
        "processedRoot": "assets/source-sheets/processed",
        "tileSize": TILE,
        "backgroundRemoval": {
            "method": "corner flood-fill",
            "fuzz": BACKGROUND_FUZZ,
            "preservesInteriorPixels": True,
        },
        "sheets": sheets,
        "curatedTiles": curated,
    }
    (ASSETS / "assets-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    (HERE / "uploaded_tile_gids.json").write_text(json.dumps(curated, ensure_ascii=False, indent=2) + "\n")
    print(f"Processed {len(sheets)} source sheets; {sum(s['nonEmptyTiles'] for s in sheets)} non-empty 32px cells.")
    print(f"Wrote {ASSETS / 'assets-manifest.json'} and {HERE / 'uploaded_tile_gids.json'}")


if __name__ == "__main__":
    main()
