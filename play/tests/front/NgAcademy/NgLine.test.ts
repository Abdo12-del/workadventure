import { beforeEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import { dismissCurrentBubble, ngCurrentBubble, ngResetForTests } from "../../../src/front/NgAcademy/GinoStore";
import {
    NG_LINE_LEAD_TILES,
    NG_LINE_PATHS,
    ngGetMyClass,
    ngLeaderPosition,
    ngLineExitUrl,
    ngLineIsWalking,
    ngLineJoin,
    ngLineOffer,
    ngLineResetForTests,
    ngSetMyClass,
    type NgLineDriver,
} from "../../../src/front/NgAcademy/NgLine";

function fakeDriver() {
    const walks: [number, number][] = [];
    const rooms: string[] = [];
    const leaders: ({ x: number; y: number } | null)[] = [];
    let manualCb: (() => void) | undefined;
    const driver: NgLineDriver = {
        walkToTile: (x, y) => {
            walks.push([x, y]);
            return Promise.resolve({ cancelled: false });
        },
        goRoom: (url) => {
            rooms.push(url);
            return Promise.resolve();
        },
        onManualInput: (cb) => {
            manualCb = cb;
            return () => (manualCb = undefined);
        },
        showLeader: (position) => {
            leaders.push(position);
        },
    };
    return { driver, walks, rooms, leaders, triggerManual: () => manualCb?.() };
}

beforeEach(() => {
    vi.useFakeTimers();
    ngResetForTests();
    ngLineResetForTests();
    dismissCurrentBubble();
    window.localStorage.clear();
});

describe("Gino's line — choosing the class", () => {
    it("remembers the child's class on the device and rejects junk", () => {
        expect(ngGetMyClass()).toBeNull();
        ngSetMyClass("math");
        expect(ngGetMyClass()).toBe("math");
        window.localStorage.setItem("ng-academy-my-class", "hacker-room");
        expect(ngGetMyClass()).toBeNull();
    });

    it("offers the picker when the class is unknown, and the line when it is known", () => {
        const picker = vi.fn();
        ngLineOffer(picker);
        let bubble = get(ngCurrentBubble);
        expect(bubble?.actions?.map((a) => a.id)).toEqual(["pick", "explore"]);

        dismissCurrentBubble();
        ngSetMyClass("chess");
        vi.advanceTimersByTime(61_000);
        ngLineOffer(picker);
        bubble = get(ngCurrentBubble);
        expect(bubble?.actions?.map((a) => a.id)).toEqual(["join", "explore"]);
    });

    it("never nags: a second step on the gathering carpet stays silent", () => {
        const picker = vi.fn();
        ngLineOffer(picker);
        dismissCurrentBubble();
        ngLineOffer(picker);
        expect(get(ngCurrentBubble)).toBeNull();
        vi.advanceTimersByTime(61_000);
        ngLineOffer(picker);
        expect(get(ngCurrentBubble)?.kind).toBe("gino");
    });
});

describe("Gino's line — walking one behind the other", () => {
    it("walks the shared path, keeps Gino ahead on it, then hands over at the door", async () => {
        const { driver, walks, rooms, leaders } = fakeDriver();
        await ngLineJoin("math", driver);
        const path = NG_LINE_PATHS.math;
        expect(walks).toEqual([...path.waypoints, path.door]);
        expect(rooms).toEqual([ngLineExitUrl("math")]);
        // one leader marker per segment, always ahead of where the child stood
        const shown = leaders.filter((l): l is { x: number; y: number } => l !== null);
        expect(shown).toHaveLength(path.waypoints.length + 1);
        expect(shown[0]).toEqual(ngLeaderPosition(path, 0, NG_LINE_LEAD_TILES));
        expect(leaders[leaders.length - 1]).toBeNull(); // hidden at the door
        expect(ngLineIsWalking()).toBe(false);
    });

    it("steps out silently when the child takes over the controls", async () => {
        const { driver, walks, rooms, triggerManual } = fakeDriver();
        const baseWalk = driver.walkToTile.bind(driver);
        let calls = 0;
        driver.walkToTile = (x, y) => {
            calls++;
            if (calls === 2) triggerManual(); // child grabs the keyboard mid-line
            return baseWalk(x, y);
        };
        await ngLineJoin("arabic", driver);
        expect(walks).toHaveLength(2);
        expect(rooms).toEqual([]); // never dragged into a room against their will
        expect(ngLineIsWalking()).toBe(false);
    });

    it("Gino stays on the path: leader geometry along segments, corners and the door", () => {
        const path = NG_LINE_PATHS.math; // stops: (12,22)->(12,18)->(17,18)->door(17,2)
        expect(ngLeaderPosition(path, 0, 2.5)).toEqual({ x: 12, y: 19.5 });
        // exactly at a corner the lead bends into the next segment
        expect(ngLeaderPosition(path, 1, 2.5)).toEqual({ x: 14.5, y: 18 });
        // more lead than path left: Gino waits at the door
        expect(ngLeaderPosition(path, 3, 10)).toEqual({ x: 17, y: 2 });
    });

    it("every classroom door of the entrance map is served by the line", () => {
        for (const [slug, path] of Object.entries(NG_LINE_PATHS)) {
            const [dx, dy] = path.door;
            expect(dy === 2 || dx === 2, `door of ${slug}`).toBe(true);
            expect(ngLineExitUrl(slug as keyof typeof NG_LINE_PATHS)).toContain(`classroom-${slug}.wam`);
        }
    });
});
