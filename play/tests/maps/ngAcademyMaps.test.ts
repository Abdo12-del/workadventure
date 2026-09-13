import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";
import { describe, expect, it } from "vitest";
import { NG_GINO_EXPLAIN, NG_TEACHERS } from "../../src/front/NgAcademy/NgAcademyConfig";

/**
 * Phase 3 acceptance tests for the NG Academy school world (maps/ng-academy).
 *
 * Checks, for every generated map:
 *  - the WAM file validates against the official WAM 2.1.0 JSON schema;
 *  - the TMJ file is structurally sound (grid sizes, tileset images on disk);
 *  - the exit graph is closed: every exitUrl points to an existing map and every
 *    "#spawn" fragment names a startLayer in the target;
 *  - child-safety invariants: audio-first LiveKit rooms with chat disabled,
 *    unique room names, and no external URL anywhere in the world.
 */
const here = dirname(fileURLToPath(import.meta.url));
const MAPS_DIR = resolve(here, "../../../maps/ng-academy");
const SCHEMA_PATH = resolve(here, "../../../docs/schema/2.1.0/wam.json");

const wamFiles = readdirSync(MAPS_DIR)
    .filter((f) => f.endsWith(".wam"))
    .sort();

interface TiledLayer {
    type: string;
    name: string;
    data?: number[];
    properties?: { name: string; value: unknown; type?: string }[];
}
interface TiledMapJson {
    width: number;
    height: number;
    layers: TiledLayer[];
    tilesets: {
        image: string;
        firstgid: number;
        tilecount: number;
        properties?: { name: string; value: string }[];
    }[];
}

