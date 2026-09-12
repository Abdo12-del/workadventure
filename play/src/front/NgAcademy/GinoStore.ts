/**
 * NG Academy — أكاديمية الجيل الجديد
 * The bubble engine behind Gino (the owl guide), the teachers and the
 * "you are here" location banner.
 *
 * Comfort rules (requirement: Gino must never be annoying):
 *  - exactly one bubble on screen at a time, the rest waits in a small queue;
 *  - explanations and teacher greetings appear ONCE per browser session;
 *  - every bubble auto-dismisses and can be dismissed by the child;
 *  - the location banner is throttled (never twice within a few seconds).
 */
import { writable } from "svelte/store";
import { toastStore } from "../Stores/ToastStoreSingleton";
import { GINO_PORTRAIT, NG_GINO_EXPLAIN, NG_LOCATION_PREFIX, NG_TEACHERS, NG_WELCOME_MESSAGE } from "./NgAcademyConfig";
import type { NgBubble } from "./NgBubble";
// Circular by design (the toast dismisses through this store): safe because both
// sides only use function declarations / props at runtime, never at module init.
import GinoToast from "./GinoToast.svelte";

const BUBBLE_TOAST_UUID = "ng-academy-bubble";
const SESSION_PREFIX = "ng-academy-seen:";
const QUEUE_MAX = 3;

/** Currently displayed bubble (null when Gino is resting). Read by tests/UI. */
export const ngCurrentBubble = writable<NgBubble | null>(null);

const queue: NgBubble[] = [];
let dismissTimer: ReturnType<typeof setTimeout> | undefined;
let lastLocationAt = 0;
let lastLocationLabel: string | undefined;

function markSeen(key: string): void {
    try {
        window.sessionStorage.setItem(SESSION_PREFIX + key, "1");
    } catch {
        /* private mode: simply skip persistence, the bubble still shows once per page load */
    }
}

function wasSeen(key: string): boolean {
    try {
        return window.sessionStorage.getItem(SESSION_PREFIX + key) === "1";
    } catch {
        return false;
    }
}

function display(bubble: NgBubble): void {
    ngCurrentBubble.set(bubble);
    toastStore.addToast(GinoToast, { bubble }, BUBBLE_TOAST_UUID);
    dismissTimer = setTimeout(() => dismissCurrentBubble(), bubble.duration);
}

/** Hides the current bubble and shows the next queued one, if any. */
export function dismissCurrentBubble(): void {
    if (dismissTimer !== undefined) {
        clearTimeout(dismissTimer);
        dismissTimer = undefined;
    }
    toastStore.removeToast(BUBBLE_TOAST_UUID);
    ngCurrentBubble.set(null);
    const next = queue.shift();
    if (next) {
        display(next);
    }
}

function enqueue(bubble: NgBubble): void {
    if (queue.length >= QUEUE_MAX) {
        return; // never pile up: dropping is kinder than nagging
    }
    queue.push(bubble);
}

/** Shows a bubble now, or queues it if Gino is already talking. */
export function showBubble(bubble: NgBubble): void {
    let busy = false;
    const unsubscribe = ngCurrentBubble.subscribe((current) => (busy = current !== null));
    unsubscribe();
    if (busy) {
        enqueue(bubble);
    } else {
        display(bubble);
    }
}

function ginoBubble(text: string, duration = 8000): NgBubble {
    return { kind: "gino", speaker: "جينو المرشد", text, portrait: GINO_PORTRAIT, duration };
}

/** Welcome whisper, once per session, a moment after the world loads. */
export function ngWelcome(): void {
    if (wasSeen("welcome")) {
        return;
    }
    markSeen("welcome");
    setTimeout(() => showBubble(ginoBubble(NG_WELCOME_MESSAGE, 10000)), 1500);
}

/** Later phases (activities/badges) call this to let Gino congratulate the child. */
export function ngCelebrate(text: string): void {
    showBubble(ginoBubble(text, 8000));
}

export interface NgEnteredArea {
    name: string;
    tooltip?: string;
}

/**
 * Called whenever the child enters new WAM areas. Decides, in priority order:
 * teacher greeting > Gino one-time explanation > location banner.
 */
export function ngHandleAreasEntered(areas: NgEnteredArea[]): void {
    let spoke = false;
    for (const area of areas) {
        const teacher = NG_TEACHERS[area.name];
        if (teacher && !wasSeen(`teacher:${area.name}`)) {
            markSeen(`teacher:${area.name}`);
            spoke = true;
            showBubble({
                kind: "teacher",
                speaker: teacher.name,
                role: teacher.role,
                text: teacher.greeting,
                portrait: teacher.portrait,
                duration: 9000,
            });
            continue;
        }
        const explain = NG_GINO_EXPLAIN[area.name];
        if (explain && !wasSeen(`explain:${area.name}`)) {
            markSeen(`explain:${area.name}`);
            spoke = true;
            showBubble(ginoBubble(explain));
            continue;
        }
    }

    // If Gino or a teacher already spoke about this place, the banner would be
    // redundant noise — the child just read a richer message.
    if (spoke) {
        return;
    }
    const label = areas.map((a) => a.tooltip).find((t) => t !== undefined && t.length > 0);
    if (label === undefined || label === lastLocationLabel) {
        return;
    }
    const now = Date.now();
    if (now - lastLocationAt < 3000) {
        return;
    }
    lastLocationAt = now;
    lastLocationLabel = label;
    showBubble({
        kind: "location",
        speaker: "",
        text: `${NG_LOCATION_PREFIX}: ${label}`,
        portrait: "",
        duration: 3500,
    });
}

/** Test hook: forgets session memory and empties the queue. */
export function ngResetForTests(): void {
    queue.length = 0;
    lastLocationAt = 0;
    lastLocationLabel = undefined;
    if (dismissTimer !== undefined) {
        clearTimeout(dismissTimer);
        dismissTimer = undefined;
    }
    try {
        window.sessionStorage.clear();
    } catch {
        /* ignore */
    }
}
