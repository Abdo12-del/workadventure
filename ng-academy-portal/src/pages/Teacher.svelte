<!--
    Teacher dashboard: their classes' rosters plus the encouragement tools —
    record attendance, hand out badges, complete activities and write notes to
    parents (requirements 6, 7, 9, 12).
-->
<script lang="ts">
    import { onMount } from "svelte";
    import { portalApi, type NgActivity, type NgClass } from "../lib/api";

    let classes = $state<NgClass[]>([]);
    let activities = $state<NgActivity[]>([]);
    let classId = $state("");
    let students = $state<{ id: string; name: string }[]>([]);
    let studentId = $state("");
    let loading = $state(false);
    let msg = $state<{ kind: "ok" | "err"; text: string } | null>(null);

    // forms
    let badgeName = $state("");
    let badgeReason = $state("");
    let noteText = $state("");
    let noteVisibility = $state<"parent" | "admin">("parent");
    let activityId = $state("");

    const studentName = $derived(students.find((s) => s.id === studentId)?.name ?? "");

    async function load(): Promise<void> {
        loading = true;
        try {
            const [cls, acts] = await Promise.all([portalApi.classes(), portalApi.activities()]);
            classes = cls.classes;
            activities = acts.activities;
            if (classes[0]) await selectClass(classes[0].id);
        } catch {
            msg = { kind: "err", text: "تعذّر تحميل الفصول." };
        } finally {
            loading = false;
        }
    }

    async function selectClass(id: string): Promise<void> {
        classId = id;
        studentId = "";
        msg = null;
        try {
            const roster = await portalApi.classStudents(id);
            students = roster.students;
        } catch {
            students = [];
            msg = { kind: "err", text: "تعذّر تحميل قائمة الطلاب." };
        }
    }

    function selectStudent(id: string): void {
        studentId = id;
        msg = null;
    }

    async function act(label: string, fn: () => Promise<unknown>): Promise<void> {
        if (!studentId) return;
        try {
            await fn();
            msg = { kind: "ok", text: `${label} لـ«${studentName}» تم ✅` };
        } catch {
            msg = { kind: "err", text: `تعذّر تنفيذ: ${label}.` };
        }
    }

    onMount(() => {
        load().catch(() => {});
    });
</script>

<h1>لوحة المعلم</h1>
{#if loading}<p class="ng-muted">جارٍ التحميل…</p>{/if}

<div class="ng-card">
    <h2>فصلي</h2>
    <div class="ng-child-picker">
        {#each classes as klass (klass.id)}
            <button type="button" class:active={classId === klass.id} onclick={() => selectClass(klass.id)}>
                {klass.name} ({klass.subject})
            </button>
        {/each}
    </div>
    {#if students.length}
        <table class="ng-table">
            <thead><tr><th>الطالب</th><th>الحضور</th><th>الأدوات</th></tr></thead>
            <tbody>
                {#each students as student (student.id)}
                    <tr>
                        <td>
                            <button
                                type="button"
                                class="ng-btn secondary"
                                class:active={studentId === student.id}
                                onclick={() => selectStudent(student.id)}>{student.name}</button
                            >
                        </td>
                        <td>
                            <button
                                type="button"
                                class="ng-btn secondary"
                                onclick={() => act("تسجيل الدخول", () => portalApi.recordAttendance(classId, student.id, "enter"))}
                                >دخول</button
                            >
                            <button
                                type="button"
                                class="ng-btn secondary"
                                onclick={() => act("تسجيل الخروج", () => portalApi.recordAttendance(classId, student.id, "exit"))}
                                >خروج</button
                            >
                            <button
                                type="button"
                                class="ng-btn secondary"
                                onclick={() =>
                                    act("تسجيل المشاركة", () => portalApi.recordAttendance(classId, student.id, "participation"))}
                                >مشاركة</button
                            >
                        </td>
                        <td class="ng-muted">{studentId === student.id ? "محدَّد للأسفل ⬇" : ""}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    {:else if classId}
        <p class="ng-muted">لا طلاب في هذا الفصل بعد — أضفهم من لوحة الإدارة.</p>
    {/if}
</div>

{#if studentId}
    <div class="ng-card">
        <h2>أدوات التشجيع — {studentName}</h2>

        <div class="ng-form">
            <div class="ng-field">
                <label for="t-badge">اسم الشارة</label>
                <input id="t-badge" bind:value={badgeName} placeholder="بطل المشاركة" />
            </div>
            <div class="ng-field">
                <label for="t-reason">السبب</label>
                <input id="t-reason" bind:value={badgeReason} placeholder="ساعد زملاءه اليوم" />
            </div>
            <button
                type="button"
                class="ng-btn"
                disabled={!badgeName}
                onclick={() => act("منح الشارة", () => portalApi.grantBadge(studentId, badgeName, badgeReason))}
                >امنح شارة 🏅</button
            >
        </div>

        <hr style="border: none; border-top: 1px solid var(--ng-line); margin: 0.9rem 0;" />

        <div class="ng-form">
            <div class="ng-field">
                <label for="t-activity">النشاط</label>
                <select id="t-activity" bind:value={activityId}>
                    <option value="">اختر نشاطًا…</option>
                    {#each activities as activity (activity.id)}
                        <option value={activity.id}>{activity.title} ({activity.points} نقطة)</option>
                    {/each}
                </select>
            </div>
            <button
                type="button"
                class="ng-btn"
                disabled={!activityId}
                onclick={() => act("إكمال النشاط", () => portalApi.completeActivity(activityId, studentId))}
                >سجّل إكمال النشاط</button
            >
        </div>

        <hr style="border: none; border-top: 1px solid var(--ng-line); margin: 0.9rem 0;" />

        <div class="ng-form">
            <div class="ng-field" style="grid-column: 1 / -1;">
                <label for="t-note">ملاحظة لولي الأمر</label>
                <textarea id="t-note" rows="2" bind:value={noteText}></textarea>
            </div>
            <div class="ng-field">
                <label for="t-vis">من يرى الملاحظة</label>
                <select id="t-vis" bind:value={noteVisibility}>
                    <option value="parent">ولي الأمر</option>
                    <option value="admin">الإدارة فقط</option>
                </select>
            </div>
            <button
                type="button"
                class="ng-btn"
                disabled={!noteText}
                onclick={() => act("إرسال الملاحظة", () => portalApi.addNote(studentId, noteText, noteVisibility))}
                >أرسل الملاحظة</button
            >
        </div>
    </div>
{/if}

{#if msg}<p class="ng-msg {msg.kind}">{msg.text}</p>{/if}
