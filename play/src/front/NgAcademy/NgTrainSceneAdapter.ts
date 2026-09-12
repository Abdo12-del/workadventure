/**
 * NG Academy — أكاديمية الجيل الجديد
 * Thin adapter binding the Gino-train state machine to the real GameScene:
 * pathfinding-aware walking + room changes through the standard exit flow
 * (the very same code path as stepping on a door tile).
 */
import type { GameScene } from "../Phaser/Game/GameScene";
import { Room } from "../Connection/Room";
import type { NgTrainDriver } from "./NgTrain";

const TILE = 32;

export function ngTrainDriverFromScene(scene: GameScene): NgTrainDriver {
    return {
        walkToTile: (x, y) => scene.moveTo({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 }, true, undefined),
        goRoom: async (exitUrl) => {
            await scene.onMapExit(Room.getRoomPathFromExitUrl(exitUrl, window.location.toString()));
        },
        onManualInput: (cb) => {
            const key = (event: KeyboardEvent) => {
                if (event.key.startsWith("Arrow") || ["w", "a", "s", "d", "z", "q"].includes(event.key.toLowerCase())) {
                    cb();
                }
            };
            const pointer = (event: PointerEvent) => {
                // Only the game canvas counts as "I want to walk myself".
                if ((event.target as HTMLElement | null)?.tagName === "CANVAS") cb();
            };
            window.addEventListener("keydown", key);
            window.addEventListener("pointerdown", pointer);
            return () => {
                window.removeEventListener("keydown", key);
                window.removeEventListener("pointerdown", pointer);
            };
        },
    };
}
