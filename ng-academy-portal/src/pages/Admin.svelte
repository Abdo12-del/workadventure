<!--
    Admin dashboard (requirement 13): students/teachers/courses/classes,
    activities and world zones management, with an overview strip. Admin and
    owner only — enforced again server-side on every call.
-->
<script lang="ts">
    import { onMount } from "svelte";
    import {
        portalApi,
        type NgActivity,
        type NgAdminUser,
        type NgClass,
        type NgOverview,
        type NgRoom,
    } from "../lib/api";

    type Tab = "overview" | "users" | "classes" | "activities" | "rooms";
    let tab = $state<Tab>("overview");
    let msg = $state<{ kind: "ok" | "err"; text: string } | null>(null);
    let busy = $state(false);

    let overview = $state<NgOverview | null>(null);
    let users = $state<NgAdminUser[]>([]);
    let teachers = $state<NgAdminUser[]>([]);
    let parents = $state<NgAdminUser[]>([]);
    let classes = $state<NgClass[]>([]);
    let activities = $state<NgActivity[]>([]);
    let rooms = $state<NgRoom[]>([]);

    // user form
    let uEmail = $state("");
    let uRole = $state("student");
    let uName = $state("");
    let uParent = $state("");

    // class form
    let cName = $state("");
    let cSubject = $state("");
    let cTeacher = $state("");
    let cStudents = $state("");

    // activity form
    let aTitle = $state("");
    let aKind = $state<"daily" | "weekly" | "micro">("daily");
    let aPoints = $state(1);

    // room form
    let rName = $state("");
    let rWam = $state("");
    let rPurpose = $state("");

    const dateFmt = new Intl.DateTimeFormat("ar", { dateStyle: "short" });

    async function loadTab(next: Tab): Promise<void> {
        tab = next;
        msg = null;
        busy = true;
        try {
            if (next === "overview") overview = await portalApi.adminOverview();
            if (next === "users") {
                const [all, t, p] = await Promise.all([
                    portalApi.adminUsers(),
                    portalApi.adminUsers("teacher"),
                    portalApi.adminUsers("parent"),
                ]);
                users = all.users;
                teachers = t.users;
                parents = p.users;
            }
            if (next === "classes") classes = (await portalApi.classes()).classes;
            if (next === "activities") activities = (await portalApi.activities()).activities;
            if (next === "rooms") rooms = (await portalApi.adminRooms()).rooms;
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
        } catch (e) {
            const status = e instanceof Error && "status" in e ? (e as { status: number }).status : 0;
            msg = {
                kind: "err",
                text: status === 409 ? "البريد مستخدم بالفعل." : `تعذّر تنفيذ: ${label}.`,
            };
        } finally {
            busy = false;
        }
    }

    function studentIds(): string[] {
        return cStudents
            .split(/[\s,،]+/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
    }

    onMount(() => {
        loadTab("overview").catch(() => {});
    });
</script>

<h1>لوحة الإدارة</h1>

<div class="ng-tabs">
    {#each [
        ["overview", "نظرة عامة"],
        ["users", "المستخدمون"],
        ["classes", "الفصول والدورات"],
        ["activities", "الأنشطة"],
        ["rooms", "مناطق العالم"],
    ] as [id, label] (id)}
        <button type="button" class:active={tab === id} onclick={() => loadTab(id as Tab)}>{label}</button>
    {/each}
</div>

