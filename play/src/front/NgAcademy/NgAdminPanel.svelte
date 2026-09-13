<!--
    NG Academy — أكاديمية الجيل الجديد
    The admin office, INSIDE the world: the owner/admin stands in the
    "ng-admin-office" area of the entrance hall and the whole management
    surface opens here (overview, users, classes, activities, world zones).
    The standalone portal dashboard was retired by owner decision: the map
    is the interface. Every call is re-authorised server-side (admin/owner).
-->
<script lang="ts">
    import { onMount } from "svelte";
    import {
        ngAdminApi,
        type NgActivity,
        type NgAdminUser,
        type NgClass,
        type NgOverview,
        type NgRoom,
    } from "./NgAdminApi";
    import { ngIdentity } from "./NgSession";

    export let onClose: () => void = () => {};

    type Tab = "overview" | "users" | "classes" | "activities" | "rooms";
    let tab = $state<Tab>("overview");
    let msg = $state<{ kind: "ok" | "err"; text: string } | null>(null);
    let busy = $state(false);

    let overview = $state<NgOverview | null>(null);
    let users = $state<NgAdminUser[]>([]);
    let classes = $state<NgClass[]>([]);
    let activities = $state<NgActivity[]>([]);
    let rooms = $state<NgRoom[]>([]);

    let uEmail = $state("");
    let uRole = $state("student");
    let uName = $state("");
    let cName = $state("");
    let cSubject = $state("");
    let aTitle = $state("");
    let aKind = $state("daily");
    let aPoints = $state(1);
    let rName = $state("");
    let rWam = $state("");
    let rPurpose = $state("");

    async function loadTab(next: Tab): Promise<void> {
        tab = next;
        msg = null;
        busy = true;
        try {
            if (next === "overview") overview = await ngAdminApi.overview();
            if (next === "users") users = (await ngAdminApi.users()).users;
            if (next === "classes") classes = (await ngAdminApi.classes()).classes;
            if (next === "activities") activities = (await ngAdminApi.activities()).activities;
            if (next === "rooms") rooms = (await ngAdminApi.rooms()).rooms;
        } catch {
            msg = { kind: "err", text: "تعذّر تحميل البيانات." };
        } finally {
            busy = false;
        }
    }

    async function run(label: string, fn: () => Promise<unknown>): Promise<void> {
        busy = true;
        try {
            await fn();
            msg = { kind: "ok", text: `${label} تم ✅` };
            await loadTab(tab);
        } catch {
            msg = { kind: "err", text: `تعذّر تنفيذ: ${label}.` };
        } finally {
            busy = false;
        }
    }

    onMount(() => {
        loadTab("overview").catch(() => {});
    });
</script>

