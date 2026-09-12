/**
 * NG Academy — أكاديمية الجيل الجديد
 * Thin adapter binding the Gino-line state machine to the real GameScene:
 * pathfinding-aware walking, room changes through the standard exit flow (the
 * very same code path as stepping on a door tile), and Gino's leading marker
 * as a small DOM owl floating a couple of tiles ahead on the path.
 */
import type { GameScene } from "../Phaser/Game/GameScene";
import { Room } from "../Connection/Room";
import type { NgLineDriver } from "./NgLine";

const TILE = 32;

export function ngLineDriverFromScene(scene: GameScene): NgLineDriver {
    let marker: Phaser.GameObjects.DOMElement | undefined;

    const hideLeader = () => {
        if (marker) {
            marker.destroy();
            marker = undefined;
        }
    };

    return {
        walkToTile: (x, y) => scene.moveTo({ x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 }, true, undefined),
        goRoom: async (exitUrl) => {
            hideLeader();
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
        showLeader: (position) => {
            if (!position) {
                hideLeader();
                return;
            }
            const px = position.x * TILE;
            const py = position.y * TILE;
            if (!marker) {
                marker = scene.add.dom(px, py, "img", {
                    src: "/static/images/ng/gino.png",
                    alt: "جينو",
                });
                const element = marker.node as HTMLElement | undefined;
                if (element) {
                    element.style.width = "44px";
                    element.style.height = "44px";
                    element.style.objectFit = "cover";
                    element.style.borderRadius = "50%";
                    element.style.border = "2px solid #38b6ff";
                    element.style.pointerEvents = "none";
                    element.style.opacity = "0.95";
                }
            } else {
                marker.setPosition(px, py);
            }
        },
    };
}
