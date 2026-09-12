import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.hoisted: the mock factory runs while the imports above the test body are evaluated.
const envState = vi.hoisted(() => ({
    CHILD_SAFE_MODE: true,
    EMBEDDED_DOMAINS_WHITELIST: ["trusted.org"],
    ICON_URL: "https://icon.academy.example",
    JITSI_URL: "https://meet.academy.example",
    PUSHER_URL: "https://play.academy.example",
    UPLOADER_URL: "https://uploader.academy.example",
}));

vi.mock("../../../src/front/Enum/EnvironmentVariable", () => envState);

vi.mock("../../../src/front/Administration/AnalyticsClient", () => ({
    analyticsClient: {
        trackAdminEvent: vi.fn(),
        trackEvent: vi.fn(),
        openTimedEvent: vi.fn(() => ({ close: vi.fn() })),
    },
}));

vi.mock("../../../src/front/Phaser/Game/GameManager", () => ({
    gameManager: { getCurrentGameScene: () => ({ connection: undefined }) },
}));

import {
    ChildSafetyBlockedError,
    assertEmbeddableForChildren,
    isUrlAllowedForChildren,
    trustHost,
} from "../../../src/front/ChildSafety/ChildSafety";
import { scriptUtils } from "../../../src/front/Api/ScriptUtils";
import { createCoWebsiteStore } from "../../../src/front/Stores/CoWebsiteStore";
import type { CoWebsite } from "../../../src/front/WebRtc/CoWebsite/CoWebsite";

function fakeCoWebsite(url: string): CoWebsite {
    return {
        getId: () => `id-${url}`,
        getUrl: () => new URL(url, window.location.origin),
        getIframe: () => undefined,
        getLoadIframe: () => undefined,
        getWidthPercent: () => undefined,
        isClosable: () => true,
        getHideUrl: () => false,
        getTitle: () => "test",
        getIcon: () => "",
        shouldCloseOnOpenInNewTab: () => false,
    };
}

describe("ChildSafety.isUrlAllowedForChildren", () => {
    beforeEach(() => {
        envState.CHILD_SAFE_MODE = true;
    });

    it("allows same-origin and relative URLs", () => {
        expect(isUrlAllowedForChildren("/@/academy/world/room")).toBe(true);
        expect(isUrlAllowedForChildren(new URL("/", window.location.origin).toString())).toBe(true);
    });

    it("allows the platform's own service hosts", () => {
        expect(isUrlAllowedForChildren("https://meet.academy.example/room1")).toBe(true);
        expect(isUrlAllowedForChildren("https://uploader.academy.example/file.png")).toBe(true);
    });

    it("allows the configured whitelist, including subdomains", () => {
        expect(isUrlAllowedForChildren("https://trusted.org/page")).toBe(true);
        expect(isUrlAllowedForChildren("https://cdn.trusted.org/page")).toBe(true);
    });

    it("rejects look-alike hosts and query-string tricks", () => {
        expect(isUrlAllowedForChildren("https://trusted.org.evil.com/")).toBe(false);
        expect(isUrlAllowedForChildren("https://evil.com/?x=trusted.org")).toBe(false);
        expect(isUrlAllowedForChildren("https://nottrusted.org/")).toBe(false);
    });

    it("rejects non-http(s) schemes", () => {
        expect(isUrlAllowedForChildren("javascript:alert(1)")).toBe(false);
        expect(isUrlAllowedForChildren("data:text/html,<script>alert(1)</script>")).toBe(false);
        expect(isUrlAllowedForChildren("blob:https://trusted.org/uuid")).toBe(false);
    });

    it("rejects unparsable URLs", () => {
        expect(isUrlAllowedForChildren("http://")).toBe(false);
    });

    it("trusts hosts registered at runtime (the current map server)", () => {
        expect(isUrlAllowedForChildren("https://maps.academy.example/school/map.json")).toBe(false);
        trustHost("maps.academy.example");
        expect(isUrlAllowedForChildren("https://maps.academy.example/school/map.json")).toBe(true);
    });

    it("allows everything when child-safe mode is disabled", () => {
        // The mocked env module is the live `envState` object: the policy reads it per call.
        envState.CHILD_SAFE_MODE = false;
        try {
            expect(isUrlAllowedForChildren("https://evil.com/")).toBe(true);
            expect(isUrlAllowedForChildren("javascript:alert(1)")).toBe(true);
        } finally {
            envState.CHILD_SAFE_MODE = true;
        }
    });
});

describe("ChildSafety.assertEmbeddableForChildren", () => {
    it("throws a typed error for blocked URLs only", () => {
        expect(() => assertEmbeddableForChildren("test", "https://evil.com/")).toThrow(ChildSafetyBlockedError);
        expect(() => assertEmbeddableForChildren("test", "https://trusted.org/")).not.toThrow();
    });
});

describe("ScriptUtils.openTab under child-safe mode", () => {
    it("does not open external tabs but keeps same-origin ones", () => {
        const open = vi.spyOn(window, "open").mockImplementation(() => null);
        try {
            scriptUtils.openTab("https://evil.com/kids");
            expect(open).not.toHaveBeenCalled();

            scriptUtils.openTab("/legal/school-page");
            expect(open).toHaveBeenCalledTimes(1);
        } finally {
            open.mockRestore();
        }
    });

    it("does not navigate away with goToPage", () => {
        // Assigning window.location.href in jsdom would trigger a navigation error,
        // so a blocked call must never reach the assignment: spy on console.warn instead
        // and assert no exception/no navigation attempt is observable.
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        try {
            scriptUtils.goToPage("https://evil.com/kids");
            expect(warn).toHaveBeenCalledWith(expect.stringContaining("[child-safety] WA.nav.goToPage"));
        } finally {
            warn.mockRestore();
        }
    });
});

describe("CoWebsite store under child-safe mode", () => {
    it("refuses to register co-websites outside the allowlist", () => {
        const store = createCoWebsiteStore();
        store.add(fakeCoWebsite("https://evil.com/side"));
        let current: CoWebsite[] = [];
        const unsubscribe = store.subscribe((value) => (current = value));
        expect(current).toHaveLength(0);

        store.add(fakeCoWebsite("https://trusted.org/side"));
        expect(current).toHaveLength(1);
        unsubscribe();
    });
});