<div class="ng-admin-root" dir="rtl">
    <div class="ng-admin-panel">
        <header>
            <div>
                <h2>مكتب الإدارة داخل العالم</h2>
                <p class="who">
                    {#await ngIdentity then identity}
                        جلسة: {identity?.name ?? "…"} ({identity?.role ?? "—"})
                    {/await}
                </p>
            </div>
            <button type="button" class="close" onclick={() => onClose()}>✖ إغلاق</button>
        </header>

        <nav>
            {#each [
                ["overview", "نظرة عامة"],
                ["users", "المستخدمون"],
                ["classes", "الفصول والدورات"],
                ["activities", "الأنشطة"],
                ["rooms", "مناطق العالم"],
            ] as [id, label] (id)}
                <button type="button" class:active={tab === id} onclick={() => loadTab(id as Tab)}>{label}</button>
            {/each}
        </nav>

        {#if msg}<p class="msg" class:err={msg.kind === "err"}>{msg.text}</p>{/if}
        {#if busy}<p class="msg">… تحميل</p>{/if}

        <div class="body">
            {#if tab === "overview" && overview}
                <div class="cards">
                    <div><b>{overview.students}</b><span>طلاب</span></div>
                    <div><b>{overview.teachers}</b><span>معلمون</span></div>
                    <div><b>{overview.parents}</b><span>أولياء</span></div>
                    <div><b>{overview.classes}</b><span>فصول</span></div>
                    <div><b>{overview.rooms}</b><span>مناطق</span></div>
                    <div><b>{overview.activities}</b><span>أنشطة</span></div>
                </div>
            {/if}

            {#if tab === "users"}
                <table>
                    <thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th></tr></thead>
                    <tbody>
                        {#each users as user (user.id)}
                            <tr><td>{user.name}</td><td dir="ltr">{user.email}</td><td>{user.role}</td></tr>
                        {/each}
                    </tbody>
                </table>
                <div class="form">
                    <input placeholder="الاسم" bind:value={uName} />
                    <input placeholder="البريد" dir="ltr" bind:value={uEmail} />
                    <select bind:value={uRole}>
                        <option value="student">طالب</option>
                        <option value="teacher">معلم</option>
                        <option value="parent">ولي أمر</option>
                        <option value="admin">إدارة</option>
                    </select>
                    <button
                        type="button"
                        onclick={() => run("إضافة مستخدم", () => ngAdminApi.createUser({ email: uEmail.trim(), role: uRole, displayName: uName.trim() }))}
                        >إضافة</button
                    >
                </div>
            {/if}

            {#if tab === "classes"}
                <table>
                    <thead><tr><th>الفصل</th><th>المادة</th><th>الطلاب</th></tr></thead>
                    <tbody>
                        {#each classes as klass (klass.id)}
                            <tr><td>{klass.name}</td><td>{klass.subject}</td><td>{klass.students?.length ?? 0}</td></tr>
                        {/each}
                    </tbody>
                </table>
                <div class="form">
                    <input placeholder="اسم الفصل" bind:value={cName} />
                    <input placeholder="المادة" bind:value={cSubject} />
                    <button
                        type="button"
                        onclick={() => run("إنشاء فصل", () => ngAdminApi.createClass({ name: cName.trim(), subject: cSubject.trim() }))}
                        >إنشاء</button
                    >
                </div>
            {/if}

            {#if tab === "activities"}
                <table>
                    <thead><tr><th>النشاط</th><th>النوع</th><th>النقاط</th></tr></thead>
                    <tbody>
                        {#each activities as activity (activity.id)}
                            <tr><td>{activity.title}</td><td>{activity.kind}</td><td>{activity.points}</td></tr>
                        {/each}
                    </tbody>
                </table>
                <div class="form">
                    <input placeholder="عنوان النشاط" bind:value={aTitle} />
                    <select bind:value={aKind}>
                        <option value="daily">يومي</option>
                        <option value="weekly">أسبوعي</option>
                        <option value="micro">مصغّر</option>
                    </select>
                    <input type="number" min="1" bind:value={aPoints} />
                    <button
                        type="button"
                        onclick={() => run("إضافة نشاط", () => ngAdminApi.createActivity({ title: aTitle.trim(), kind: aKind, points: aPoints }))}
                        >إضافة</button
                    >
                </div>
            {/if}

            {#if tab === "rooms"}
                <table>
                    <thead><tr><th>المنطقة</th><th>الخريطة</th><th>الغرض</th></tr></thead>
                    <tbody>
                        {#each rooms as room (room.id)}
                            <tr><td>{room.name}</td><td dir="ltr">{room.wamUrl}</td><td>{room.purpose}</td></tr>
                        {/each}
                    </tbody>
                </table>
                <div class="form">
                    <input placeholder="الاسم" bind:value={rName} />
                    <input placeholder="رابط خريطة WAM" dir="ltr" bind:value={rWam} />
                    <input placeholder="الغرض" bind:value={rPurpose} />
                    <button
                        type="button"
                        onclick={() => run("إضافة منطقة", () => ngAdminApi.createRoom({ name: rName.trim(), wamUrl: rWam.trim(), purpose: rPurpose.trim() }))}
                        >إضافة</button
                    >
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    .ng-admin-root {
        position: fixed;
        inset: 0;
        z-index: 60;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgb(0 0 0 / 45%);
        font-family: system-ui, sans-serif;
    }
    .ng-admin-panel {
        width: min(880px, 94vw);
        max-height: 88vh;
        overflow: auto;
        background: #f4fbff;
        color: #06324a;
        border-radius: 18px;
        padding: 18px 20px 26px;
        box-shadow: 0 18px 60px rgb(0 0 0 / 35%);
    }
    header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
    }
    h2 {
        margin: 0;
        font-size: 22px;
    }
    .who {
        margin: 4px 0 0;
        font-size: 13px;
        opacity: 0.75;
    }
    .close {
        border: 0;
        background: #0b4a6f;
        color: #fff;
        border-radius: 10px;
        padding: 8px 12px;
        cursor: pointer;
    }
    nav {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 14px 0;
    }
    nav button {
        border: 1px solid #0b4a6f33;
        background: #fff;
        color: #06324a;
        border-radius: 999px;
        padding: 7px 14px;
        cursor: pointer;
    }
    nav button.active {
        background: #0b4a6f;
        color: #fff;
    }
    .msg {
        font-size: 14px;
    }
    .msg.err {
        color: #a12626;
    }
    .cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
        gap: 10px;
    }
    .cards div {
        background: #fff;
        border-radius: 12px;
        padding: 12px;
        text-align: center;
    }
    .cards b {
        display: block;
        font-size: 24px;
    }
    table {
        width: 100%;
        border-collapse: collapse;
        background: #fff;
        border-radius: 12px;
        overflow: hidden;
        font-size: 14px;
    }
    th,
    td {
        padding: 8px 10px;
        border-bottom: 1px solid #0b4a6f1a;
        text-align: right;
    }
    .form {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
    }
    .form input,
    .form select {
        border: 1px solid #0b4a6f33;
        border-radius: 10px;
        padding: 8px 10px;
        font-size: 14px;
    }
    .form button {
        border: 0;
        background: #0b4a6f;
        color: #fff;
        border-radius: 10px;
        padding: 8px 16px;
        cursor: pointer;
    }
</style>
