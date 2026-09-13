<!--
    Login by magic link (owner decision): the link always goes to the adult's
    email — parents, teachers, admins. Children never handle credentials; the
    parent opens the child's world session from the parent dashboard.
-->
<script lang="ts">
    import { onMount } from "svelte";
    import { NgApiError, portalApi } from "../lib/api";
    import { ngHomeRouteFor, ngLoginWithToken } from "../lib/auth";
    import { ngNavigate } from "../lib/router";

    let email = $state("");
    let linkToken = $state("");
    let sent = $state(false);
    let busy = $state(false);
    let error = $state("");
    let info = $state("");
    let demo = $state(false);

    async function verify(token: string): Promise<void> {
        busy = true;
        error = "";
        try {
            const result = await portalApi.verifyMagicLink(token.trim());
            const me = await ngLoginWithToken(result.token);
            ngNavigate(ngHomeRouteFor(me.role));
        } catch (e) {
            error =
                e instanceof NgApiError && e.status === 401
                    ? "الرابط منتهٍ أو مستخدم من قبل. اطلب رابطًا جديدًا."
                    : "تعذّر إتمام الدخول، حاول مجددًا.";
        } finally {
            busy = false;
        }
    }

    async function requestLink(): Promise<void> {
        busy = true;
        error = "";
        info = "";
        try {
            await portalApi.requestMagicLink(email.trim());
            sent = true;
            info = "إن كان البريد مسجلًا فسيصله رابط الدخول خلال دقائق.";
        } catch {
            error = "يرجى إدخال بريد إلكتروني صالح.";
        } finally {
            busy = false;
        }
    }

    async function demoLogin(role: "parent" | "teacher" | "admin" | "owner"): Promise<void> {
        busy = true;
        error = "";
        try {
            const response = await fetch("/ng/dev/magic-link", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role }),
            });
            if (!response.ok) throw new Error("demo unavailable");
            const { token } = (await response.json()) as { token: string };
            await verify(token);
        } catch {
            error = "وضع العرض غير متاح هنا.";
        } finally {
            busy = false;
        }
    }

    onMount(() => {
        // Demo back door (devServer only): its mere presence unlocks the
        // one-click buttons below; production never registers the route.
        fetch("/ng/dev/magic-link")
            .then((r) => {
                demo = r.ok;
            })
            .catch(() => {});

        // The magic-link email lands here with #/login?token=… (hash query —
        // the token never touches server logs). Consume it immediately.
        const hashQuery = window.location.hash.split("?")[1] ?? "";
        const token =
            new URLSearchParams(hashQuery).get("token") ?? new URLSearchParams(window.location.search).get("token");
        if (token) {
            linkToken = token;
            verify(token).catch(() => {});
        }
    });
</script>

<div class="ng-card" style="max-width: 520px; margin: 3rem auto;">
    <h2>تسجيل الدخول</h2>
    <p class="ng-muted">
        الدخول عبر رابط سحري يصل إلى بريد ولي الأمر أو المعلم أو الإدارة. لا يستخدم الأطفال
        البريد أو كلمات المرور إطلاقًا.
    </p>

    <div class="ng-field">
        <label for="ng-email">البريد الإلكتروني</label>
        <input id="ng-email" type="email" bind:value={email} placeholder="parent@example.com" dir="ltr" />
    </div>
    <p>
        <button type="button" class="ng-btn" onclick={requestLink} disabled={busy || !email}>
            أرسل رابط الدخول
        </button>
    </p>

    {#if info}<p class="ng-msg ok">{info}</p>{/if}
    {#if error}<p class="ng-msg err">{error}</p>{/if}

    {#if demo}
        <hr style="border: none; border-top: 1px solid var(--ng-line);" />
        <p class="ng-muted">وضع العرض (بيئة البناء): دخول فوري بلا بريد ولا رموز.</p>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            <button type="button" class="ng-btn" onclick={() => demoLogin("owner")} disabled={busy}>
                دخول فوري — المالك
            </button>
            <button type="button" class="ng-btn" onclick={() => demoLogin("parent")} disabled={busy}>
                ولي أمر
            </button>
            <button type="button" class="ng-btn" onclick={() => demoLogin("teacher")} disabled={busy}>
                أستاذة
            </button>
            <button type="button" class="ng-btn" onclick={() => demoLogin("admin")} disabled={busy}>
                إدارة
            </button>
        </div>
    {/if}

    {#if sent}
        <hr style="border: none; border-top: 1px solid var(--ng-line);" />
        <div class="ng-field">
            <label for="ng-token">أو الصق الرمز من الرابط هنا</label>
            <input id="ng-token" type="text" bind:value={linkToken} dir="ltr" />
        </div>
        <p>
            <button type="button" class="ng-btn" onclick={() => verify(linkToken)} disabled={busy || !linkToken}>
                تحقّق وادخل
            </button>
        </p>
    {/if}
</div>

<div class="ng-card" style="max-width: 520px; margin: 1rem auto 3rem;">
    <details>
        <summary style="cursor: pointer; font-weight: 700;">أين العالم الماشي (مدرسة الطفل)؟</summary>
        <p class="ng-muted" style="margin-top: 0.5rem; line-height: 1.9">
            هذه البوابة هي طرف الكبار: لوحات الإدارة وولي الأمر والمعلم. العالم الذي يمشي فيه
            الطفل تطبيق مستقل (محرك WorkAdventure) يعمل من حزمة الخوادم: نفّذ
            <code dir="ltr">docker compose up -d</code>
            ثم افتح
            <a dir="ltr" href="http://play.workadventure.localhost">play.workadventure.localhost</a>
            في المتصفح. الخطوات كاملة مع سطر hosts واستكشاف الأخطاء في
            <code dir="ltr">docs/owner-quickstart-ar.md</code>.
        </p>
    </details>
</div>
