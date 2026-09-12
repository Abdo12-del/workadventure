/**
 * NG Academy — أكاديمية الجيل الجديد
 * «صف جينو» — Gino's line: at the gathering carpet children queue up like a real
 * school line and walk ONE BEHIND THE OTHER following Gino, who walks in front.
 *
 * Owner decision: never a forced teleport — a normal school line. The ordering
 * emerges naturally: the path is identical for everyone, so whoever joins the
 * line first ends up in front, and later joiners slot in behind them, exactly
 * like children lining up in the corridor. Gino leads: his marker floats a
 * couple of tiles ahead of each child on the path.
 *
 * The state machine is driver-injected (unit-testable without Phaser);
 * NgLineSceneAdapter binds it to the real GameScene (pathfinding walk, room
 * change through the standard exit flow, Gino marker as a scene DOM element).
 */
import { get } from "svelte/store";
import { dismissCurrentBubble, ngCurrentBubble, showBubble } from "./GinoStore";
import { GINO_PORTRAIT } from "./NgAcademyConfig";
import type { NgBubble } from "./NgBubble";

export interface NgLineDriver {
    /** Walk the player to a tile center. Resolves on arrival or cancellation. */
    walkToTile(x: number, y: number): Promise<{ cancelled: boolean }>;
    /** Change room through the standard exit flow (same as stepping on the door). */
    goRoom(exitUrl: string): Promise<void>;
    /** One-shot "the child took over the controls" listener. Returns unsubscriber. */
    onManualInput(cb: () => void): () => void;
    /** Show/hide Gino's leading marker at tile coordinates (floats); null hides it. */
    showLeader(position: { x: number; y: number } | null): void;
}

export const NG_CLASSROOM_SLUGS = [
    "arabic",
    "english",
    "math",
    "science",
    "chess",
    "reading",
    "communication",
] as const;
export type NgClassroomSlug = (typeof NG_CLASSROOM_SLUGS)[number];

export const NG_CLASSROOM_LABELS: Record<NgClassroomSlug, string> = {
    arabic: "📖 فصل اللغة العربية",
    english: "🔤 فصل اللغة الإنجليزية",
    math: "🔢 فصل الرياضيات",
    science: "🔬 فصل العلوم",
    chess: "♟️ فصل الشطرنج",
    reading: "✏️ فصل القراءة والكتابة",
    communication: "💬 فصل مهارات التواصل",
};

/** Toast uuid of the "أين فصلي؟" picker overlay. */
export const NG_CLASS_PICKER_TOAST_UUID = "ng-class-picker";

const STORAGE_KEY = "ng-academy-my-class";

export function ngGetMyClass(): NgClassroomSlug | null {
    try {
        const value = window.localStorage.getItem(STORAGE_KEY);
        return (NG_CLASSROOM_SLUGS as readonly string[]).includes(value ?? "") ? (value as NgClassroomSlug) : null;
    } catch {
        return null;
    }
}

export function ngSetMyClass(slug: NgClassroomSlug): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, slug);
    } catch {
        /* private mode: the line still works this session */
    }
}

/**
 * Walking routes on the entrance map (tile coordinates), from the gathering
 * carpet (12,22) to one tile inside each classroom door. Mirrors the door
 * positions of maps/ng-academy/generate.mjs. Same path for every child:
 * join order = place in the line.
 */
export const NG_LINE_PATHS: Record<NgClassroomSlug, { waypoints: [number, number][]; door: [number, number] }> = {
    arabic: {
        waypoints: [
            [12, 18],
            [6, 18],
        ],
        door: [6, 2],
    },
    english: { waypoints: [[12, 18]], door: [12, 2] },
    math: {
        waypoints: [
            [12, 18],
            [17, 18],
        ],
        door: [17, 2],
    },
    science: {
        waypoints: [
            [12, 18],
            [22, 18],
        ],
        door: [22, 2],
    },
    chess: {
        waypoints: [
            [8, 20],
            [3, 20],
            [3, 6],
        ],
        door: [2, 6],
    },
    reading: {
        waypoints: [
            [8, 20],
            [3, 20],
            [3, 12],
        ],
        door: [2, 12],
    },
    communication: {
        waypoints: [
            [8, 20],
            [3, 20],
            [3, 18],
        ],
        door: [2, 18],
    },
};

export function ngLineExitUrl(slug: NgClassroomSlug): string {
    return `./classroom-${slug}.wam#from_entrance`;
}

/** How many tiles ahead of the child Gino walks. */
export const NG_LINE_LEAD_TILES = 2.5;

/** The ordered stops of a line: gathering carpet, waypoints, classroom door. */
export function ngLineStops(path: { waypoints: [number, number][]; door: [number, number] }): [number, number][] {
    return [[12, 22], ...path.waypoints, path.door];
}

/**
 * Pure geometry: the point on the path, `lead` tiles ahead of the child standing
 * at stop `stopIndex` (0 = the gathering carpet). Gino never leaves the path and
 * never teleports: past the door he simply waits there.
 */
