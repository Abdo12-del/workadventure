import { beforeEach, describe, expect, it, vi } from "vitest";
import { get } from "svelte/store";
import {
    dismissCurrentBubble,
    ngCelebrate,
    ngCurrentBubble,
    ngHandleAreasEntered,
    ngResetForTests,
    ngWelcome,
    showBubble,
} from "../../../src/front/NgAcademy/GinoStore";
import { NG_WELCOME_MESSAGE } from "../../../src/front/NgAcademy/NgAcademyConfig";
import type { NgBubble } from "../../../src/front/NgAcademy/NgBubble";

function bubble(text: string, duration = 8000): NgBubble {
    return { kind: "gino", speaker: "جينو المرشد", text, portrait: "/static/images/ng/gino.png", duration };
}

describe("GinoStore — the non-annoying guide", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        ngResetForTests();
        dismissCurrentBubble();
    });

    it("welcomes the child once per session, after a short settle delay", () => {
        ngWelcome();
        expect(get(ngCurrentBubble)).toBeNull(); // not yet: the child just landed
        vi.advanceTimersByTime(1600);
        const first = get(ngCurrentBubble);
        expect(first?.kind).toBe("gino");
        expect(first?.text).toBe(NG_WELCOME_MESSAGE);

        dismissCurrentBubble();
        ngWelcome();
        vi.advanceTimersByTime(5000);
        expect(get(ngCurrentBubble)).toBeNull(); // never twice in the same session
    });

    it("lets a teacher greet the child once per session", () => {
        ngHandleAreasEntered([{ name: "teacher-math", tooltip: "منطقة المعلم" }]);
        const greet = get(ngCurrentBubble);
        expect(greet?.kind).toBe("teacher");
        expect(greet?.speaker).toBe("أستاذ سامي");

        dismissCurrentBubble();
        ngHandleAreasEntered([{ name: "teacher-math" }]);
        expect(get(ngCurrentBubble)).toBeNull();
    });

    it("explains a place once, then stays silent there", () => {
        ngHandleAreasEntered([{ name: "yard", tooltip: "الساحة — العب واسترح مع أصدقائك 🌳" }]);
        const explain = get(ngCurrentBubble);
        expect(explain?.kind).toBe("gino");

        dismissCurrentBubble();
        vi.advanceTimersByTime(5000);
        ngHandleAreasEntered([{ name: "yard", tooltip: "الساحة — العب واسترح مع أصدقائك 🌳" }]);
        // only the throttled location banner may remain, never a second explanation
        const after = get(ngCurrentBubble);
        expect(after?.kind === "gino").toBe(false);
    });

    it("shows the throttled location banner for unknown areas", () => {
        ngHandleAreasEntered([{ name: "corridor", tooltip: "الممر الرئيسي" }]);
        const banner = get(ngCurrentBubble);
        expect(banner?.kind).toBe("location");
        expect(banner?.text).toContain("أنت الآن في");
        expect(banner?.text).toContain("الممر الرئيسي");

        dismissCurrentBubble();
        ngHandleAreasEntered([{ name: "corridor2", tooltip: "مكان آخر" }]);
        expect(get(ngCurrentBubble)).toBeNull(); // throttled within 3s
        vi.advanceTimersByTime(3100);
        ngHandleAreasEntered([{ name: "corridor2", tooltip: "مكان آخر" }]);
        expect(get(ngCurrentBubble)?.kind).toBe("location");
    });

    it("never stacks bubbles: the queue serves one at a time and drops excess", () => {
        showBubble(bubble("one"));
        showBubble(bubble("two"));
        showBubble(bubble("three"));
        showBubble(bubble("four"));
        showBubble(bubble("five")); // dropped: queue capped at 3
        expect(get(ngCurrentBubble)?.text).toBe("one");

        dismissCurrentBubble();
        expect(get(ngCurrentBubble)?.text).toBe("two");
        dismissCurrentBubble();
        expect(get(ngCurrentBubble)?.text).toBe("three");
        dismissCurrentBubble();
        expect(get(ngCurrentBubble)?.text).toBe("four");
        dismissCurrentBubble();
        expect(get(ngCurrentBubble)).toBeNull();
    });

    it("auto-dismisses after the bubble duration", () => {
        showBubble(bubble("short", 2000));
        expect(get(ngCurrentBubble)?.text).toBe("short");
        vi.advanceTimersByTime(2100);
        expect(get(ngCurrentBubble)).toBeNull();
    });

    it("celebrates achievements on demand (phase 7 hook)", () => {
        ngCelebrate("أحسنت! حصلت على شارة القارئ الصغير 🏅");
        expect(get(ngCurrentBubble)?.text).toContain("شارة القارئ الصغير");
    });
});
