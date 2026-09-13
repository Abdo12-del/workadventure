import { expect, test } from "@playwright/test";
import { evaluateScript } from "./utils/scripting";
import { publicTestMapUrl } from "./utils/urls";
import { getPage } from "./utils/auth";
import { isMobileViewport } from "./utils/isMobile";

/**
 * NG Academy — أكاديمية الجيل الجديد
 * Phase 10: the full child journey on the real stack (requirement 18):
 *   login → the school world loads → Gino welcomes (once) → the child steps on
 *   the gathering carpet → Gino offers the line → the class picker opens →
 *   the child picks "math" → walks in line behind Gino → is handed over at the
 *   classroom door exactly like stepping on it.
 *
 * Requires the compose stack with the NG maps served by the maps container
 * (NG_MAPS_BASE_URL=http://maps.workadventure.localhost/ng-academy) — the same
 * stack the other E2E specs run against.
 */
test.describe("NG Academy child journey", () => {
    test.beforeEach(async ({ viewport }) => {
        test.skip(isMobileViewport(viewport), "Journey spec runs on desktop viewports");
    });

    test("login → Gino → gathering carpet → class picker → the line → classroom door", async ({ browser }) => {
        test.setTimeout(240_000);

        await using page = await getPage(browser, "Alice", publicTestMapUrl("ng-academy/entrance.wam", "ng-journey"));

        await evaluateScript(page, async () => {
            await WA.onInit();
            return;
        });

        // 1) Gino's one-time welcome whisper appears shortly after the world loads.
        const welcome = page.getByText("مرحبًا بك في أكاديمية الجيل الجديد");
        await expect(welcome).toBeVisible({ timeout: 20_000 });
        // Wait for it to fade so the gathering offer is not suppressed by an active bubble.
        await expect(welcome).toBeHidden({ timeout: 30_000 });

        // 2) Step onto the gathering carpet (tile 12,22 → px 400,720).
        await evaluateScript(page, async () => {
            await WA.player.teleport(400, 720);
            return;
        });

        // 3) Gino offers the line; no class saved yet → the picker button shows.
        const pickButton = page.getByText("🏫 أين فصلي؟");
        await expect(pickButton).toBeVisible({ timeout: 20_000 });
        await pickButton.click();

        // 4) The big-button class picker opens; choose math.
        await expect(page.getByText("🏫 أين فصلك يا بطل؟")).toBeVisible({ timeout: 10_000 });
        await page.getByText("🔢 فصل الرياضيات").click();

        // 5) The line walks: Gino's marker leads, the child follows the same path.
        await expect(page.getByText("امشِ وراء صديقك الذي أمامك")).toBeVisible({ timeout: 15_000 });

        // 6) Hand-over at the door: the world changes to the math classroom,
        //    through the standard exit flow (URL is the classroom map).
        await page.waitForURL(/classroom-math\.wam/, { timeout: 120_000 });

        // 7) Arrival celebration inside the classroom.
        await expect(page.getByText("وصل صفّنا")).toBeVisible({ timeout: 20_000 });
    });

    test("a saved class turns the offer into a one-tap join", async ({ browser }) => {
        test.setTimeout(240_000);

        await using page = await getPage(browser, "Alice", publicTestMapUrl("ng-academy/entrance.wam", "ng-journey2"));

        // The child (or a previous visit on this device) already chose a class.
        await page.evaluate(() => window.localStorage.setItem("ng-academy-my-class", "chess"));

        await evaluateScript(page, async () => {
            await WA.onInit();
            return;
        });

        // Let the welcome fade, then step on the carpet.
        const welcome = page.getByText("مرحبًا بك في أكاديمية الجيل الجديد");
        await expect(welcome).toBeVisible({ timeout: 20_000 });
        await expect(welcome).toBeHidden({ timeout: 30_000 });

        await evaluateScript(page, async () => {
            await WA.player.teleport(400, 720);
            return;
        });

        const joinButton = page.getByText("🚶 أنضم إلى الصف");
        await expect(joinButton).toBeVisible({ timeout: 20_000 });
        await joinButton.click();

        // Chess door: left wall (tile 2,6) — the line ends in the chess classroom.
        await page.waitForURL(/classroom-chess\.wam/, { timeout: 120_000 });
    });

    test("taking over the controls steps the child out of the line silently", async ({ browser }) => {
        test.setTimeout(240_000);

        await using page = await getPage(browser, "Alice", publicTestMapUrl("ng-academy/entrance.wam", "ng-journey3"));
        await page.evaluate(() => window.localStorage.setItem("ng-academy-my-class", "math"));

        await evaluateScript(page, async () => {
            await WA.onInit();
            return;
        });

        const welcome = page.getByText("مرحبًا بك في أكاديمية الجيل الجديد");
        await expect(welcome).toBeVisible({ timeout: 20_000 });
        await expect(welcome).toBeHidden({ timeout: 30_000 });

        await evaluateScript(page, async () => {
            await WA.player.teleport(400, 720);
            return;
        });
        await page.getByText("🚶 أنضم إلى الصف").click();
        await expect(page.getByText("امشِ وراء صديقك الذي أمامك")).toBeVisible({ timeout: 15_000 });

        // The child changes their mind and walks by themselves.
        await page.keyboard.press("ArrowRight");
        await page.keyboard.press("ArrowDown");

        // The step-out is permanent by design: the line can no longer drag them
        // anywhere, so the child is still on the entrance map (requirement: no
        // forced teleport, ever).
        const roomId = await evaluateScript(page, async () => {
            await WA.onInit();
            return WA.room.id;
        });
        expect(String(roomId)).toContain("entrance");
        expect(page.url()).not.toMatch(/classroom-math\.wam/);
    });
});
