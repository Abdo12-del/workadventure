<!--
    Parent dashboard (requirement 12): their own children only — attendance,
    badges, progress, teacher notes, classes and schedules. Traditional tables,
    no world entry, no other family's data, no rankings.
-->
<script lang="ts">
    import { onMount } from "svelte";
    import {
        portalApi,
        type NgAchievement,
        type NgAttendance,
        type NgClass,
        type NgNote,
        type NgProgress,
        type NgSchedule,
    } from "../lib/api";
    import { ngMe } from "../lib/auth";

    let childId = $state("");
    let attendance = $state<NgAttendance[]>([]);
    let achievements = $state<NgAchievement[]>([]);
    let progress = $state<NgProgress[]>([]);
    let notes = $state<NgNote[]>([]);
    let classes = $state<NgClass[]>([]);
    let schedules = $state<NgSchedule[]>([]);
    let loading = $state(false);
    let error = $state("");

    const children = $derived($ngMe?.children ?? []);
    const points = $derived(progress.find((p) => p.metric === "points")?.value ?? 0);
    const className = (id: string): string => classes.find((c) => c.id === id)?.name ?? id;

    const dateFmt = new Intl.DateTimeFormat("ar", { dateStyle: "short", timeStyle: "short" });
    const fmt = (iso: string): string => dateFmt.format(new Date(iso));
    const kindLabel: Record<string, string> = {
        enter: "دخول",
        exit: "خروج",
        participation: "مشاركة",
    };

    async function selectChild(id: string): Promise<void> {
        childId = id;
        loading = true;
        error = "";
        try {
            const [att, ach, prg, nts, cls] = await Promise.all([
                portalApi.attendance(id),
                portalApi.achievements(id),
                portalApi.progress(id),
                portalApi.notes(id),
                portalApi.classes(),
            ]);
            attendance = att.attendance.slice(-12).reverse();
            achievements = ach.achievements;
            progress = prg.progress;
            notes = nts.notes;
            classes = cls.classes;
            schedules = cls.schedules;
        } catch {
            error = "تعذّر تحميل بيانات الطفل. حاول مجددًا.";
        } finally {
            loading = false;
        }
    }

    onMount(() => {
        const first = children[0];
        if (first) selectChild(first.id).catch(() => {});
    });
</script>

<h1>متابعة أطفالي</h1>

{#if children.length === 0}
    <div class="ng-card"><p class="ng-muted">لا يوجد أطفال مرتبطون بحسابك بعد. تواصل مع إدارة الأكاديمية.</p></div>
{/if}

<div class="ng-child-picker">
    {#each children as child (child.id)}
        <button type="button" class:active={childId === child.id} onclick={() => selectChild(child.id)}>
            {child.name}
        </button>
    {/each}
</div>

{#if error}<div class="ng-card"><p class="ng-msg err">{error}</p></div>{/if}
{#if loading}<p class="ng-muted">جارٍ التحميل…</p>{/if}

{#if childId}
    <div class="ng-card">
        <h2>لمحة سريعة</h2>
        <div class="ng-grid">
            <div class="ng-stat"><b>{points}</b><span>نقاط التشجيع</span></div>
            <div class="ng-stat"><b>{achievements.length}</b><span>الشارات</span></div>
            <div class="ng-stat"><b>{attendance.length}</b><span>سجلات الحضور الأخيرة</span></div>
            <div class="ng-stat"><b>{notes.length}</b><span>ملاحظات المعلم</span></div>
        </div>
    </div>

    <div class="ng-card">
        <h2>الشارات والإنجازات</h2>
        {#if achievements.length === 0}
            <p class="ng-muted">لا شارات بعد — كل بداية خطوة 💙</p>
        {:else}
            <table class="ng-table">
                <thead><tr><th>الشارة</th><th>السبب</th><th>التاريخ</th></tr></thead>
                <tbody>
                    {#each achievements as a (a.id)}
                        <tr><td>{a.badgeName}</td><td>{a.reason || "—"}</td><td>{fmt(a.at)}</td></tr>
                    {/each}
                </tbody>
            </table>
        {/if}
    </div>

    <div class="ng-card">
        <h2>الحضور (آخر {attendance.length})</h2>
        {#if attendance.length === 0}
            <p class="ng-muted">لا سجلات بعد.</p>
        {:else}
            <table class="ng-table">
                <thead><tr><th>الفصل</th><th>النوع</th><th>الوقت</th></tr></thead>
                <tbody>
                    {#each attendance as row (row.id)}
                        <tr>
                            <td>{className(row.classId)}</td>
                            <td>{kindLabel[row.kind] ?? row.kind}</td>
                            <td>{fmt(row.at)}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        {/if}
        <p class="ng-muted">يُسجَّل الحضور تلقائيًا وبهدوء أثناء وجود طفلك في الفصل الافتراضي.</p>
    </div>

    <div class="ng-card">
        <h2>ملاحظات المعلمين</h2>
        {#if notes.length === 0}
            <p class="ng-muted">لا ملاحظات بعد.</p>
        {:else}
            {#each notes as note (note.id)}
                <p>• {note.note} <span class="ng-muted">— {fmt(note.at)}</span></p>
            {/each}
        {/if}
    </div>

    <div class="ng-card">
        <h2>الفصول والمواعيد</h2>
        {#if classes.length === 0}
            <p class="ng-muted">لا فصول مرتبطة.</p>
        {:else}
            <table class="ng-table">
                <thead><tr><th>الفصل</th><th>المادة</th><th>الموعد القادم</th></tr></thead>
                <tbody>
                    {#each classes as klass (klass.id)}
                        {@const next = schedules
                            .filter((s) => s.classId === klass.id)
                            .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]}
                        <tr>
                            <td>{klass.name}</td>
                            <td>{klass.subject}</td>
                            <td>{next ? fmt(next.startsAt) : "—"}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        {/if}
    </div>
{/if}
