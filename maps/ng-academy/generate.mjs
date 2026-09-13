#!/usr/bin/env node
/**
 * NG Academy — أكاديمية الجيل الجديد
 * School-world map generator (phase 3).
 *
 * Generates, in a fully reproducible way (no randomness: uuids are derived from
 * names), the TMJ (Tiled) + WAM (WorkAdventure Map v2.1.0) pairs of the school world:
 *
 *   entrance.wam            المدخل + الاستقبال + الساحة (hub)
 *   classroom-*.wam (x7)    الفصول السبعة (عربي، إنجليزي، رياضيات، علوم، شطرنج، قراءة، تواصل)
 *   library.wam             المكتبة (منطقة صامتة)
 *   science-lab.wam         مختبر العلوم
 *   theater.wam             المسرح
 *   creativity-hall.wam     قاعة الإبداع
 *   achievements-hall.wam   قاعة الإنجازات
 *
 * Visuals come from a small hand-drawn (pixel-buffer) child-friendly tileset,
 * assets/ng-tileset.png, generated next to the maps. Behavioural zones are plain
 * Tiled layer properties (exitUrl / startLayer / silent) and WAM areas
 * (livekitRoomProperty audio-first rooms, tooltipPropertyData Arabic labels).
 *
 * Usage: node maps/ng-academy/generate.mjs
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TILE = 32;

/* ------------------------------------------------------------------ *
 * Deterministic ids (uuid v5-ish, stable across runs)
 * ------------------------------------------------------------------ */
function uuid(scope, name) {
  const h = createHash("sha1")
    .update(`ng-academy:${scope}:${name}`)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/* ------------------------------------------------------------------ *
 * Child-friendly pixel tileset (assets/ng-tileset.png)
 * 8 columns x 2 rows of 32px tiles:
 *   0 floorA   1 floorB   2 floorYard  3 carpet   4 wall   5 wallTop
 *   6 stage    7 desk     8 chair      9 board   10 shelf 11 plant
 *  12 doormat 13 labtable 14 sofa     15 floorHall
 *  Math-classroom row (16..23):
 *  16 abacus   17 boardMath 18 numberLine 19 posterShapes
 *  20 posterNumbers 21 rugMath 22 teacherDesk 23 clock
 * ------------------------------------------------------------------ */
const PAL = {
  floorA: [234, 247, 255],
  floorB: [255, 255, 255],
  floorYard: [205, 238, 214],
  grass: [168, 220, 180],
  carpet: [255, 233, 168],
  carpetEdge: [255, 214, 107],
  wall: [56, 182, 255],
  wallDark: [30, 151, 214],
  wallTop: [127, 208, 255],
  wallCap: [255, 255, 255],
  stage: [217, 160, 102],
  stageLine: [181, 127, 69],
  desk: [232, 195, 154],
  deskEdge: [196, 152, 105],
  chair: [43, 143, 214],
  chairDark: [28, 110, 170],
  board: [255, 255, 255],
  boardFrame: [56, 182, 255],
  shelf: [169, 113, 61],
  shelfLine: [124, 79, 40],
  bookA: [255, 138, 122],
  bookB: [88, 179, 104],
  bookC: [255, 214, 107],
  plant: [88, 179, 104],
  plantDark: [60, 140, 80],
  pot: [201, 111, 74],
  mat: [207, 216, 220],
  matEdge: [144, 164, 174],
  lab: [245, 247, 248],
  labEdge: [56, 182, 255],
  sofa: [255, 138, 122],
  sofaDark: [224, 100, 88],
  hall: [255, 246, 232],
  clockFace: [255, 255, 255],
  apple: [224, 60, 60],
  ink: [30, 60, 90],
  beadRed: [255, 138, 122],
  beadGreen: [88, 179, 104],
  beadYellow: [255, 214, 107],
  beadBlue: [43, 143, 214],
};

/* 3x5 pixel font for digits and basic math signs (posters, boards, number line). */
const GLYPHS = {
  0: ["111", "101", "101", "101", "111"],
  1: ["010", "110", "010", "010", "111"],
  2: ["111", "001", "111", "100", "111"],
  3: ["111", "001", "111", "001", "111"],
  4: ["101", "101", "111", "001", "001"],
  5: ["111", "100", "111", "001", "111"],
  6: ["111", "100", "111", "101", "111"],
  7: ["111", "001", "010", "010", "010"],
  8: ["111", "101", "111", "101", "111"],
  9: ["111", "101", "111", "001", "111"],
  "+": ["000", "010", "111", "010", "000"],
  "-": ["000", "000", "111", "000", "000"],
  "=": ["000", "111", "000", "111", "000"],
  "×": ["101", "101", "010", "101", "101"],
};

function drawText(px, x0, y0, text, color, scale = 1) {
  let cx = x0;
  for (const ch of String(text)) {
    const glyph = GLYPHS[ch];
    if (glyph) {
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 3; c++)
          if (glyph[r][c] === "1")
            for (let sy = 0; sy < scale; sy++)
              for (let sx = 0; sx < scale; sx++)
                px(cx + c * scale + sx, y0 + r * scale + sy, color);
    }
    cx += 4 * scale;
  }
}

function disc(px, cx, cy, r, color) {
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++)
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) px(x, y, color);
}

function makeTile(draw) {
  const buf = Buffer.alloc(TILE * TILE * 4);
  const px = (x, y, c, a = 255) => {
    if (x < 0 || y < 0 || x >= TILE || y >= TILE) return;
    const i = (y * TILE + x) * 4;
    buf[i] = c[0];
    buf[i + 1] = c[1];
    buf[i + 2] = c[2];
    buf[i + 3] = a;
  };
  const rect = (x0, y0, w, h, c) => {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) px(x, y, c);
  };
  draw(px, rect);
  return buf;
}

