import { describe, expect, it } from "vitest";
import { parseNgToken } from "../../../src/front/NgAcademy/NgSession";

describe("NG Academy world session bridge", () => {
    it("reads the token the portal gate puts in the hash", () => {
        expect(parseNgToken("#ngToken=abc%2Fdef", "", null)).toBe("abc/def");
    });

    it("also accepts a query-string token", () => {
        expect(parseNgToken("", "?ngToken=xyz", null)).toBe("xyz");
    });

    it("falls back to the stored session token", () => {
        expect(parseNgToken("", "", "stored")).toBe("stored");
    });

    it("returns null when nothing carries a token", () => {
        expect(parseNgToken("#room=xyz", "?x=1", null)).toBeNull();
    });
});