{#if busy}<p class="ng-muted">جارٍ التحميل…</p>{/if}
{#if msg}<p class="ng-msg {msg.kind}">{msg.text}</p>{/if}

{#if tab === "overview" && overview}
    <div class="ng-card">
        <div class="ng-grid">
            <div class="ng-stat"><b>{overview.students}</b><span>طالب</span></div>
            <div class="ng-stat"><b>{overview.teachers}</b><span>معلم</span></div>
            <div class="ng-stat"><b>{overview.classes}</b><span>فصل</span></div>
            <div class="ng-stat"><b>{overview.activities}</b><span>نشاط</span></div>
            <div class="ng-stat"><b>{overview.rooms}</b><span>منطقة</span></div>
        </div>
    </div>
{/if}

{#if tab === "users"}
    <div class="ng-card">
        <h2>إضافة مستخدم</h2>
        <div class="ng-form">
            <div class="ng-field">
                <label for="a-email">البريد</label>
                <input id="a-email" type="email" bind:value={uEmail} dir="ltr" />
            </div>
            <div class="ng-field">
                <label for="a-role">الدور</label>
                <select id="a-role" bind:value={uRole}>
                    <option value="student">طالب</option>
                    <option value="parent">ولي أمر</option>
                    <option value="teacher">معلم</option>
                    <option value="admin">إدارة</option>
                    <option value="owner">مالك</option>
                </select>
            </div>
            <div class="ng-field">
                <label for="a-name">الاسم المعروض</label>
                <input id="a-name" bind:value={uName} placeholder="اسم أول فقط — بلا بيانات شخصية" />
            </div>
            {#if uRole === "student"}
                <div class="ng-field">
                    <label for="a-parent">ولي الأمر</label>
                    <select id="a-parent" bind:value={uParent}>
                        <option value="">اختر ولي أمر…</option>
                        {#each parents as parent (parent.id)}
                            <option value={parent.id}>{parent.name} ({parent.email})</option>
                        {/each}
                    </select>
                </div>
            {/if}
            <button
                type="button"
                class="ng-btn"
                disabled={busy || !uEmail || !uName}
                onclick={() =>
                    run("إضافة المستخدم", () =>
                        portalApi.adminCreateUser({
                            email: uEmail.trim(),
                            role: uRole,
                            displayName: uName.trim(),
                            parentUserId: uRole === "student" && uParent ? uParent : undefined,
                        }),
                    )}
                >إضافة</button
            >
        </div>
        <p class="ng-muted">روابط الدخول السحرية تصل دائمًا لولي الأمر — حسابات الطلاب يدخلها ولي أمرهم فقط.</p>
    </div>

    <div class="ng-card">
        <h2>المستخدمون ({users.length})</h2>
        <table class="ng-table">
            <thead><tr><th>الاسم</th><th>الدور</th><th>البريد</th><th>أُنشئ</th></tr></thead>
            <tbody>
                {#each users as user (user.id)}
                    <tr>
                        <td>{user.name}</td>
                        <td>{user.role}</td>
                        <td dir="ltr">{user.email}</td>
                        <td>{dateFmt.format(new Date(user.createdAt))}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
{/if}

{#if tab === "classes"}
    <div class="ng-card">
        <h2>إنشاء فصل (دورة + معلم + طلاب)</h2>
        <div class="ng-form">
            <div class="ng-field">
                <label for="c-name">اسم الفصل</label>
                <input id="c-name" bind:value={cName} placeholder="فصل الشطرنج" />
            </div>
            <div class="ng-field">
                <label for="c-subject">المادة</label>
                <input id="c-subject" bind:value={cSubject} placeholder="chess" dir="ltr" />
            </div>
            <div class="ng-field">
                <label for="c-teacher">المعلم</label>
                <select id="c-teacher" bind:value={cTeacher}>
                    <option value="">بلا معلم…</option>
                    {#each teachers as teacher (teacher.id)}
                        <option value={teacher.id}>{teacher.name}</option>
                    {/each}
                </select>
            </div>
            <div class="ng-field">
                <label for="c-students">معرّفات الطلاب (مفصولة بفواصل)</label>
                <input id="c-students" bind:value={cStudents} dir="ltr" placeholder="u-1, u-2" />
            </div>
            <button
                type="button"
                class="ng-btn"
                disabled={busy || !cName || !cSubject}
                onclick={() =>
                    run("إنشاء الفصل", () =>
                        portalApi.adminCreateClass({
                            name: cName.trim(),
                            subject: cSubject.trim(),
                            teacherUserId: cTeacher || undefined,
                            studentUserIds: studentIds(),
                        }),
                    )}
                >إنشاء</button
            >
        </div>
    </div>

    <div class="ng-card">
        <h2>الفصول ({classes.length})</h2>
        <table class="ng-table">
            <thead><tr><th>الفصل</th><th>المادة</th><th>غرفة الدرس</th></tr></thead>
            <tbody>
                {#each classes as klass (klass.id)}
                    <tr>
                        <td>{klass.name}</td>
                        <td>{klass.subject}</td>
                        <td dir="ltr">{klass.livekitRoom}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
{/if}

{#if tab === "activities"}
    <div class="ng-card">
        <h2>نشاط جديد</h2>
        <div class="ng-form">
            <div class="ng-field">
                <label for="a-title">العنوان</label>
                <input id="a-title" bind:value={aTitle} placeholder="تحدي الأسبوع: علم" />
            </div>
            <div class="ng-field">
                <label for="a-kind">النوع</label>
                <select id="a-kind" bind:value={aKind}>
                    <option value="daily">يومي</option>
                    <option value="weekly">أسبوعي</option>
                    <option value="micro">مصغّر</option>
                </select>
            </div>
            <div class="ng-field">
                <label for="a-points">النقاط</label>
                <input id="a-points" type="number" min="1" max="100" bind:value={aPoints} />
            </div>
            <button
                type="button"
                class="ng-btn"
                disabled={busy || !aTitle}
                onclick={() => run("إضافة النشاط", () => portalApi.adminCreateActivity({ title: aTitle.trim(), kind: aKind, points: aPoints }))}
                >إضافة</button
            >
        </div>
    </div>

    <div class="ng-card">
        <h2>الأنشطة ({activities.length})</h2>
        <table class="ng-table">
            <thead><tr><th>العنوان</th><th>النوع</th><th>النقاط</th></tr></thead>
            <tbody>
                {#each activities as activity (activity.id)}
                    <tr><td>{activity.title}</td><td>{activity.kind}</td><td>{activity.points}</td></tr>
                {/each}
            </tbody>
        </table>
    </div>
{/if}

{#if tab === "rooms"}
    <div class="ng-card">
        <h2>منطقة جديدة في العالم</h2>
        <div class="ng-form">
            <div class="ng-field">
                <label for="r-name">الاسم</label>
                <input id="r-name" bind:value={rName} placeholder="المكتبة" />
            </div>
            <div class="ng-field">
                <label for="r-wam">رابط خريطة WAM</label>
                <input id="r-wam" bind:value={rWam} dir="ltr" placeholder="http://maps…/library.wam" />
            </div>
            <div class="ng-field">
                <label for="r-purpose">الغرض</label>
                <input id="r-purpose" bind:value={rPurpose} placeholder="قراءة صامتة" />
            </div>
            <button
                type="button"
                class="ng-btn"
                disabled={busy || !rName || !rWam}
                onclick={() => run("إضافة المنطقة", () => portalApi.adminCreateRoom({ name: rName.trim(), wamUrl: rWam.trim(), purpose: rPurpose.trim() }))}
                >إضافة</button
            >
        </div>
    </div>

    <div class="ng-card">
        <h2>مناطق العالم ({rooms.length})</h2>
        <table class="ng-table">
            <thead><tr><th>الاسم</th><th>الخريطة</th><th>الغرض</th></tr></thead>
            <tbody>
                {#each rooms as room (room.id)}
                    <tr>
                        <td>{room.name}</td>
                        <td dir="ltr">{room.wamUrl}</td>
                        <td>{room.purpose || "—"}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
{/if}