const TILES = [
  // 0 floorA
  (px, rect) => {
    rect(0, 0, 32, 32, PAL.floorA);
    px(6, 6, PAL.floorB);
    px(22, 18, PAL.floorB);
  },
  // 1 floorB
  (px, rect) => {
    rect(0, 0, 32, 32, PAL.floorB);
    px(10, 10, PAL.floorA);
    px(24, 24, PAL.floorA);
  },
  // 2 floorYard
  (px, rect) => {
    rect(0, 0, 32, 32, PAL.floorYard);
    px(4, 8, PAL.grass);
    px(5, 7, PAL.grass);
    px(18, 20, PAL.grass);
    px(19, 19, PAL.grass);
    px(26, 6, PAL.grass);
  },
  // 3 carpet
  (px, rect) => {
    rect(0, 0, 32, 32, PAL.carpet);
    for (let i = 0; i < 32; i++) {
      px(i, 0, PAL.carpetEdge);
      px(i, 31, PAL.carpetEdge);
      px(0, i, PAL.carpetEdge);
      px(31, i, PAL.carpetEdge);
    }
  },
  // 4 wall
  (px, rect) => {
    rect(0, 0, 32, 32, PAL.wall);
    rect(0, 26, 32, 6, PAL.wallDark);
    rect(0, 0, 32, 3, PAL.wallTop);
  },
  // 5 wallTop
  (px, rect) => {
    rect(0, 0, 32, 32, PAL.wallTop);
    rect(0, 0, 32, 6, PAL.wallCap);
    rect(0, 28, 32, 4, PAL.wall);
  },
  // 6 stage
  (px, rect) => {
    rect(0, 0, 32, 32, PAL.stage);
    for (let x = 0; x < 32; x += 8) rect(x, 0, 1, 32, PAL.stageLine);
  },
  // 7 desk
  (px, rect) => {
    rect(0, 0, 32, 32, PAL.floorA);
    rect(2, 6, 28, 18, PAL.desk);
    rect(2, 6, 28, 2, PAL.deskEdge);
    rect(2, 22, 28, 2, PAL.deskEdge);
  },
  // 8 chair
  (px, rect) => {
    rect(0, 0, 32, 32, PAL.floorA);
    rect(7, 7, 18, 18, PAL.chair);
    rect(7, 7, 18, 4, PAL.chairDark);
    rect(9, 13, 14, 8, PAL.chair);
  },
  // 9 board (whiteboard)
  (px, rect) => {
    rect(0, 0, 32, 32, PAL.wall);
    rect(3, 5, 26, 18, PAL.board);
    rect(3, 5, 26, 2, PAL.boardFrame);
    rect(3, 21, 26, 2, PAL.boardFrame);
    rect(8, 12, 10, 2, PAL.boardFrame);
  },
  // 10 shelf (bookshelf)
  (px, rect) => {
    rect(0, 0, 32, 32, PAL.shelf);
    rect(2, 8, 28, 2, PAL.shelfLine);
    rect(2, 18, 28, 2, PAL.shelfLine);
    px(5, 5, PAL.bookA);
    px(9, 5, PAL.bookB);
    px(13, 5, PAL.bookC);
    px(7, 15, PAL.bookC);
    px(11, 15, PAL.bookA);
    px(15, 15, PAL.bookB);
    px(6, 25, PAL.bookB);
    px(10, 25, PAL.bookC);
  },
  // 11 plant
  (px, rect) => {
    rect(0, 0, 32, 32, PAL.floorA);
    rect(11, 20, 10, 8, PAL.pot);
    rect(8, 8, 16, 12, PAL.plant);
    rect(12, 4, 8, 6, PAL.plant);
    px(12, 12, PAL.plantDark);
    px(18, 10, PAL.plantDark);
    px(15, 16, PAL.plantDark);
  },
  // 12 doormat
  (px, rect) => {
    rect(0, 0, 32, 32, PAL.floorB);
    rect(4, 8, 24, 16, PAL.mat);
    rect(4, 8, 24, 2, PAL.matEdge);
    rect(4, 22, 24, 2, PAL.matEdge);
  },
  // 13 labtable
  (px, rect) => {
    rect(0, 0, 32, 32, PAL.floorA);
    rect(2, 6, 28, 18, PAL.lab);
    rect(2, 6, 28, 2, PAL.labEdge);
    px(10, 14, PAL.labEdge);
    px(11, 14, PAL.labEdge);
    px(20, 16, PAL.bookA);
  },
  // 14 sofa
  (px, rect) => {
    rect(0, 0, 32, 32, PAL.floorA);
    rect(4, 8, 24, 16, PAL.sofa);
    rect(4, 8, 24, 5, PAL.sofaDark);
    rect(4, 8, 4, 16, PAL.sofaDark);
    rect(24, 8, 4, 16, PAL.sofaDark);
  },
  // 15 floorHall
  (px, rect) => {
    rect(0, 0, 32, 32, PAL.hall);
    px(8, 8, PAL.floorB);
    px(24, 24, PAL.floorB);
  },
  // 16 abacus — a pupil desk with their own abacus on top (المعداد)
  (px, rect) => {
    rect(0, 0, 32, 32, PAL.floorA);
    rect(2, 6, 28, 18, PAL.desk);
    rect(2, 6, 28, 2, PAL.deskEdge);
    rect(2, 22, 28, 2, PAL.deskEdge);
    rect(7, 9, 18, 13, PAL.shelfLine); // frame
    rect(8, 10, 16, 11, PAL.hall); // inner
    for (const rodX of [11, 16, 21]) rect(rodX, 10, 1, 11, PAL.shelfLine); // rods
    rect(10, 12, 3, 3, PAL.beadRed); // beads per rod
    rect(15, 15, 3, 3, PAL.beadGreen);
    rect(15, 18, 3, 3, PAL.beadYellow);
    rect(20, 11, 3, 3, PAL.beadBlue);
    rect(20, 14, 3, 3, PAL.beadRed);
  },
  // 17 boardMath — whiteboard with a real sum on it
  (px, rect) => {
    rect(0, 0, 32, 32, PAL.wall);
    rect(2, 5, 28, 19, PAL.board);
    rect(2, 5, 28, 2, PAL.boardFrame);
    rect(2, 22, 28, 2, PAL.boardFrame);
    drawText(px, 5, 10, "2+3=5", PAL.ink);
    rect(10, 24, 12, 2, PAL.shelfLine); // marker tray
    px(12, 24, PAL.beadRed);
    px(16, 24, PAL.beadBlue);
  },
  // 18 numberLine — floor strip 0..8 (evens), ticks on the line
  (px, rect) => {
    rect(0, 0, 32, 32, PAL.floorB);
    rect(0, 22, 32, 2, PAL.boardFrame);
    for (let x = 1; x < 32; x += 6) rect(x, 20, 1, 6, PAL.boardFrame);
    drawText(px, 1, 11, "02468", PAL.ink);
  },
  // 19 posterShapes — wall poster: circle, triangle, square
  (px, rect) => {
    rect(0, 0, 32, 32, PAL.wall);
    rect(4, 4, 24, 24, PAL.board);
    rect(4, 4, 24, 2, PAL.boardFrame);
    disc(px, 10, 12, 3, PAL.beadRed); // circle
    for (let r = 0; r < 6; r++)
      rect(18 - r, 8 + r, 1 + r * 2, 1, PAL.beadGreen); // triangle
    rect(18, 18, 7, 7, PAL.beadBlue); // square
    rect(7, 18, 7, 7, PAL.beadYellow);
  },
  // 20 posterNumbers — wall poster: big 1 2 3
  (px, rect) => {
    rect(0, 0, 32, 32, PAL.wall);
    rect(4, 4, 24, 24, PAL.board);
    rect(4, 4, 24, 2, PAL.boardFrame);
    drawText(px, 5, 11, "1", PAL.beadRed, 2);
    drawText(px, 13, 11, "2", PAL.beadBlue, 2);
    drawText(px, 21, 11, "3", PAL.beadGreen, 2);
  },
  // 21 rugMath — the abacus corner rug
  (px, rect) => {
    rect(0, 0, 32, 32, PAL.carpet);
    rect(0, 0, 32, 2, PAL.carpetEdge);
    rect(0, 30, 32, 2, PAL.carpetEdge);
    rect(0, 0, 2, 32, PAL.carpetEdge);
    rect(30, 0, 2, 32, PAL.carpetEdge);
    drawText(px, 6, 6, "+", PAL.pot);
    drawText(px, 22, 6, "=", PAL.pot);
    drawText(px, 6, 21, "×", PAL.pot);
    drawText(px, 22, 21, "-", PAL.pot);
  },
  // 22 teacherDesk — desk with an apple and a book pile
  (px, rect) => {
    rect(0, 0, 32, 32, PAL.floorA);
    rect(1, 8, 30, 16, PAL.desk);
    rect(1, 8, 30, 2, PAL.deskEdge);
    rect(1, 22, 30, 2, PAL.deskEdge);
    disc(px, 7, 14, 3, PAL.apple); // apple
    px(7, 10, PAL.plantDark);
    px(8, 10, PAL.plant);
    rect(18, 12, 9, 3, PAL.bookB); // books
    rect(19, 15, 8, 3, PAL.bookC);
    rect(18, 18, 9, 3, PAL.bookA);
  },
  // 23 clock — wall clock
  (px, rect) => {
    rect(0, 0, 32, 32, PAL.wall);
    disc(px, 16, 16, 11, PAL.wallDark);
    disc(px, 16, 16, 9, PAL.clockFace ?? PAL.board);
    rect(15, 9, 2, 8, PAL.ink); // hand to 12
    rect(16, 15, 6, 2, PAL.ink); // hand to 3
    rect(15, 15, 2, 2, PAL.beadRed);
  },
];

