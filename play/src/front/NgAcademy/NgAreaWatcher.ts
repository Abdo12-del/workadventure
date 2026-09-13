/**
 * NG Academy — أكاديمية الجيل الجديد
 * Bridges the WorkAdventure area system to the Gino/teacher bubble engine:
 * whenever the child walks into WAM areas, their names + Arabic tooltips are
 * forwarded to `ngHandleAreasEntered`.
 *
 * Initialised once per page load (module flag): re-entering rooms or reloading
 * maps never stacks duplicate watchers, and the welcome whisper respects the
 * once-per-session rule inside GinoStore.
 */
import type { AreaData } from "@workadventure/map-editor";
import { toastStore } from "../Stores/ToastStoreSingleton";
import { ngHandleAreasEntered, ngWelcome } from "./GinoStore";
import { NG_CLASS_PICKER_TOAST_UUID, ngLineOffer } from "./NgLine";
import { ngAchievementsStart } from "./NgAchievements";
import { NG_ABACUS_TOAST_UUID } from "./NgAbacus";
import NgClassPicker from "./NgClassPicker.svelte";
import NgAbacus from "./NgAbacus.svelte";

interface AreaEnterEmitter {
    onEnterArea: (callback: (changed: AreaData[], all: AreaData[]) => void) => void;
    /** Optional: the math classroom's abacus overlay closes when the child walks out. */
    onLeaveArea?: (callback: (changed: AreaData[], all: AreaData[]) => void) => void;
}

function openClassPicker(): void {
    toastStore.addToast(NgClassPicker, {}, NG_CLASS_PICKER_TOAST_UUID);
}

let abacusOpen = false;

/** The child's own abacus opens in the "abacus" corner of the math classroom. */
function openAbacus(): void {
    if (abacusOpen) return;
    abacusOpen = true;
    toastStore.addToast(NgAbacus, {}, NG_ABACUS_TOAST_UUID);
}

function closeAbacus(): void {
    if (!abacusOpen) return;
    abacusOpen = false;
    toastStore.removeToast(NG_ABACUS_TOAST_UUID);
}

function tooltipOf(area: AreaData): string | undefined {
    const tooltip = area.properties?.find((property) => property.type === "tooltipPropertyData");
    return tooltip && "content" in tooltip ? tooltip.content : undefined;
}

let initialized = false;

export function initNgAreaWatcher(emitter: AreaEnterEmitter): void {
    if (initialized) {
        return;
    }
    initialized = true;
    emitter.onEnterArea((_changed, all) => {
        const infos = all.map((area) => ({ name: area.name, tooltip: tooltipOf(area) }));
        ngHandleAreasEntered(infos);
        // Gino's line forms here (نقطة تجمع الصف).
        if (infos.some((info) => info.name === "gathering")) {
            ngLineOffer(openClassPicker);
        }
        // Math classroom: stepping into the abacus corner opens the child's own abacus.
        if (infos.some((info) => info.name === "abacus")) {
            openAbacus();
        }
    });
    emitter.onLeaveArea?.((_changed, all) => {
        // Leaving the corner puts the abacus away — it never follows the child.
        if (!all.some((area) => area.name === "abacus")) {
            closeAbacus();
        }
    });
    ngWelcome();
    // Phase 7: celebrate newly earned badges in-world (no-op unless NG_API_URL is set).
    ngAchievementsStart();
}

/** Test hook. */
export function ngResetWatcherForTests(): void {
    initialized = false;
    closeAbacus();
}