function readJson<T>(path: string): T {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function layerProp(layer: TiledLayer, name: string): unknown {
    return layer.properties?.find((p) => p.name === name)?.value;
}

const wams = new Map<string, Record<string, unknown>>(
    wamFiles.map((f) => [f, readJson<Record<string, unknown>>(join(MAPS_DIR, f))]),
);
const tmjs = new Map<string, TiledMapJson>();
for (const [wamFile, wam] of wams) {
    const mapUrl = String(wam.mapUrl);
    tmjs.set(wamFile, readJson<TiledMapJson>(join(MAPS_DIR, mapUrl.replace(/^\.\//, ""))));
}

describe("NG Academy school world — WAM schema", () => {
    const ajv = new Ajv({ allErrors: true });
    const validate = ajv.compile(readJson(SCHEMA_PATH));

    it.each(wamFiles)("%s validates against WAM schema 2.1.0", (file) => {
        const valid = validate(wams.get(file));
        expect(valid, JSON.stringify(validate.errors)).toBe(true);
    });

    it("ships the full school: entrance + 7 classrooms + 5 halls", () => {
        expect(wamFiles).toEqual([
            "achievements-hall.wam",
            "classroom-arabic.wam",
            "classroom-chess.wam",
            "classroom-communication.wam",
            "classroom-english.wam",
            "classroom-math.wam",
            "classroom-reading.wam",
            "classroom-science.wam",
            "creativity-hall.wam",
            "entrance.wam",
            "library.wam",
            "science-lab.wam",
            "theater.wam",
        ]);
    });
});

describe("NG Academy school world — TMJ structure", () => {
    it.each(wamFiles)("%s tmj grids, tilesets and spawns are sound", (file) => {
        const map = tmjs.get(file);
        if (!map) throw new Error(`missing tmj for ${file}`);
        for (const layer of map.layers) {
            if (layer.type === "tilelayer" && layer.data) {
                expect(layer.data, `layer ${layer.name} size`).toHaveLength(map.width * map.height);
            }
        }
        for (const tileset of map.tilesets) {
            const image = join(MAPS_DIR, dirname(String(wams.get(file)?.mapUrl)), tileset.image);
            expect(existsSync(image), `tileset image ${tileset.image}`).toBe(true);
        }
        const startLayers = map.layers.filter((l) => l.name === "start" || layerProp(l, "startLayer") === true);
        expect(startLayers.length, "spawn layers").toBeGreaterThanOrEqual(1);
        for (const layer of startLayers) {
            expect(
                layer.data?.some((gid) => gid !== 0),
                `spawn layer ${layer.name} has a tile`,
            ).toBe(true);
        }
        expect(
            map.layers.some((l) => l.name === "collisions"),
            "collisions layer",
        ).toBe(true);
        // marker layers must stay under the floor so zone colours never show in game
        const names = map.layers.map((l) => l.name);
        expect(names.indexOf("collisions")).toBeLessThan(names.indexOf("floor"));
    });
});

describe("NG Academy school world — exit graph", () => {
    const EXPECTED_DESTINATIONS = [
        "achievements-hall",
        "classroom-arabic",
        "classroom-chess",
        "classroom-communication",
        "classroom-english",
        "classroom-math",
        "classroom-reading",
        "classroom-science",
        "creativity-hall",
        "library",
        "science-lab",
        "theater",
    ];

    it("the entrance reaches every room of the school", () => {
        const map = tmjs.get("entrance.wam");
        if (!map) throw new Error("missing entrance.tmj");
        const targets = map.layers
            .map((l) => layerProp(l, "exitUrl"))
            .filter((v): v is string => typeof v === "string")
            .map((u) =>
                u
                    .split("#")[0]
                    .replace(/^\.\//, "")
                    .replace(/\.wam$/, ""),
            )
            .sort();
        expect(targets).toEqual(EXPECTED_DESTINATIONS);
    });

    it.each(wamFiles)("every exitUrl of %s resolves to an existing map and spawn", (file) => {
        const map = tmjs.get(file);
        if (!map) throw new Error(`missing tmj for ${file}`);
        const exitLayers = map.layers.filter((l) => typeof layerProp(l, "exitUrl") === "string");
        expect(exitLayers.length, "at least one exit").toBeGreaterThanOrEqual(1);
        for (const layer of exitLayers) {
            const url = String(layerProp(layer, "exitUrl"));
            const [target, fragment] = url.split("#");
            const targetFile = resolve(MAPS_DIR, dirname(join(MAPS_DIR, String(wams.get(file)?.mapUrl))), target);
            expect(existsSync(targetFile), `exit target ${url}`).toBe(true);
            if (fragment) {
                const targetMap = readJson<TiledMapJson>(targetFile.replace(/\.wam$/, ".tmj"));
                const spawn = targetMap.layers.find((l) => l.name === fragment);
                expect(spawn, `spawn layer ${fragment} in ${target}`).toBeDefined();
                expect(layerProp(spawn as TiledLayer, "startLayer")).toBe(true);
            }
        }
    });

    it("every room leads back to the entrance hub", () => {
        for (const file of wamFiles) {
            if (file === "entrance.wam") continue;
            const map = tmjs.get(file);
            if (!map) throw new Error(`missing tmj for ${file}`);
            const back = map.layers
                .map((l) => layerProp(l, "exitUrl"))
                .filter((v): v is string => typeof v === "string" && v.includes("entrance.wam"));
            expect(back.length, `${file} returns to entrance`).toBe(1);
        }
    });
});

describe("NG Academy school world — child-safety invariants", () => {
    it("classroom livekit rooms are audio-first with chat disabled and unique", () => {
        const roomNames = new Set<string>();
        for (const [file, wam] of wams) {
            for (const area of (wam.areas as {
                properties: {
                    type: string;
                    roomName?: string;
                    livekitRoomConfig?: { disableChat?: boolean; startWithVideoMuted?: boolean };
                }[];
            }[]) ?? []) {
                for (const property of area.properties) {
                    if (property.type !== "livekitRoomProperty") continue;
                    expect(property.roomName, `room name in ${file}`).toBeTruthy();
                    expect(roomNames.has(property.roomName as string), `duplicate room ${property.roomName}`).toBe(
                        false,
                    );
                    roomNames.add(property.roomName as string);
                    expect(property.livekitRoomConfig?.disableChat, `chat disabled in ${file}`).toBe(true);
                    expect(property.livekitRoomConfig?.startWithVideoMuted, `video off by default in ${file}`).toBe(
                        true,
                    );
                }
            }
        }
        expect(roomNames.size).toBe(10); // 7 lessons + lab + theater stage + creativity
    });

    it("no external URL anywhere in the school world (child-safe allowlist)", () => {
        for (const [file, wam] of wams) {
            const raw = JSON.stringify(wam) + JSON.stringify(tmjs.get(file));
            expect(raw, `external url in ${file}`).not.toMatch(/https?:\/\//);
        }
    });

    it("the library is a silent zone", () => {
        const map = tmjs.get("library.wam");
        if (!map) throw new Error("missing library.tmj");
        const silent = map.layers.find((l) => layerProp(l, "silent") === true);
        expect(silent).toBeDefined();
        expect(silent?.data?.some((gid) => gid !== 0)).toBe(true);
    });
});

describe("NG Academy school world — teachers & Gino config coherence", () => {
    const allAreaNames = new Set<string>();
    for (const [, wam] of wams) {
        for (const area of (wam.areas as { name: string }[]) ?? []) {
            allAreaNames.add(area.name);
        }
    }

    it("every classroom has exactly one teacher zone, known to the front config", () => {
        for (const slug of ["arabic", "chess", "communication", "english", "math", "reading", "science"]) {
            const wam = wams.get(`classroom-${slug}.wam`);
            const names = ((wam?.areas as { name: string }[]) ?? []).map((a) => a.name);
            expect(names, `teacher zone in classroom-${slug}`).toContain(`teacher-${slug}`);
            expect(NG_TEACHERS[`teacher-${slug}`], `config for teacher-${slug}`).toBeDefined();
            expect(NG_TEACHERS[`teacher-${slug}`].portrait).not.toMatch(/https?:\/\//);
        }
    });

    it("every Gino explanation and teacher key matches a real area name", () => {
        for (const key of Object.keys(NG_GINO_EXPLAIN)) {
            expect(allAreaNames.has(key), `explain area ${key}`).toBe(true);
        }
        for (const key of Object.keys(NG_TEACHERS)) {
            expect(allAreaNames.has(key), `teacher area ${key}`).toBe(true);
        }
    });
});

describe("NG Academy school world — the line gathering point", () => {
    it("the entrance has a gathering area where Gino's line forms", () => {
        const wam = wams.get("entrance.wam");
        const names = ((wam?.areas as { name: string }[]) ?? []).map((a) => a.name);
        expect(names).toContain("gathering");
        expect(names).toContain("ng-admin-office");
    });
});

describe("NG Academy school world — the math classroom (rooms, first batch)", () => {
    interface NgArea {
        name: string;
        x: number;
        y: number;
        width: number;
        height: number;
    }

    it("has an abacus corner that stays out of the lesson microphones", () => {
        const areas = ((wams.get("classroom-math.wam")?.areas as NgArea[] | undefined) ?? []).map((a) => a);
        const names = areas.map((a) => a.name);
        expect(names).toContain("abacus");
        expect(names).toContain("teacher-math");
        const abacus = areas.find((a) => a.name === "abacus");
        const lesson = areas.find((a) => a.name === "lesson");
        expect(abacus && lesson).toBeTruthy();
        if (abacus && lesson) {
            // no mic while playing: the corner begins where the livekit lesson area ends
            expect(abacus.x).toBeGreaterThanOrEqual(lesson.x + lesson.width);
            expect(abacus.width).toBe(96); // 3×4 tiles of rug
            expect(abacus.height).toBe(128);
        }
    });

    it("gives every pupil desk its own abacus and decorates the room", () => {
        const tmj = tmjs.get("classroom-math.wam");
        expect(tmj).toBeTruthy();
        const furniture = tmj?.layers.find((l) => l.name === "furniture")?.data ?? [];
        const floor = tmj?.layers.find((l) => l.name === "floor")?.data ?? [];
        const count = (data: number[], gid: number) => data.filter((v) => v === gid).length;
        expect(count(furniture, 17)).toBe(8); // abacus: 6 pupil desks + 2 corner stations
        expect(count(furniture, 18)).toBe(9); // boardMath blackboard wall (x3..11)
        expect(count(furniture, 19)).toBe(14); // numberLine strip 0-8 along the floor
        expect(count(furniture, 23)).toBe(1); // teacherDesk with the apple
        expect(count(furniture, 24)).toBe(1); // clock
        expect(count(furniture, 20)).toBe(1); // posterShapes
        expect(count(furniture, 21)).toBe(1); // posterNumbers
        expect(count(floor, 22)).toBe(12); // rugMath 3×4 under the corner
    });
});

describe("NG Academy school world — curated LimeZu tilesets (look upgrade)", () => {
    it("every external tileset is credited and trimmed tiny (weak devices)", () => {
        for (const [wamFile, tmj] of tmjs) {
            for (const tileset of tmj.tilesets) {
                if (!tileset.image.includes("ng-school-")) continue;
                const copyright = tmj.tilesets
                    .find((t) => t.image === tileset.image)
                    ?.properties?.find((pr) => pr.name === "tilesetCopyright");
                expect(copyright?.value, `${wamFile} ${tileset.image} copyright`).toContain("LimeZu");
                const png = join(MAPS_DIR, dirname(String(wams.get(wamFile)?.mapUrl)), tileset.image);
                expect(statSync(png).size, `${tileset.image} must stay trimmed`).toBeLessThanOrEqual(4096);
                expect(tileset.tilecount).toBeLessThanOrEqual(32);
            }
        }
    });

    it("decorates every room: each map uses at least one curated tile", () => {
        for (const [wamFile, tmj] of tmjs) {
            const external = tmj.tilesets.filter((t) => t.image.includes("ng-school-"));
            expect(external.length, wamFile).toBeGreaterThanOrEqual(1);
            const gids = new Set<number>();
            for (const t of external) for (let id = 0; id < t.tilecount; id++) gids.add(t.firstgid + id);
            const used = tmj.layers.some((l) => l.data?.some((g) => gids.has(g)));
            expect(used, `${wamFile} should show its curated tiles`).toBe(true);
        }
    });
});