function buildTilesetPng() {
  const COLS = 8;
  const ROWS = 3;
  const w = COLS * TILE;
  const h = ROWS * TILE;
  const raw = Buffer.alloc(w * h * 4);
  TILES.forEach((draw, id) => {
    const tx = (id % COLS) * TILE;
    const ty = Math.floor(id / COLS) * TILE;
    const tile = makeTile(draw);
    for (let y = 0; y < TILE; y++) {
      tile.copy(raw, ((ty + y) * w + tx) * 4, y * TILE * 4, (y + 1) * TILE * 4);
    }
  });
  return { raw, w, h };
}

/* ------------------------------------------------------------------ *
 * Tiled helpers
 * ------------------------------------------------------------------ */
const NG = (id) => id + 1; // ng-tileset firstgid = 1

/* External curated tilesets (LimeZu "Modern Interiors", bundled under the
 * WorkAdventure specific resources license — see LICENSE.assets). Each map
 * references only the sheets it actually uses; firstgids are computed per map
 * in the fixed order ng → classroom → generic → musicsport → Special_Zones. */
const EXTERNAL_SHEETS = {
  // Curated (trimmed) LimeZu sheets: only the tiles NG Academy actually uses,
  // extracted at authoring time from the bundled sources (LICENSE.assets).
  classroom: {
    image: "assets/ng-school-classroom.png",
    columns: 16,
    tilecount: 13,
    imagewidth: 512,
    imageheight: 32,
  },
  generic: {
    image: "assets/ng-school-generic.png",
    columns: 16,
    tilecount: 25,
    imagewidth: 512,
    imageheight: 64,
  },
  musicsport: {
    image: "assets/ng-school-musicsport.png",
    columns: 16,
    tilecount: 15,
    imagewidth: 512,
    imageheight: 32,
  },
};
const TILESET_COPYRIGHT =
  "LimeZu — Modern Interiors series (limezu.itch.io), trimmed subset via WorkAdventure wam-preset-school; WorkAdventure specific resources license (maps/ng-academy/LICENSE.assets)";

const OFF = { ng: 1, classroom: 0, generic: 0, musicsport: 0, sz: 25 };
let USED_SHEETS = [];

function beginSheets(sheets) {
  USED_SHEETS = sheets;
  let next = 25; // after the 24 ng tiles
  for (const key of ["classroom", "generic", "musicsport"]) {
    if (sheets.includes(key)) {
      OFF[key] = next;
      next += EXTERNAL_SHEETS[key].tilecount;
    } else {
      OFF[key] = 0;
    }
  }
  OFF.sz = next;
  SZ_BLOCK = SZ(0);
  SZ_START = SZ(1);
  SZ_SILENT = SZ(2);
  SZ_EXIT = SZ(8);
}

const SZ = (id) => id + OFF.sz;
let SZ_BLOCK = SZ(0);
let SZ_START = SZ(1);
let SZ_SILENT = SZ(2);
let SZ_EXIT = SZ(8);

/* Curated tile indices: source row,col on the original 16-wide LimeZu sheet
 * → index inside the trimmed NG sheet (verified by contact sheet). */
const CURATED = {
  generic: {
    "5,10": 0,
    "11,9": 1,
    "11,10": 2,
    "12,10": 3,
    "14,0": 4,
    "14,1": 5,
    "14,3": 6,
    "43,7": 7,
    "43,9": 8,
    "45,6": 9,
    "45,7": 10,
    "45,8": 11,
    "46,6": 12,
    "46,7": 13,
    "46,8": 14,
    "54,4": 15,
    "54,5": 16,
    "54,6": 17,
    "55,4": 18,
    "55,5": 19,
    "55,6": 20,
    "56,6": 21,
    "57,6": 22,
    "25,14": 23,
    "26,14": 24,
  },
  classroom: {
    "1,13": 0,
    "2,13": 1,
    "11,2": 2,
    "11,3": 3,
    "11,4": 4,
    "13,0": 5,
    "14,0": 6,
    "15,0": 7,
    "7,4": 8,
    "8,4": 9,
    "9,4": 10,
    "13,13": 11,
    "13,14": 12,
  },
  musicsport: {
    "19,0": 0,
    "19,1": 1,
    "19,2": 2,
    "22,6": 3,
    "23,6": 4,
    "26,0": 5,
    "26,1": 6,
    "26,2": 7,
    "27,0": 8,
    "27,1": 9,
    "27,2": 10,
    "0,6": 11,
    "1,6": 12,
    "25,3": 13,
    "26,3": 14,
  },
};
function pick(sheet, r, c) {
  const idx = CURATED[sheet][`${r},${c}`];
  if (idx === undefined)
    throw new Error(`tile ${sheet} ${r},${c} is not in the curated sheet`);
  return OFF[sheet] + idx;
}
const CL = (r, c) => pick("classroom", r, c);
const GE = (r, c) => pick("generic", r, c);
const MS = (r, c) => pick("musicsport", r, c);

/* Decor helpers ------------------------------------------------------------ */
function vtile(g, map, x, y, gids) {
  gids.forEach((gid, i) => map.set(g, x, y + i, gid));
}
function htile(g, map, x, y, gids) {
  gids.forEach((gid, i) => map.set(g, x + i, y, gid));
}
function block(map, layers, x, y, w, h) {
  map.rect(layers.collisions, x, y, w, h, SZ_BLOCK);
}
function plant(map, layers, furniture, x, y) {
  vtile(furniture, map, x, y, [GE(56, 6), GE(57, 6)]);
  block(map, layers, x, y, 1, 2);
}
function palm(map, layers, furniture, x, y) {
  vtile(furniture, map, x, y, [GE(25, 14), GE(26, 14)]);
  block(map, layers, x, y, 1, 2);
}
function wallDeco(map, layers, x, gid) {
  // paintings / windows / medals hang on the (already solid) perimeter wall
  map.set(layers.walls, x, 0, gid);
}
function rug(map, floor, x, y, gid = 0) {
  map.set(floor, x, y, gid === 0 ? GE(5, 10) : gid);
}

