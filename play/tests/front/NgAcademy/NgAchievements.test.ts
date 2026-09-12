import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import { dismissCurrentBubble, ngCurrentBubble, ngResetForTests } from "../../../src/front/NgAcademy/GinoStore";
import {
    ngAchievementsPollNow,
    ngAchievementsResetForTests,
    ngAchievementsStart,
    ngAchievementsStop,
} from "../../../src/front/NgAcademy/NgAchievements";

const API = "http://ng-api.test";

function stubFetch(achievements: { id: string; badgeName: string }[], ok = true) {
    const fetchMock = vi.fn(() =>
        Promise.resolve(
            ok
                ? new Response(JSON.stringify({ achievements, progress: [] }), { status: 200 })
                : new Response("", { status: 500 }),
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

beforeEach(() => {
    vi.useFakeTimers();
    ngResetForTests();
    ngAchievementsResetForTests();
    dismissCurrentBubble();
    window.localStorage.clear();
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe("NG achievements watcher (phase 7)", () => {
    it("stays completely silent without a session token or without NG_API_URL", async () => {
        const fetchMock = stubFetch([{ id: "1", badgeName: "شارة" }]);
        ngAchievementsStart({ apiUrl: API, intervalMs: 1000 });
        await vi.advanceTimersByTimeAsync(3000);
        expect(fetchMock).not.toHaveBeenCalled(); // no ng-token → no request at all

        window.localStorage.setItem("ng-token", "jwt");
        ngAchievementsStart({ apiUrl: "", intervalMs: 1000 }); // no API configured
        expect(get(ngCurrentBubble)).toBeNull();
        ngAchievementsStop();
    });

    it("records the first poll silently, then celebrates only new badges", async () => {
        window.localStorage.setItem("ng-token", "jwt");
        const fetchMock = stubFetch([
            { id: "a1", badgeName: "قراءة قصة قصيرة" },
            { id: "a2", badgeName: "تمارين الرياضيات اليومية" },
        ]);
        await ngAchievementsPollNow(API);
        expect(get(ngCurrentBubble)).toBeNull(); // old badges never storm the child
        expect(window.localStorage.getItem("ng-achievements-seen")).toContain("a1");

        // a teacher grants a new badge
        fetchMock.mockImplementation(() =>
            Promise.resolve(
                new Response(
                    JSON.stringify({
                        achievements: [
                            { id: "a1", badgeName: "قراءة قصة قصيرة" },
                            { id: "a2", badgeName: "تمارين الرياضيات اليومية" },
                            { id: "a3", badgeName: "بطل الشطرنج" },
                        ],
                        progress: [],
                    }),
                    { status: 200 },
                ),
            ),
        );
        await ngAchievementsPollNow(API);
        const bubble = get(ngCurrentBubble);
        expect(bubble?.text).toContain("بطل الشطرنج");
        expect(bubble?.text).toContain("مبروك");

        // …and never celebrates the same badge twice
        dismissCurrentBubble();
        await ngAchievementsPollNow(API);
        expect(get(ngCurrentBubble)).toBeNull();
    });

    it("polls on a timer and survives API errors without bothering the child", async () => {
        window.localStorage.setItem("ng-token", "jwt");
        const fetchMock = stubFetch([], false); // API down
        ngAchievementsStart({ apiUrl: API, intervalMs: 1000 });
        await vi.advanceTimersByTimeAsync(2500);
        expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
        expect(get(ngCurrentBubble)).toBeNull(); // silent failure
        ngAchievementsStop();

        // start() is idempotent: a second call never doubles the timer
        const before = fetchMock.mock.calls.length;
        ngAchievementsStart({ apiUrl: API, intervalMs: 1000 });
        ngAchievementsStart({ apiUrl: API, intervalMs: 1000 });
        await vi.advanceTimersByTimeAsync(1000);
        const delta = fetchMock.mock.calls.length - before; // immediate poll + one tick
        expect(delta).toBeLessThanOrEqual(2);
        await vi.advanceTimersByTimeAsync(1000);
        expect(fetchMock.mock.calls.length - before - delta).toBe(1); // exactly one timer alive
        ngAchievementsStop();
    });

    it("sends the token as a Bearer header to the configured API only", async () => {
        window.localStorage.setItem("ng-token", "jwt-child");
        const fetchMock = stubFetch([]);
        await ngAchievementsPollNow(`${API}/`);
        expect(fetchMock).toHaveBeenCalledWith(`${API}/ng/my/achievements`, {
            headers: { Authorization: "Bearer jwt-child" },
        });
    });
});
