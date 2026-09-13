<!--
    Admin/owner gate (owner decision): the standalone dashboards were retired.
    All management surfaces now live INSIDE the walkable world — the admin
    office area of the entrance hall. This page only hands the session to the
    world and explains where everything went.
-->
<script lang="ts">
    import { onMount } from "svelte";
    import { ngCurrentToken, portalApi } from "../lib/api";

    let worldUrl = $state("");
    let msg = $state("");
    let busy = $state(false);

    onMount(() => {
        portalApi
            .worldConfig()
            .then((config) => {
                worldUrl = config.worldUrl;
            })
            .catch(() => {
                msg = "تعذّر الوصول لإعدادات العالم.";
            });
    });

    function enterWorld(): void {
        const token = ngCurrentToken();
        if (!worldUrl) {
            msg = "رابط العالم غير مضبوط على الخادم (NG_WORLD_URL).";
            return;
        }
        if (!token) {
            msg = "جلستك غير موجودة — أعد الدخول.";
            return;
        }
        busy = true;
        window.open(`${worldUrl}/#ngToken=${encodeURIComponent(token)}`, "_blank");
        busy = false;
    }
</script>

<div class="ng-card" style="max-width: 640px; margin: 3rem auto; line-height: 2">
    <h1>الإدارة تعيش داخل العالم</h1>
    <p class="ng-muted">
        لا لوحة منفصلة بعد اليوم: عناصر الإدارة كلها (نظرة عامة، المستخدمون، الفصول
        والدورات، الأنشطة، مناطق العالم) صارت داخل مدرسة العالم — في
        <b>مكتب الإدارة</b> بقاعة المدخل. ادخل العالم بجلستك، ثم قف على بساط المكتب
        لتفتح اللوحات أمامك داخل الخريطة.
    </p>
    <p>
        <button type="button" class="ng-btn" onclick={enterWorld} disabled={busy}>
            🌍 ادخل العالم بصلاحيات الإدارة
        </button>
    </p>
    {#if msg}<p class="ng-msg err">{msg}</p>{/if}
    <p class="ng-muted" style="font-size: 13px">
        إن لم يكن العالم شغالًا عندك: نفّذ <code dir="ltr">npm run world:native</code>
        ثم أعد المحاولة (التفاصيل في docs/owner-quickstart-ar.md).
    </p>
</div>