function buildTilesets() {
  const list = [
    {
      columns: 8,
      firstgid: 1,
      image: "assets/ng-tileset.png",
      imageheight: 96,
      imagewidth: 256,
      margin: 0,
      name: "ng-tileset",
      spacing: 0,
      tilecount: 24,
      tileheight: 32,
      tilewidth: 32,
      type: "tileset",
    },
  ];
  for (const key of ["classroom", "generic", "musicsport"]) {
    if (!USED_SHEETS.includes(key)) continue;
    const sh = EXTERNAL_SHEETS[key];
    list.push({
      columns: sh.columns,
      firstgid: OFF[key],
      image: sh.image,
      imageheight: sh.imageheight,
      imagewidth: sh.imagewidth,
      margin: 0,
      name: `limezu-${key}`,
      spacing: 0,
      tilecount: sh.tilecount,
      tileheight: 32,
      tilewidth: 32,
      properties: [
        { name: "tilesetCopyright", type: "string", value: TILESET_COPYRIGHT },
      ],
      type: "tileset",
    });
  }
  list.push({
    columns: 6,
    firstgid: OFF.sz,
    image: "../assets/Special_Zones.png",
    imageheight: 64,
    imagewidth: 192,
    margin: 0,
    name: "Special_Zones",
    spacing: 0,
    tilecount: 12,
    tileheight: 32,
    tilewidth: 32,
    tiles: [
      { id: 0, properties: [{ name: "collides", type: "bool", value: true }] },
    ],
    type: "tileset",
  });
  return list;
}

class TiledMap {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.layers = [];
    this.nextLayerId = 1;
  }

  grid(fill = 0) {
    return new Array(this.w * this.h).fill(fill);
  }

  set(g, x, y, gid) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    g[y * this.w + x] = gid;
  }

  rect(g, x0, y0, rw, rh, gid) {
    for (let y = y0; y < y0 + rh; y++)
      for (let x = x0; x < x0 + rw; x++) this.set(g, x, y, gid);
  }

  addLayer(name, data, properties = []) {
    this.layers.push({
      data,
      height: this.h,
      id: this.nextLayerId++,
      name,
      opacity: 1,
      properties,
      type: "tilelayer",
      visible: true,
      width: this.w,
      x: 0,
      y: 0,
    });
  }

  toJSON() {
    // Marker layers (start / collisions / silent / exits / spawns) go UNDER the
    // floor so their coloured Special_Zones tiles stay invisible in game, exactly
    // like the reference starter map. Logic reads layer data, not draw order.
    const isMarker = (l) =>
      /^(start|collisions|silent|exit_|from_)/.test(l.name);
    const layers = [
      ...this.layers.filter(isMarker),
      ...this.layers.filter((l) => !isMarker(l)),
    ];
    return {
      compressionlevel: -1,
      height: this.h,
      infinite: false,
      layers,
      nextlayerid: this.nextLayerId,
      nextobjectid: 1,
      orientation: "orthogonal",
      properties: [
        {
          name: "mapCopyright",
          type: "string",
          value: "NG Academy — أكاديمية الجيل الجديد",
        },
        { name: "mapThumbnail", type: "string", value: "" },
      ],
      renderorder: "right-down",
      tiledversion: "1.11.2",
      tileheight: 32,
      tilesets: buildTilesets(),
      tilewidth: 32,
      type: "map",
      version: "1.10",
      width: this.w,
    };
  }
}

const prop = (name, value, type = "string") => ({ name, type, value });

/* ------------------------------------------------------------------ *
 * WAM helpers (v2.1.0)
 * ------------------------------------------------------------------ */
function wam(tmjName, name, description, areas) {
  return {
    version: "2.1.0",
    mapUrl: `./${tmjName}`,
    entities: {},
    areas,
    entityCollections: [],
    metadata: { name, description },
  };
}

function area(scope, name, label, x, y, w, h, extra = []) {
  return {
    id: uuid("area", `${scope}:${name}`),
    x: x * TILE,
    y: y * TILE,
    width: w * TILE,
    height: h * TILE,
    name,
    visible: true,
    properties: [
      {
        id: uuid("areaprop", `${scope}:${name}:tooltip`),
        type: "tooltipPropertyData",
        content: label,
        duration: 5000,
      },
      ...extra,
    ],
  };
}

function livekitProp(scope, name, roomName) {
  return {
    id: uuid("areaprop", `${scope}:${name}:livekit`),
    type: "livekitRoomProperty",
    roomName,
    buttonLabel: "دخول الحصة",
    triggerMessage: "اضغط للانضمام إلى حصة الصوت",
    livekitRoomConfig: {
      startWithAudioMuted: false,
      startWithVideoMuted: true,
      disableChat: true,
    },
    livekitRoomAdminTag: "",
  };
}

/* ------------------------------------------------------------------ *
 * Shared layout helpers
 * ------------------------------------------------------------------ */
/** Outer wall ring + collision ring on a fresh map. */
function wallsAndCollisions(map) {
  const walls = map.grid();
  const collisions = map.grid();
  for (let x = 0; x < map.w; x++) {
    map.set(walls, x, 0, NG(5));
    map.set(walls, x, map.h - 1, NG(4));
    map.set(collisions, x, 0, SZ_BLOCK);
    map.set(collisions, x, map.h - 1, SZ_BLOCK);
  }
  for (let y = 0; y < map.h; y++) {
    map.set(walls, 0, y, NG(4));
    map.set(walls, map.w - 1, y, NG(4));
    map.set(collisions, 0, y, SZ_BLOCK);
    map.set(collisions, map.w - 1, y, SZ_BLOCK);
  }
  return { walls, collisions };
}

/** Door gap in the wall + exit layer + spawn-back layer. Returns nothing; mutates. */
function addExit(map, layers, x, y, exitUrl, spawnName, spawnX, spawnY) {
  // gap in the visual wall: floor-ish doormat + no collision so children walk out
  map.set(layers.walls, x, y, NG(12));
  map.set(layers.collisions, x, y, 0);
  const exit = map.grid();
  map.set(exit, x, y, SZ_EXIT);
  map.addLayer(`exit_${exitUrl.replace(/[./#-]/g, "_")}`, exit, [
    prop("exitUrl", exitUrl),
  ]);
  const spawn = map.grid();
  map.set(spawn, spawnX, spawnY, SZ_START);
  map.addLayer(spawnName, spawn, [prop("startLayer", true, "bool")]);
}

function writeJson(file, obj) {
  // Phase 9 (weak devices): maps are runtime assets fetched by the browser —
  // write them minified (the pretty-printed entrance map was 294KB vs ~57KB).
  writeFileSync(join(HERE, file), JSON.stringify(obj) + "\n", "utf-8");
}

/* ------------------------------------------------------------------ *
 * 1) Entrance hub (المدخل + الاستقبال + الساحة)
 * ------------------------------------------------------------------ */
