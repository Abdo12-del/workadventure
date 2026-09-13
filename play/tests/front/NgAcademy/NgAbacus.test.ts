import { beforeEach, describe, expect, it } from "vitest";
import {
    NG_ABACUS_MAX_BEADS,
    NG_ABACUS_RODS,
    ngAbacusDigits,
    ngAbacusMove,
    ngAbacusReset,
    ngAbacusSolved,
    ngAbacusTarget,
    ngAbacusValue,
    ngLoadBeads,
    ngSaveBeads,
    type NgBeads,
} from "../../../src/front/NgAcademy/NgAbacus";

beforeEach(() => {
    window.localStorage.clear();
});

describe("the per-student abacus (math classroom)", () => {
    it("reads the rods as a place-value number", () => {
        expect(ngAbacusValue([0, 0, 0, 0])).toBe(0);
        expect(ngAbacusValue([1, 2, 3, 4])).toBe(1234);
        expect(ngAbacusValue([0, 3, 0, 7])).toBe(307);
        expect(ngAbacusValue([9, 9, 9, 9])).toBe(9999);
        expect(ngAbacusDigits(307)).toEqual([0, 3, 0, 7]);
    });

    it("moves beads on one rod at a time and never leaves 0..9", () => {
        let beads = ngAbacusReset();
        beads = ngAbacusMove(beads, 2, 5); // tens rod +5
        expect(beads).toEqual([0, 0, 5, 0]);
        beads = ngAbacusMove(beads, 2, 9); // clamped at 9
        expect(beads[2]).toBe(NG_ABACUS_MAX_BEADS);
        beads = ngAbacusMove(beads, 2, -20); // clamped at 0
        expect(beads[2]).toBe(0);
        // an invalid rod changes nothing
        const same = ngAbacusMove(beads, 7, 1);
        expect(same).toEqual(beads);
    });

    it("challenges stay in 1..999 — always reachable with three rods", () => {
        expect(ngAbacusTarget(() => 0)).toBe(1);
        expect(ngAbacusTarget(() => 0.9999)).toBeLessThanOrEqual(999);
        for (let i = 0; i < 50; i++) {
            const target = ngAbacusTarget();
            expect(target).toBeGreaterThanOrEqual(1);
            expect(target).toBeLessThanOrEqual(999);
        }
    });

    it("knows when the child built the target number", () => {
        expect(ngAbacusSolved([0, 4, 2, 0] as NgBeads, 420)).toBe(true);
        expect(ngAbacusSolved([0, 4, 2, 1] as NgBeads, 420)).toBe(false);
    });

    it("keeps the child's beads on the device and rejects tampering", () => {
        expect(ngLoadBeads()).toEqual([0, 0, 0, 0]); // fresh start
        ngSaveBeads([0, 1, 2, 3]);
        expect(ngLoadBeads()).toEqual([0, 1, 2, 3]); // same child, same device
        window.localStorage.setItem("ng-academy-abacus", "[99,-1,0,0]");
        expect(ngLoadBeads()).toEqual([0, 0, 0, 0]); // junk → zero
        window.localStorage.setItem("ng-academy-abacus", "not-json");
        expect(ngLoadBeads()).toEqual([0, 0, 0, 0]);
    });

    it("has exactly four rods, labelled thousands to ones", () => {
        expect(NG_ABACUS_RODS).toBe(4);
    });
});
