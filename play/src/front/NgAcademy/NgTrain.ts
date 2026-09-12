/**
 * NG Academy — أكاديمية الجيل الجديدة
 * «قطار جينو» — Gino's train: the owl gathers the children at the entrance
 * gathering carpet (نقطة التجمع) and walks them, line-style, to THEIR classroom.
 *
 * Owner decision (phase 6 replacement): children first explore freely and get to
 * know their section by walking; the train is an OPT-IN guide, never a forced
 * teleport. The child can hop off at any time (any key/tap cancels the ride).
 *
 * The state machine is driver-injected so it is fully unit-testable without a
 * Phaser scene; `ngTrainDriverFromScene` adapts the real GameScene
 * (pathfinding-aware walk + room change through the normal exit flow).
 */
import { get } from "svelte/store";
import { ngCurrentBubble, showBubble, dismissCurrentBubble } from "./GinoStore";
import { GINO_PORTRAIT } from "./NgAcademyConfig";
import type { NgBubble } from "./NgBubble";

export interface NgTrainDriver {
    /** Walk the player to a tile (center coordinates in tiles). Resolves when arrived or cancelled. */
    walkToTile(x: number, y: number): Promise<{ cancelled: boolean }>;
    /** Change room through the standard exit flow (same as stepping on the door). */
    goRoom(exitUrl: string): Promise<void>;
    /** Register a one-shot "child took over the controls" listener. Returns unsubscriber. */
    onManualInput(cb: () => void): () => void;
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

const STORAGE_KEY = "ng-academy-my-class";

/** Toast uuid of the "أين فصلي؟" picker overlay. */
export const NG_CLASS_PICKER_TOAST_UUID = "ng-class-picker";

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
        /* private mode: the ride still works this session */
    }
}

/**
 * Walking routes on the entrance map (tile coordinates), from the gathering
 * carpet (12,22) to one tile inside each classroom door. Mirrors the door
 * positions of maps/ng-academy/generate.mjs.
 */
export const NG_TRAIN_PATHS: Record<NgClassroomSlug, { waypoints: [number, number][]; door: [number, number] }> = {
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

/** Other doors (halls) are reachable too — the train only serves classrooms. */
export function ngTrainExitUrl(slug: NgClassroomSlug): string {
    return `./classroom-${slug}.wam#from_entrance`;
}

let riding = false;
let lastOfferAt = 0;

export function ngTrainIsRiding(): boolean {
    return riding;
}

function gino(text: string, extra: Partial<NgBubble> = {}): NgBubble {
    return { kind: "gino", speaker: "جينو المرشد", text, portrait: GINO_PORTRAIT, duration: 9000, ...extra };
}

/**
 * Called when the child steps on the gathering area. Offers the train once per
 * minute (never nags), and respects an ongoing ride or bubble.
 */
export function ngTrainOffer(openClassPicker: () => void): void {
    if (riding) return;
    const now = Date.now();
    if (now - lastOfferAt < 60_000) return;
    if (get(ngCurrentBubble) !== null) return;
    lastOfferAt = now;

    const myClass = ngGetMyClass();
    if (myClass === null) {
        showBubble(
            gino("أهلًا يا مستكشف! 🚂 أنا أعرف طريق كل الفصول. قل لي أين فصلك وسأمشي أمامك مثل القطار!", {
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
            gino(`قطار ${NG_CLASSROOM_LABELS[myClass]} ينطلق من السجادة! أأخذك إليه؟ 🚂`, {
                actions: [
                    { id: "ride", label: "🚂 خذني إلى فصلي" },
                    { id: "explore", label: "🚶 سأستكشف بنفسي" },
                ],
                duration: 12000,
            }),
            (actionId) => {
                dismissCurrentBubble();
                if (actionId === "ride") ngTrainRide(myClass).catch((e) => console.error(e));
            },
        );
    }
}

/** The ride itself: walk waypoint by waypoint, then hand the child to their classroom. */
export async function ngTrainRide(slug: NgClassroomSlug, driver?: NgTrainDriver): Promise<void> {
    const activeDriver = driver ?? ngTrainDriver;
    if (!activeDriver) return;
    if (riding) return;
    riding = true;

    let hoppedOff = false;
    const unsubscribe = activeDriver.onManualInput(() => {
        // The child wants to walk: hop off silently, no bubble spam.
        hoppedOff = true;
        riding = false;
        unsubscribe();
    });

    try {
        const path = NG_TRAIN_PATHS[slug];
        showBubble(gino("امسك بيد صديقك الخيالي وانطلقنا! 🚂", { duration: 4000 }));
        for (const [x, y] of path.waypoints) {
            if (hoppedOff) return;
            // eslint-disable-next-line no-await-in-loop
            const result = await activeDriver.walkToTile(x, y);
            if (result.cancelled || hoppedOff) return;
        }
        if (hoppedOff) return;
        const [dx, dy] = path.door;
        const arrived = await activeDriver.walkToTile(dx, dy);
        if (arrived.cancelled || hoppedOff) return;
        showBubble(gino(`وصلنا! هذا ${NG_CLASSROOM_LABELS[slug]} — يومًا سعيدًا يا بطل 💙`, { duration: 5000 }));
        await activeDriver.goRoom(ngTrainExitUrl(slug));
    } finally {
        // Single writer at a single point: the manual-input callback only ever
        // flips `riding` to false, never back, so this is race-free by design.
        // eslint-disable-next-line require-atomic-updates
        riding = false;
        unsubscribe();
    }
}

/* ------------------------------------------------------------------ *
 * Real-game adapter (thin; the logic above is what tests cover)
 * ------------------------------------------------------------------ */
let ngTrainDriver: NgTrainDriver | undefined;

export function ngTrainSetDriver(driver: NgTrainDriver | undefined): void {
    ngTrainDriver = driver;
}

/** Test hook. */
export function ngTrainResetForTests(): void {
    riding = false;
    lastOfferAt = 0;
}