function buildEntrance() {
  beginSheets(["generic"]);
  const W = 34;
  const H = 26;
  const map = new TiledMap(W, H);
  const floor = map.grid();
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++)
      map.set(floor, x, y, (x + y) % 2 === 0 ? NG(0) : NG(1));
  // yard on the right: grass floor, separated by an inner wall with a door gap
  for (let y = 1; y < H - 1; y++)
    for (let x = 24; x < W - 1; x++) map.set(floor, x, y, NG(2));
  const layers = wallsAndCollisions(map);
  // inner wall between hall and yard, door at y=13
  for (let y = 1; y < H - 1; y++) {
    if (y === 13) continue;
    map.set(layers.walls, 24, y, NG(4));
    map.set(layers.collisions, 24, y, SZ_BLOCK);
  }
  map.set(layers.walls, 24, 13, NG(12));

  // reception desk (bottom center): 5 desks + 2 plants
  const furniture = map.grid();
  for (let x = 10; x <= 14; x++) map.set(furniture, x, 21, NG(7));
  map.set(furniture, 8, 21, NG(11));
  map.set(furniture, 16, 21, NG(11));
  map.rect(layers.collisions, 10, 21, 5, 1, SZ_BLOCK);
  // carpet from the door to the reception
  map.rect(floor, 11, 22, 3, 2, NG(3));
  // yard decorations: plants + sofas
  map.set(furniture, 26, 3, NG(11));
  map.set(furniture, 31, 3, NG(11));
  map.set(furniture, 27, 20, NG(14));
  map.set(furniture, 30, 20, NG(14));

  // ── NG look upgrade (LimeZu, see LICENSE.assets): reception display counter,
  // palms in the yard, wall art + windows, welcome mats
  htile(furniture, map, 16, 20, [GE(54, 4), GE(54, 5), GE(54, 6)]);
  htile(furniture, map, 16, 21, [GE(55, 4), GE(55, 5), GE(55, 6)]);
  block(map, layers, 16, 20, 3, 2);
  plant(map, layers, furniture, 8, 19);
  palm(map, layers, furniture, 27, 5);
  palm(map, layers, furniture, 30, 16);
  for (const x of [8, 9, 18, 19]) wallDeco(map, layers, x, GE(43, 7));
  wallDeco(map, layers, 5, GE(14, 0));
  wallDeco(map, layers, 15, GE(14, 1));
  wallDeco(map, layers, 21, GE(14, 3));
  rug(map, floor, 15, 12, GE(11, 9));
  rug(map, floor, 16, 12);
  rug(map, floor, 17, 12, GE(12, 10));
  map.addLayer("floor", floor);
  map.addLayer("walls", layers.walls);
  map.addLayer("furniture", furniture);

  // main spawn: school gate (bottom center)
  const start = map.grid();
  map.set(start, 12, 24, SZ_START);
  map.addLayer("start", start);

  // exits: top wall = 4 classrooms, left wall = 3 classrooms + achievements,
  // bottom wall = library / science-lab / theater / creativity-hall
  const exits = [
    ["classroom-arabic", 6, 0, 6, 2],
    ["classroom-english", 12, 0, 12, 2],
    ["classroom-math", 17, 0, 17, 2],
    ["classroom-science", 22, 0, 22, 2],
    ["classroom-chess", 0, 6, 2, 6],
    ["classroom-reading", 0, 12, 2, 12],
    ["classroom-communication", 0, 18, 2, 18],
    ["achievements-hall", 0, 23, 2, 23],
    ["library", 6, H - 1, 6, H - 3],
    ["science-lab", 12, H - 1, 12, H - 3],
    ["theater", 18, H - 1, 18, H - 3],
    ["creativity-hall", 22, H - 1, 22, H - 3],
  ];
  for (const [target, x, y, sx, sy] of exits) {
    addExit(
      map,
      layers,
      x,
      y,
      `./${target}.wam#from_entrance`,
      `from_${target}`,
      sx,
      sy,
    );
  }
  map.addLayer("collisions", layers.collisions);

  const areas = [
    area("entrance", "reception", "الاستقبال — أهلًا بك! 👋", 9, 19, 8, 5),
    area(
      "entrance",
      "yard",
      "الساحة — العب واسترح مع أصدقائك 🌳",
      25,
      2,
      7,
      22,
    ),
    area("entrance", "gate", "بوابة المدرسة", 10, 22, 5, 3),
    area("entrance", "gathering", "نقطة تجمع صف جينو 🦉", 10, 21, 5, 4),
  ];
  writeJson("entrance.tmj", map.toJSON());
  writeJson(
    "entrance.wam",
    wam(
      "entrance.tmj",
      "المدخل والاستقبال",
      "بوابة أكاديمية الجيل الجديد: الاستقبال والساحة ومنها إلى كل الأماكن.",
      areas,
    ),
  );
}

/* ------------------------------------------------------------------ *
 * 2) Classroom template (الفصول السبعة)
 * ------------------------------------------------------------------ */
const CLASSROOMS = [
  [
    "classroom-arabic",
    "فصل اللغة العربية",
    "lesson-arabic",
    "حصة اللغة العربية",
  ],
  [
    "classroom-english",
    "فصل اللغة الإنجليزية",
    "lesson-english",
    "حصة اللغة الإنجليزية",
  ],
  ["classroom-math", "فصل الرياضيات", "lesson-math", "حصة الرياضيات"],
  ["classroom-science", "فصل العلوم", "lesson-science", "حصة العلوم"],
  ["classroom-chess", "فصل الشطرنج", "lesson-chess", "حصة الشطرنج"],
  [
    "classroom-reading",
    "فصل القراءة والكتابة",
    "lesson-reading",
    "حصة القراءة والكتابة",
  ],
  [
    "classroom-communication",
    "فصل مهارات التواصل",
    "lesson-communication",
    "حصة مهارات التواصل",
  ],
];