export function ngLeaderPosition(
    path: { waypoints: [number, number][]; door: [number, number] },
    stopIndex: number,
    lead: number,
): { x: number; y: number } {
    const stops = ngLineStops(path);
    let distance = lead;
    for (let i = 0; i < Math.min(stopIndex, stops.length - 1); i++) {
        const [ax, ay] = stops[i];
        const [bx, by] = stops[i + 1];
        distance += Math.hypot(bx - ax, by - ay);
    }
    let cursor = { x: stops[0]?.[0] ?? 0, y: stops[0]?.[1] ?? 0 };
    for (let i = 1; i < stops.length; i++) {
        const [nx, ny] = stops[i];
        const dx = nx - cursor.x;
        const dy = ny - cursor.y;
        const dist = Math.hypot(dx, dy);
        if (dist <= 1e-6) continue;
        if (dist >= distance) {
            const k = distance / dist;
            return { x: cursor.x + dx * k, y: cursor.y + dy * k };
        }
        distance -= dist;
        cursor = { x: nx, y: ny };
    }
    return cursor; // lead exceeds the path: Gino waits at the door
}

let walking = false;
let lastOfferAt = 0;

export function ngLineIsWalking(): boolean {
    return walking;
}

function gino(text: string, extra: Partial<NgBubble> = {}): NgBubble {
    return { kind: "gino", speaker: "جينو المرشد", text, portrait: GINO_PORTRAIT, duration: 9000, ...extra };
}

/**
 * Called when the child steps on the gathering area. Offers the line once per
 * minute (never nags), and stays quiet while another bubble talks.
 */
export function ngLineOffer(openClassPicker: () => void): void {
    if (walking) return;
    const now = Date.now();
    if (now - lastOfferAt < 60_000) return;
    if (get(ngCurrentBubble) !== null) return;
    lastOfferAt = now;

    const myClass = ngGetMyClass();
    if (myClass === null) {
        showBubble(
            gino("أهلًا يا مستكشف! 🦉 من هنا يصطفّ الأطفال وراء بعضهم وأنا أمشي أمامهم. قل لي أين فصلك نصطف معًا!", {
                actions: [
                    { id: "pick", label: "🏫 أين فصلي؟" },
                    { id: "explore", label: "🚶 سأستكشف بنفسي" },
                ],
                duration: 12000,
            }),
            (actionId) => {
                dismissCurrentBubble();
                if (actionId === "pick") openClassPicker();
            },
        );
    } else {
        showBubble(
            gino(`صف ${NG_CLASSROOM_LABELS[myClass]} يصطف الآن على السجادة! انضم وراء أصدقائك وسأمشي أمامكم 🦉`, {
                actions: [
                    { id: "join", label: "🚶 أنضم إلى الصف" },
                    { id: "explore", label: "🌳 سأبقى في الساحة" },
                ],
                duration: 12000,
            }),
            (actionId) => {
                dismissCurrentBubble();
                if (actionId === "join") ngLineJoin(myClass).catch((e) => console.error(e));
            },
        );
    }
}

/** Join the line: walk the shared path behind whoever joined earlier, Gino in front. */
export async function ngLineJoin(slug: NgClassroomSlug, driver?: NgLineDriver): Promise<void> {
    const activeDriver = driver ?? ngLineDriver;
    if (!activeDriver || walking) return;
    walking = true;

    let steppedOut = false;
    const unsubscribe = activeDriver.onManualInput(() => {
        // The child wants to walk alone: step out of the line silently.
        steppedOut = true;
        walking = false;
        activeDriver.showLeader(null);
        unsubscribe();
    });

    try {
        const path = NG_LINE_PATHS[slug];
        showBubble(gino("امشِ وراء صديقك الذي أمامك، وأنا أمامكم جميعًا 🦉", { duration: 4000 }));
        const stops: [number, number][] = [...path.waypoints, path.door];
        for (let i = 0; i < stops.length; i++) {
            if (steppedOut) return;
            // Gino walks a couple of tiles ahead of the child, always on the path.
            activeDriver.showLeader(ngLeaderPosition(path, i, NG_LINE_LEAD_TILES));
            const [x, y] = stops[i] ?? [0, 0];
            // eslint-disable-next-line no-await-in-loop
            const result = await activeDriver.walkToTile(x, y);
            if (result.cancelled || steppedOut) return;
        }
        if (steppedOut) return;
        activeDriver.showLeader(null);
        showBubble(gino(`وصل صفّنا! هذا ${NG_CLASSROOM_LABELS[slug]} — ادخلوا مبتسمين 💙`, { duration: 5000 }));
        await activeDriver.goRoom(ngLineExitUrl(slug));
    } finally {
        // Single writer at a single point: the manual-input callback only ever
        // flips `walking` to false, never back, so this is race-free by design.
        // eslint-disable-next-line require-atomic-updates
        walking = false;
        unsubscribe();
    }
}

/* ------------------------------------------------------------------ *
 * Real-game binding (thin; the logic above is what tests cover)
 * ------------------------------------------------------------------ */
let ngLineDriver: NgLineDriver | undefined;

export function ngLineSetDriver(driver: NgLineDriver | undefined): void {
    ngLineDriver = driver;
}

/** Test hook. */
export function ngLineResetForTests(): void {
    walking = false;
    lastOfferAt = 0;
}
