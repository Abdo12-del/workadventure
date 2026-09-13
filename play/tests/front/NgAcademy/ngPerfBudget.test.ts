import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NG_ACHIEVEMENTS_POLL_MS } from "../../../src/front/NgAcademy/NgAchievements";

/**
 * NG Academy phase 9 — the weak-device budget (requirement 17), enforced by
 * tests so it cannot silently regress:
 *  - school-world assets stay small (phones/tablets download them all);
 *  - the heavy camera-effect engines (MediaPipe + wasm) never sit in the main
 *    bundle — they must stay behind dynamic import();
 *  - the platform defaults shipped in .env.template stay child/low-end friendly
 *    (few simultaneous videos, half-density lesson video, no notifications);
 *  - NG's own polling never goes faster than once a minute.
 */
const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, "../../../..");
const NG_IMAGES = join(REPO_ROOT, "play/public/static/images/ng");
const NG_MAPS = join(REPO_ROOT, "maps/ng-academy");
const ENV_TEMPLATE = readFileSync(join(REPO_ROOT, ".env.template"), "utf-8");

const KB = 1024;

function filesIn(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? filesIn(join(dir, entry.name)) : [join(dir, entry.name)],
    );
}

function sizeOf(file: string): number {
    return statSync(file).size;
}

function envValue(key: string): string | undefined {
    const line = ENV_TEMPLATE.split("\n").find((l) => l.startsWith(`${key}=`));
    return line?.slice(key.length + 1);
}

describe("NG Academy performance budget (phase 9)", () => {
    it("school-world images stay tiny: ≤100KB each, ≤400KB total", () => {
        const files = filesIn(NG_IMAGES);
        expect(files.length).toBeGreaterThan(0);
        for (const file of files) {
            expect(sizeOf(file), `${file} is too heavy for a weak tablet`).toBeLessThanOrEqual(100 * KB);
        }
        const total = files.reduce((sum, file) => sum + sizeOf(file), 0);
        expect(total).toBeLessThanOrEqual(400 * KB);
    });

    it("the 13 generated maps stay light: minified, ≤64KB per TMJ, ≤8KB per WAM, ≤400KB total", () => {
        const wams = filesIn(NG_MAPS).filter((f) => f.endsWith(".wam"));
        const tmjs = filesIn(NG_MAPS).filter((f) => f.endsWith(".tmj"));
        expect(wams).toHaveLength(13);
        expect(tmjs).toHaveLength(13);
        for (const file of wams) expect(sizeOf(file), file).toBeLessThanOrEqual(8 * KB);
        for (const file of tmjs) expect(sizeOf(file), file).toBeLessThanOrEqual(64 * KB);
        // maps are runtime assets: the generator must keep them minified
        const entrance = readFileSync(join(NG_MAPS, "entrance.tmj"), "utf-8");
        expect(entrance.split("\n").length).toBeLessThanOrEqual(2);
        const total = filesIn(NG_MAPS).reduce((sum, file) => sum + sizeOf(file), 0);
        expect(total).toBeLessThanOrEqual(400 * KB);
    });

    it("keeps MediaPipe out of the main bundle (dynamic import only)", () => {
        const factory = readFileSync(
            join(REPO_ROOT, "play/src/front/WebRtc/BackgroundProcessor/createBackgroundTransformer.ts"),
            "utf-8",
        );
        // no static import of the heavy transformer modules or mediapipe packages
        expect(factory).not.toMatch(/^\s*import\s+\{[^}]*\}\s+from\s+"(\.\/MediaPipe|@mediapipe)/m);
        // both engines are loaded on demand instead
        expect(factory).toContain('await import("./MediaPipeTasksVisionTransformer")');
        expect(factory).toContain('await import("./MediaPipeBackgroundTransformer")');
        // and no other front module may import them statically either
        const offenders = filesIn(join(REPO_ROOT, "play/src/front"))
            .filter((f) => f.endsWith(".ts"))
            .filter((f) => !f.includes("BackgroundProcessor"))
            .filter(
                (f) =>
                    readFileSync(f, "utf-8").match(/^import[^;]*from "@mediapipe/m) ||
                    readFileSync(f, "utf-8").match(/^import[^;]*MediaPipe[^;]*from/m),
            );
        expect(offenders, `static mediapipe imports: ${offenders.join(", ")}`).toEqual([]);
    });

    it("ships weak-device defaults in .env.template", () => {
        expect(envValue("DISABLE_NOTIFICATIONS")).toBe("true");
        expect(envValue("SKIP_RENDER_OPTIMIZATIONS")).toBe("false");
        expect(envValue("ENABLE_CHAT")).toBe("false");
        expect(Number(envValue("MAX_DISPLAYED_VIDEOS"))).toBeLessThanOrEqual(4);
        expect(Number(envValue("LIVEKIT_PIXEL_DENSITY"))).toBeLessThanOrEqual(0.5);
    });

    it("never polls faster than once a minute for achievements", () => {
        expect(NG_ACHIEVEMENTS_POLL_MS).toBeGreaterThanOrEqual(60_000);
    });
});