function buildClassroom([file, title, roomName, lessonLabel]) {
  beginSheets(["classroom", "generic"]);
  const W = 18;
  const H = 14;
  const map = new TiledMap(W, H);
  const floor = map.grid();
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++)
      map.set(floor, x, y, (x + y) % 2 === 0 ? NG(0) : NG(1));
  const layers = wallsAndCollisions(map);

  const furniture = map.grid();
  // pupils desks: 3 columns x 2 rows (desk + chair)
  const DESKS = [
    [4, 6],
    [8, 6],
    [12, 6],
    [4, 9],
    [8, 9],
    [12, 9],
  ];
  const isMath = file === "classroom-math";

  if (isMath) {
    /* ---- فصل الحساب: صُمّم بعناية (غرف NG، الدفعة الأولى) ----
     * جدار السبورة: سبورة رياضيات عريضة (مسألة حقيقية 2+3=5)، ساعة،
     * وملصقان (أرقام كبيرة وأشكال هندسية). مكتب المعلمة بتفاحة وكتب.
     * كل طالب له معداده الخاص على مقعده (بلاطة 16)، وشريط خط الأعداد
     * 0-8 على الأرض، وركن المعداد بسجادة ومحطتين ورف كتب. */
    for (let x = 3; x <= 11; x++) map.set(furniture, x, 1, NG(17)); // boardMath
    map.set(furniture, 1, 1, NG(20)); // posterNumbers
    map.set(furniture, 13, 1, NG(23)); // clock
    map.set(furniture, 15, 1, NG(19)); // posterShapes
    map.set(furniture, 8, 3, NG(22)); // teacherDesk
    map.set(furniture, 2, 2, NG(11)); // plant left
    map.set(furniture, 15, 3, NG(11)); // plant right
    map.rect(layers.collisions, 8, 3, 1, 1, SZ_BLOCK);

    for (const [dx, dy] of DESKS) {
      map.set(furniture, dx, dy, NG(16)); // معداد الطالب على مقعده
      map.set(furniture, dx + 1, dy, NG(7));
      map.set(furniture, dx, dy + 1, NG(8));
      map.set(furniture, dx + 1, dy + 1, NG(8));
      map.rect(layers.collisions, dx, dy, 2, 1, SZ_BLOCK);
    }

    for (let x = 2; x <= 15; x++) map.set(furniture, x, 11, NG(18)); // numberLine

    // ركن المعداد (14..16, 6..9): سجادة + محطتا معداد + رف
    for (let y = 6; y <= 9; y++)
      for (let x = 14; x <= 16; x++) map.set(floor, x, y, NG(21));
    map.set(furniture, 14, 7, NG(16));
    map.set(furniture, 16, 8, NG(16));
    map.set(furniture, 16, 5, NG(10)); // shelf over the corner
    map.rect(layers.collisions, 14, 7, 1, 1, SZ_BLOCK);
    map.rect(layers.collisions, 16, 8, 1, 1, SZ_BLOCK);
    map.rect(layers.collisions, 16, 5, 1, 1, SZ_BLOCK);
  } else {
    // whiteboard + teacher desk on top
    for (let x = 6; x <= 11; x++) map.set(furniture, x, 1, NG(9));
    map.set(furniture, 8, 3, NG(7));
    map.set(furniture, 2, 2, NG(11));
    map.set(furniture, 15, 2, NG(11));
    for (const [dx, dy] of DESKS) {
      map.set(furniture, dx, dy, NG(7));
      map.set(furniture, dx + 1, dy, NG(7));
      map.set(furniture, dx, dy + 1, NG(8));
      map.set(furniture, dx + 1, dy + 1, NG(8));
      map.rect(layers.collisions, dx, dy, 2, 1, SZ_BLOCK);
    }
  }

  // ── NG look upgrade: bright windows + wall art, plants, a soft mat, and a
  // subject corner (globe / bookshelf / computer bench) per classroom
  {
    const subject = file.replace("classroom-", "");
    for (const x of [3, 14]) wallDeco(map, layers, x, GE(43, 7));
    wallDeco(map, layers, 8, GE(14, subject === "chess" ? 3 : 0));
    if (isMath) {
      // keep the number-line strip (y=11) fully visible
      plant(map, layers, furniture, 2, 4);
      plant(map, layers, furniture, 15, 4);
    } else {
      plant(map, layers, furniture, 2, 11);
      plant(map, layers, furniture, 15, 11);
    }
    rug(map, floor, 8, 6, GE(11, 10));
    if (subject === "science") {
      vtile(furniture, map, 14, 2, [CL(1, 13), CL(2, 13)]);
      block(map, layers, 14, 2, 1, 2);
    }
    if (subject === "reading" || subject === "arabic") {
      vtile(furniture, map, 1, 2, [CL(13, 0), CL(14, 0), CL(15, 0)]);
      block(map, layers, 1, 2, 1, 3);
    }
    if (subject === "english" || subject === "communication") {
      htile(furniture, map, 12, 2, [CL(11, 2), CL(11, 3), CL(11, 4)]);
      block(map, layers, 12, 2, 3, 1);
    }
  }
  map.addLayer("floor", floor);
  map.addLayer("walls", layers.walls);
  map.addLayer("furniture", furniture);

  const start = map.grid();
  map.set(start, 9, 12, SZ_START);
  map.addLayer("start", start);
  addExit(
    map,
    layers,
    9,
    H - 1,
    "./entrance.wam#from_" + file,
    "from_entrance",
    9,
    12,
  );
  map.addLayer("collisions", layers.collisions);

  const areas = [
    // lesson (livekit) keeps clear of the math abacus corner (no mic while playing)
    area(file, "lesson", lessonLabel, 3, 5, isMath ? 11 : 12, 6, [
      livekitProp(file, "lesson", roomName),
    ]),
    area(
      file,
      `teacher-${file.replace("classroom-", "")}`,
      "منطقة المعلم",
      5,
      1,
      8,
      3,
    ),
  ];
  if (isMath) {
    areas.push(
      area(
        file,
        "abacus",
        "ركن المعداد 🧮 — حرّك الخرزات وابنِ الأرقام!",
        14,
        6,
        3,
        4,
      ),
    );
  }
  writeJson(`${file}.tmj`, map.toJSON());
  writeJson(
    `${file}.wam`,
    wam(
      `${file}.tmj`,
      title,
      `${title} — حصة صوتية بإشراف المعلم، بلا دردشة نصية.`,
      areas,
    ),
  );
}

/* ------------------------------------------------------------------ *
 * 3) Library (المكتبة — منطقة صامتة)
 * ------------------------------------------------------------------ */
function buildLibrary() {
  beginSheets(["classroom", "generic"]);
  const W = 18;
  const H = 14;
  const map = new TiledMap(W, H);
  const floor = map.grid();
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) map.set(floor, x, y, NG(15));
  const layers = wallsAndCollisions(map);

  const furniture = map.grid();
  for (let x = 2; x <= 6; x++) {
    map.set(furniture, x, 2, NG(10));
    map.set(furniture, x, 6, NG(10));
  }
  for (let x = 11; x <= 15; x++) {
    map.set(furniture, x, 2, NG(10));
    map.set(furniture, x, 6, NG(10));
  }
  map.rect(layers.collisions, 2, 2, 5, 1, SZ_BLOCK);
  map.rect(layers.collisions, 2, 6, 5, 1, SZ_BLOCK);
  map.rect(layers.collisions, 11, 2, 5, 1, SZ_BLOCK);
  map.rect(layers.collisions, 11, 6, 5, 1, SZ_BLOCK);
  // reading carpet + sofas
  map.rect(floor, 7, 9, 4, 3, NG(3));
  map.set(furniture, 7, 8, NG(14));
  map.set(furniture, 10, 8, NG(14));
  map.set(furniture, 2, 11, NG(11));
  map.set(furniture, 15, 11, NG(11));

  // ── NG look upgrade: tall bookshelves, a reading podium, plants, rug
  for (const x of [4, 9, 14]) wallDeco(map, layers, x, GE(43, 9));
  vtile(furniture, map, 1, 2, [CL(7, 4), CL(8, 4), CL(9, 4)]);
  block(map, layers, 1, 2, 1, 3);
  vtile(furniture, map, 1, 6, [CL(7, 4), CL(8, 4), CL(9, 4)]);
  block(map, layers, 1, 6, 1, 3);
  vtile(furniture, map, 16, 2, [CL(13, 0), CL(14, 0), CL(15, 0)]);
  block(map, layers, 16, 2, 1, 3);
  htile(furniture, map, 8, 2, [CL(13, 13), CL(13, 14)]);
  block(map, layers, 8, 2, 2, 1);
  plant(map, layers, furniture, 16, 10);
  rug(map, floor, 8, 7);
  rug(map, floor, 9, 7, GE(11, 9));
  map.addLayer("floor", floor);
  map.addLayer("walls", layers.walls);
  map.addLayer("furniture", furniture);

  const silent = map.grid();
  map.rect(silent, 1, 1, W - 2, H - 2, SZ_SILENT);
  map.addLayer("silentZone", silent, [prop("silent", true, "bool")]);

  const start = map.grid();
  map.set(start, 9, 12, SZ_START);
  map.addLayer("start", start);
  addExit(
    map,
    layers,
    9,
    H - 1,
    "./entrance.wam#from_library",
    "from_entrance",
    9,
    12,
  );
  map.addLayer("collisions", layers.collisions);

  const areas = [
    area("library", "reading", "ركن القراءة الهادئ 📚", 6, 8, 6, 4),
  ];
  writeJson("library.tmj", map.toJSON());
  writeJson(
    "library.wam",
    wam(
      "library.tmj",
      "المكتبة",
      "مكان هادئ للقراءة: الأثاث كتب وأرائك، والمنطقة صامتة.",
      areas,
    ),
  );
}

