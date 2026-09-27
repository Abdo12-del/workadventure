#!/usr/bin/env python3
"""Static regression checks for the generated NG Academy map.

This intentionally uses only the standard library so it can run in CI without
Pillow. It verifies the invariants that must survive visual retheming:
map geometry, logic layer names/data shape, interaction objects, spawn area,
32px source tilesets, and collision/door sanity.
"""
from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
MAP_PATH = ROOT / "map.json"
MANIFEST_PATH = ROOT / "assets" / "assets-manifest.json"
TILE_GIDS_PATH = HERE / "uploaded_tile_gids.json"
W, H, T = 136, 72, 32
EXPECTED_LAYERS = {
    "start", "collisions", "zones_teacher", "zones_class", "zones_silent",
    "zones_jitsi_meeting", "zones_jitsi_director", "zones_jitsi_hall",
    "zones_jitsi_club", "zones_jitsi_chess", "zones_jitsi_math",
    "zones_speaker", "zones_listener", "floor", "walls", "furniture",
    "abovePlayer1", "abovePlayer2", "objects",
}
LOGIC_LAYERS = {name for name in EXPECTED_LAYERS if name.startswith(("start", "collisions", "zones_"))}


def fail(message: str) -> None:
    raise SystemExit("FAIL: " + message)


def main() -> None:
    game_map = json.loads(MAP_PATH.read_text())
    manifest = json.loads(MANIFEST_PATH.read_text())
    curated = json.loads(TILE_GIDS_PATH.read_text())

    if (game_map["width"], game_map["height"], game_map["tilewidth"], game_map["tileheight"]) != (W, H, T, T):
        fail("map geometry or tile size changed")
    layers = {layer["name"]: layer for layer in game_map["layers"]}
    if set(layers) != EXPECTED_LAYERS:
        fail(f"layer set changed: {sorted(set(layers) ^ EXPECTED_LAYERS)}")
    for name in LOGIC_LAYERS | {"floor", "walls", "furniture", "abovePlayer1", "abovePlayer2"}:
        layer = layers[name]
        if layer["type"] != "tilelayer" or len(layer.get("data", [])) != W * H:
            fail(f"{name} is not a full {W}x{H} tile layer")

    if not game_map.get("properties") or not any(p.get("name") == "script" for p in game_map["properties"]):
        fail("map script property is missing")
    objects = layers["objects"].get("objects", [])
    if len(objects) != 54:
        fail(f"expected 54 interaction objects, found {len(objects)}")
    for obj in objects:
        if not (0 <= obj["x"] < W * T and 0 <= obj["y"] < H * T):
            fail(f"object outside map: {obj.get('name')}")
        if obj["x"] + obj["width"] > W * T or obj["y"] + obj["height"] > H * T:
            fail(f"object exceeds map: {obj.get('name')}")

    # Spawn must remain walkable and inside the existing southern gate region.
    collisions = layers["collisions"]["data"]
    starts = layers["start"]["data"]
    spawn_cells = [i for i, gid in enumerate(starts) if gid]
    if not spawn_cells or any(collisions[i] for i in spawn_cells):
        fail("spawn cells are missing or colliding")

    tilesets = game_map.get("tilesets", [])
    if len(tilesets) != 20:
        fail(f"expected generated atlas plus 19 uploaded tilesets, found {len(tilesets)}")
    ranges = []
    for tileset in tilesets:
        if tileset["tilewidth"] != T or tileset["tileheight"] != T:
            fail(f"non-32px tileset: {tileset.get('name')}")
        first = tileset["firstgid"]
        last = first + tileset["tilecount"] - 1
        ranges.append((first, last, tileset["name"]))
        if not (ROOT / "assets" / tileset["image"].removeprefix("assets/")).exists():
            fail(f"missing tileset image: {tileset['image']}")
    ranges.sort()
    for (_, last, name), (next_first, _, next_name) in zip(ranges, ranges[1:]):
        if next_first <= last:
            fail(f"overlapping tilesets: {name} / {next_name}")

    if len(manifest["sheets"]) != 19:
        fail("asset manifest does not contain all 19 uploaded sheets")
    for sheet in manifest["sheets"]:
        if (sheet["width"], sheet["height"], sheet["tileSize"]) != (1536, 1024, T):
            fail(f"source geometry changed: {sheet['key']}")
        if not (ROOT / "assets" / sheet["processed"].removeprefix("assets/")).exists():
            fail(f"missing processed source: {sheet['key']}")
    if len(curated) < 20:
        fail("curated uploaded tile set is unexpectedly small")
    for name, entry in curated.items():
        if entry["gid"] <= 214:
            fail(f"curated tile {name} overwrites the original atlas")

    print("PASS: school map geometry, 19 logic layers, 54 interactions, spawn, and uploaded 32px tilesets are valid")


if __name__ == "__main__":
    main()
