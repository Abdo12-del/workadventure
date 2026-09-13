/**
 * NG Academy — أكاديمية الجيل الجديد
 * The math classroom abacus (المعداد) — one per student: every child gets
 * their own abacus on their own device (beads persist locally, nothing is
 * shared or ranked). Pure logic lives here so it is testable without any UI;
 * `NgAbacus.svelte` renders it when the child stands in the "abacus" corner
 * area of classroom-math.
 *
 * Four rods (thousands → ones), 0..9 beads each. Challenges stay below 1000
 * so six-year-olds can always succeed with three rods (requirement: encourage).
 */

/** Toast uuid of the abacus overlay. */
export const NG_ABACUS_TOAST_UUID = "ng-abacus";

export const NG_ABACUS_ROD_LABELS = ["الآلاف", "المئات", "العشرات", "الآحاد"] as const;
export const NG_ABACUS_RODS = 4;
export const NG_ABACUS_MAX_BEADS = 9;

const STORAGE_KEY = "ng-academy-abacus";

/** Bead counts per rod, thousands first: [1,2,3,4] shows 1234. */
export type NgBeads = [number, number, number, number];

export function ngAbacusValue(beads: NgBeads): number {
    return beads[0] * 1000 + beads[1] * 100 + beads[2] * 10 + beads[3];
}

/** Move beads on one rod, clamped to 0..9 — an invalid rod changes nothing. */
export function ngAbacusMove(beads: NgBeads, rod: number, delta: number): NgBeads {
    if (!Number.isInteger(rod) || rod < 0 || rod >= NG_ABACUS_RODS) return beads;
    const next: NgBeads = [...beads];
    next[rod] = Math.min(NG_ABACUS_MAX_BEADS, Math.max(0, (beads[rod] ?? 0) + delta));
    return next;
}

export function ngAbacusReset(): NgBeads {
    return [0, 0, 0, 0];
}

/** A challenge target in 1..999 (three rods — always reachable). */
export function ngAbacusTarget(rng: () => number = Math.random): number {
    return 1 + Math.floor(rng() * 999);
}

export function ngAbacusSolved(beads: NgBeads, target: number): boolean {
    return ngAbacusValue(beads) === target;
}

/** Digits of the current value, padded to four rods for display. */
export function ngAbacusDigits(value: number): NgBeads {
    const clamped = Math.max(0, Math.min(9999, Math.floor(value)));
    return [
        Math.floor(clamped / 1000) % 10,
        Math.floor(clamped / 100) % 10,
        Math.floor(clamped / 10) % 10,
        clamped % 10,
    ];
}

export function ngLoadBeads(): NgBeads {
    try {
        const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
        if (
            Array.isArray(parsed) &&
            parsed.length === NG_ABACUS_RODS &&
            parsed.every((n) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= NG_ABACUS_MAX_BEADS)
        ) {
            return parsed as NgBeads;
        }
    } catch {
        // missing or tampered storage: every child starts from zero
    }
    return ngAbacusReset();
}

export function ngSaveBeads(beads: NgBeads): void {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(beads));
}

/** Tests only. */
export function ngAbacusResetForTests(): void {
    window.localStorage.removeItem(STORAGE_KEY);
}