/* ------------------------------------------------------------------ *
 * 4) Science lab (مختبر العلوم)
 * ------------------------------------------------------------------ */
function buildScienceLab() {
  beginSheets(["classroom", "generic"]);
  const W = 18;
  const H = 14;
  const map = new TiledMap(W, H);
  const floor = map.grid();
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++)
      map.set(floor, x, y, (x + y) % 2 === 0 ? NG(1) : NG(0));
  const layers = wallsAndCollisions(map);

  const furniture = map.grid();
  for (const [dx, dy] of [
    [3, 4],
    [8, 4],
    [13, 4],
    [3, 8],
    [8, 8],
    [13, 8],
  ]) {
    map.set(furniture, dx, dy, NG(13));
    map.set(furniture, dx + 1, dy, NG(13));
    map.rect(layers.collisions, dx, dy, 2, 1, SZ_BLOCK);
  }
  map.set(furniture, 2, 2, NG(11));
  map.set(furniture, 15, 2, NG(11));
  for (let x = 7; x <= 10; x++) map.set(furniture, x, 1, NG(9));

  // ── NG look upgrade: globes on both sides, plants, windows, mat
  vtile(furniture, map, 2, 2, [CL(1, 13), CL(2, 13)]);
  block(map, layers, 2, 2, 1, 2);
  vtile(furniture, map, 15, 2, [CL(1, 13), CL(2, 13)]);
  block(map, layers, 15, 2, 1, 2);
  plant(map, layers, furniture, 2, 10);
  plant(map, layers, furniture, 15, 10);
  for (const x of [6, 12]) wallDeco(map, layers, x, GE(43, 7));
  wallDeco(map, layers, 9, GE(14, 1));
  rug(map, floor, 8, 8, GE(11, 10));
  map.addLayer("floor", floor);
  map.addLayer("walls", layers.walls);
  map.addLayer("furniture", furniture);

  const start = map.grid();
  map.set(start, 9, 12, SZ_START);
  map.addLayer("start", start);
  addExit(
    map,
    layers,
    9,
    H - 1,
    "./entrance.wam#from_science-lab",
    "from_entrance",
    9,
    12,
  );
  map.addLayer("collisions", layers.collisions);

  const areas = [
    area("science-lab", "lab", "طاولات التجارب 🔬", 2, 3, 14, 8, [
      livekitProp("science-lab", "lab", "lab-session"),
    ]),
  ];
  writeJson("science-lab.tmj", map.toJSON());
  writeJson(
    "science-lab.wam",
    wam(
      "science-lab.tmj",
      "مختبر العلوم",
      "مختبر التجارب: طاولات عمل وجلسة صوتية بإشراف المعلم.",
      areas,
    ),
  );
}

/* ------------------------------------------------------------------ *
 * 5) Theater (المسرح)
 * ------------------------------------------------------------------ */
function buildTheater() {
  beginSheets(["generic", "musicsport"]);
  const W = 22;
  const H = 16;
  const map = new TiledMap(W, H);
  const floor = map.grid();
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) map.set(floor, x, y, NG(15));
  const layers = wallsAndCollisions(map);

  const furniture = map.grid();
  // stage platform on top (wood) — drawn on the floor layer under players
  for (let y = 2; y <= 5; y++)
    for (let x = 4; x <= 17; x++) map.set(floor, x, y, NG(6));
  // audience chairs rows
  for (let x = 5; x <= 16; x++) {
    if (x % 3 === 2) continue; // aisles
    map.set(furniture, x, 8, NG(8));
    map.set(furniture, x, 10, NG(8));
    map.set(furniture, x, 12, NG(8));
  }
  map.set(furniture, 2, 2, NG(11));
  map.set(furniture, 19, 2, NG(11));

  // ── NG look upgrade: red stage curtain on the back wall + speakers
  htile(layers.walls, map, 7, 0, [GE(45, 6), GE(45, 7), GE(45, 8)]);
  htile(layers.walls, map, 7, 1, [GE(46, 6), GE(46, 7), GE(46, 8)]);
  vtile(furniture, map, 4, 2, [MS(0, 6), MS(1, 6)]);
  block(map, layers, 4, 2, 1, 2);
  vtile(furniture, map, 17, 2, [MS(0, 6), MS(1, 6)]);
  block(map, layers, 17, 2, 1, 2);
  rug(map, floor, 10, 9);
  rug(map, floor, 11, 9, GE(11, 9));
  map.addLayer("floor", floor);
  map.addLayer("walls", layers.walls);
  map.addLayer("furniture", furniture);

  const start = map.grid();
  map.set(start, 11, 14, SZ_START);
  map.addLayer("start", start);
  addExit(
    map,
    layers,
    11,
    H - 1,
    "./entrance.wam#from_theater",
    "from_entrance",
    11,
    14,
  );
  map.addLayer("collisions", layers.collisions);

  const areas = [
    area("theater", "stage", "خشبة المسرح 🎭", 4, 2, 14, 4, [
      livekitProp("theater", "stage", "theater-stage"),
    ]),
    area("theater", "audience", "مقاعد الجمهور", 4, 7, 14, 7),
  ];
  writeJson("theater.tmj", map.toJSON());
  writeJson(
    "theater.wam",
    wam(
      "theater.tmj",
      "المسرح",
      "خشبة للعروض المدرسية وجلسة صوتية، ومقاعد للجمهور.",
      areas,
    ),
  );
}

/* ------------------------------------------------------------------ *
 * 6) Creativity hall (قاعة الإبداع)
 * ------------------------------------------------------------------ */
