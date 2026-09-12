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
};

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
];

function buildTilesetPng() {
  const COLS = 8;
  const ROWS = 2;
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
const SZ = (id) => id + 17; // Special_Zones firstgid = 17 (after 16 ng tiles)
const SZ_BLOCK = SZ(0);
const SZ_START = SZ(1);
const SZ_SILENT = SZ(2);
const SZ_EXIT = SZ(8);

const TILESETS = [
  {
    columns: 8,
    firstgid: 1,
    image: "assets/ng-tileset.png",
    imageheight: 64,
    imagewidth: 256,
    margin: 0,
    name: "ng-tileset",
    spacing: 0,
    tilecount: 16,
    tileheight: 32,
    tilewidth: 32,
    type: "tileset",
  },
  {
    columns: 6,
    firstgid: 17,
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
  },
];

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
      tilesets: TILESETS,
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
  writeFileSync(join(HERE, file), JSON.stringify(obj, null, 2) + "\n", "utf-8");
}

/* ------------------------------------------------------------------ *
 * 1) Entrance hub (المدخل + الاستقبال + الساحة)
 * ------------------------------------------------------------------ */
function buildEntrance() {
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
  const W = 18;
  const H = 14;
  const map = new TiledMap(W, H);
  const floor = map.grid();
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++)
      map.set(floor, x, y, (x + y) % 2 === 0 ? NG(0) : NG(1));
  const layers = wallsAndCollisions(map);

  const furniture = map.grid();
  // whiteboard + teacher desk on top
  for (let x = 6; x <= 11; x++) map.set(furniture, x, 1, NG(9));
  map.set(furniture, 8, 3, NG(7));
  map.set(furniture, 2, 2, NG(11));
  map.set(furniture, 15, 2, NG(11));
  // pupils desks: 3 columns x 2 rows (desk + chair)
  for (const [dx, dy] of [
    [4, 6],
    [8, 6],
    [12, 6],
    [4, 9],
    [8, 9],
    [12, 9],
  ]) {
    map.set(furniture, dx, dy, NG(7));
    map.set(furniture, dx + 1, dy, NG(7));
    map.set(furniture, dx, dy + 1, NG(8));
    map.set(furniture, dx + 1, dy + 1, NG(8));
    map.rect(layers.collisions, dx, dy, 2, 1, SZ_BLOCK);
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
    area(file, "lesson", lessonLabel, 3, 5, 12, 6, [
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
