import { beforeEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import { ngCurrentBubble, ngResetForTests, dismissCurrentBubble } from "../../../src/front/NgAcademy/GinoStore";
import {
    NG_TRAIN_PATHS,
    ngGetMyClass,
    ngSetMyClass,
    ngTrainExitUrl,
    ngTrainIsRiding,
    ngTrainOffer,
    ngTrainResetForTests,
    ngTrainRide,
    type NgTrainDriver,
} from "../../../src/front/NgAcademy/NgTrain";

function fakeDriver() {
    const walks: [number, number][] = [];
    const rooms: string[] = [];
    let manualCb: (() => void) | undefined;
    const driver: NgTrainDriver = {
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
    };
    return { driver, walks, rooms, triggerManual: () => manualCb?.() };
}

beforeEach(() => {
    vi.useFakeTimers();
    ngResetForTests();
    ngTrainResetForTests();
    dismissCurrentBubble();
    window.localStorage.clear();
});

describe("Gino's train — choosing the class", () => {
    it("remembers the child's class on the device and rejects junk", () => {
        expect(ngGetMyClass()).toBeNull();
        ngSetMyClass("math");
        expect(ngGetMyClass()).toBe("math");
        window.localStorage.setItem("ng-academy-my-class", "hacker-room");
        expect(ngGetMyClass()).toBeNull();
    });

    it("offers the picker when the class is unknown, and the ride when it is known", () => {
        const picker = vi.fn();
        ngTrainOffer(picker);
        let bubble = get(ngCurrentBubble);
        expect(bubble?.actions?.map((a) => a.id)).toEqual(["pick", "explore"]);

        dismissCurrentBubble();
        ngSetMyClass("chess");
        vi.advanceTimersByTime(61_000); // offer throttle window
        ngTrainOffer(picker);
        bubble = get(ngCurrentBubble);
        expect(bubble?.actions?.map((a) => a.id)).toEqual(["ride", "explore"]);
    });

    it("never nags: a second step on the gathering carpet stays silent", () => {
        const picker = vi.fn();
        ngTrainOffer(picker);
        dismissCurrentBubble();
        ngTrainOffer(picker);
        expect(get(ngCurrentBubble)).toBeNull();
        vi.advanceTimersByTime(61_000);
        ngTrainOffer(picker);
        expect(get(ngCurrentBubble)?.kind).toBe("gino");
    });
});

describe("Gino's train — the ride", () => {
    it("walks the line waypoint by waypoint, then hands over at the door", async () => {
        const { driver, walks, rooms } = fakeDriver();
        await ngTrainRide("math", driver);
        const path = NG_TRAIN_PATHS.math;
        expect(walks).toEqual([...path.waypoints, path.door]);
        expect(rooms).toEqual([ngTrainExitUrl("math")]);
        expect(ngTrainIsRiding()).toBe(false);
    });

    it("hops off silently when the child takes over the controls", async () => {
        const { driver, walks, rooms, triggerManual } = fakeDriver();
        const baseWalk = driver.walkToTile.bind(driver); // the original, before override
        let calls = 0;
        driver.walkToTile = (x, y) => {
            calls++;
            if (calls === 2) triggerManual(); // child grabs the keyboard mid-ride
            return baseWalk(x, y);
        };
        await ngTrainRide("arabic", driver);
        expect(walks).toHaveLength(2); // stopped right after the takeover
        expect(rooms).toEqual([]); // never dragged into a room against their will
        expect(ngTrainIsRiding()).toBe(false);
    });

    it("serves every classroom door of the entrance map", () => {
        for (const [slug, path] of Object.entries(NG_TRAIN_PATHS)) {
            const [dx, dy] = path.door;
            // doors of generate.mjs: top row y=0 (stand at y=2), left column x=0 (stand at x=2)
            expect(dy === 2 || dx === 2, `door of ${slug}`).toBe(true);
            expect(ngTrainExitUrl(slug as keyof typeof NG_TRAIN_PATHS)).toContain(`classroom-${slug}.wam`);
        }
    });
});