function buildCreativity() {
  beginSheets(["generic"]);
  const W = 18;
  const H = 14;
  const map = new TiledMap(W, H);
  const floor = map.grid();
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++)
      map.set(floor, x, y, (x + y) % 2 === 0 ? NG(0) : NG(1));
  const layers = wallsAndCollisions(map);

  const furniture = map.grid();
  map.rect(floor, 6, 5, 6, 4, NG(3));
  for (const [dx, dy] of [
    [3, 3],
    [13, 3],
    [3, 9],
    [13, 9],
  ]) {
    map.set(furniture, dx, dy, NG(7));
    map.set(furniture, dx + 1, dy, NG(7));
    map.rect(layers.collisions, dx, dy, 2, 1, SZ_BLOCK);
  }
  map.set(furniture, 7, 2, NG(14));
  map.set(furniture, 10, 2, NG(14));
  map.set(furniture, 2, 6, NG(11));
  map.set(furniture, 15, 6, NG(11));

  // ── NG look upgrade: gallery wall of paintings, plants, colourful mats
  wallDeco(map, layers, 4, GE(14, 0));
  wallDeco(map, layers, 7, GE(14, 1));
  wallDeco(map, layers, 10, GE(14, 3));
  wallDeco(map, layers, 13, GE(14, 0));
  plant(map, layers, furniture, 2, 10);
  plant(map, layers, furniture, 15, 10);
  rug(map, floor, 8, 7, GE(11, 9));
  rug(map, floor, 9, 7, GE(12, 10));
  map.addLayer("floor", floor);
  map.addLayer("walls", layers.walls);
  map.addLayer("furniture", furniture);

  const start = map.grid();
  map.set(start, 9, 12, SZ_START);
  map.addLayer("start", start);
  addExit(
    map,
    layers,
    9,
    H - 1,
    "./entrance.wam#from_creativity-hall",
    "from_entrance",
    9,
    12,
  );
  map.addLayer("collisions", layers.collisions);

  const areas = [
    area("creativity-hall", "makerspace", "مساحة الإبداع 🎨", 5, 4, 8, 6, [
      livekitProp("creativity-hall", "makerspace", "creativity-session"),
    ]),
  ];
  writeJson("creativity-hall.tmj", map.toJSON());
  writeJson(
    "creativity-hall.wam",
    wam(
      "creativity-hall.tmj",
      "قاعة الإبداع",
      "طاولات عمل ومجلس مريح لأنشطة الرسم والابتكار.",
      areas,
    ),
  );
}

/* ------------------------------------------------------------------ *
 * 7) Achievements hall (قاعة الإنجازات)
 * ------------------------------------------------------------------ */
function buildAchievements() {
  beginSheets(["generic", "musicsport"]);
  const W = 18;
  const H = 14;
  const map = new TiledMap(W, H);
  const floor = map.grid();
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) map.set(floor, x, y, NG(15));
  const layers = wallsAndCollisions(map);

  const furniture = map.grid();
  // display boards along the walls + central carpet
  for (let x = 3; x <= 6; x++) map.set(furniture, x, 1, NG(9));
  for (let x = 11; x <= 14; x++) map.set(furniture, x, 1, NG(9));
  map.set(furniture, 1, 5, NG(9));
  map.set(furniture, 1, 8, NG(9));
  map.set(furniture, 16, 5, NG(9));
  map.set(furniture, 16, 8, NG(9));
  map.rect(floor, 7, 5, 4, 4, NG(3));
  map.set(furniture, 4, 10, NG(11));
  map.set(furniture, 13, 10, NG(11));

  // ── NG look upgrade: medals on the wall, trophy columns, winners podium,
  // framed certificates in a display case
  wallDeco(map, layers, 6, MS(19, 0));
  wallDeco(map, layers, 7, MS(19, 1));
  wallDeco(map, layers, 8, MS(19, 2));
  vtile(furniture, map, 3, 2, [MS(22, 6), MS(23, 6)]);
  block(map, layers, 3, 2, 1, 2);
  vtile(furniture, map, 14, 2, [MS(22, 6), MS(23, 6)]);
  block(map, layers, 14, 2, 1, 2);
  htile(furniture, map, 7, 6, [MS(26, 0), MS(26, 1), MS(26, 2)]);
  htile(furniture, map, 7, 7, [MS(27, 0), MS(27, 1), MS(27, 2)]);
  block(map, layers, 7, 6, 3, 2);
  map.set(furniture, 11, 2, MS(25, 3));
  map.set(furniture, 12, 2, MS(26, 3));
  block(map, layers, 11, 2, 2, 1);
  plant(map, layers, furniture, 2, 10);
  plant(map, layers, furniture, 15, 10);
  rug(map, floor, 8, 10);
  map.addLayer("floor", floor);
  map.addLayer("walls", layers.walls);
  map.addLayer("furniture", furniture);

  const start = map.grid();
  map.set(start, 9, 12, SZ_START);
  map.addLayer("start", start);
  addExit(
    map,
    layers,
    9,
    H - 1,
    "./entrance.wam#from_achievements-hall",
    "from_entrance",
    9,
    12,
  );
  map.addLayer("collisions", layers.collisions);

  const areas = [
    area("achievements-hall", "trophies", "جدار الإنجازات 🏆", 6, 1, 6, 3),
    area("achievements-hall", "carpet", "ساحة التكريم", 7, 5, 4, 4),
  ];
  writeJson("achievements-hall.tmj", map.toJSON());
  writeJson(
    "achievements-hall.wam",
    wam(
      "achievements-hall.tmj",
      "قاعة الإنجازات",
      "مكان عرض شارات الأطفال وإنجازاتهم — تشجيع بلا منافسة.",
      areas,
    ),
  );
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */
mkdirSync(join(HERE, "assets"), { recursive: true });

// tileset png via sharp if available (bootstrap-tools), else pure PNG encoder fallback
const { raw, w, h } = buildTilesetPng();
const sharpPath = join(HERE, "../../.bootstrap-tools/node_modules/sharp");
let wrote = false;
try {
  const sharp = (await import(sharpPath)).default;
  await sharp(raw, { raw: { width: w, height: h, channels: 4 } })
    .png({ palette: true, colors: 64 })
    .toFile(join(HERE, "assets/ng-tileset.png"));
  wrote = true;
} catch {
  wrote = false;
}
if (!wrote) {
  // Minimal uncompressed PNG encoder (zlib stored blocks) — keeps the generator
  // runnable without the bootstrap toolchain.
  const zlib = await import("node:zlib");
  const crcTable = [...Array(256)].map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // rgba
  const stride = w * 4;
  const filtered = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    filtered[y * (stride + 1)] = 0;
    raw.copy(filtered, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(filtered, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  writeFileSync(join(HERE, "assets/ng-tileset.png"), png);
}

buildEntrance();
for (const c of CLASSROOMS) buildClassroom(c);
buildLibrary();
buildScienceLab();
buildTheater();
buildCreativity();
buildAchievements();

console.log(
  "✅ ng-academy maps generated: 13 wam + 13 tmj + assets/ng-tileset.png",
);
