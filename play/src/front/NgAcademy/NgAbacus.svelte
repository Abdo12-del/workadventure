<script lang="ts">
    /**
     * NG Academy — أكاديمية الجيل الجديد
     * «معدادي» — the per-student abacus of the math classroom. Opens when the
     * child stands in the abacus corner (see NgAreaWatcher) and closes when
     * they leave it or tap "انتهيت". Beads persist on the device; challenges
     * stay below 1000 and every success is celebrated by Gino — encouraging,
     * never competitive.
     */
    import { fly } from "svelte/transition";
    import { toastStore } from "../Stores/ToastStoreSingleton";
    import { ngCelebrate } from "./GinoStore";
    import {
        NG_ABACUS_ROD_LABELS,
        NG_ABACUS_TOAST_UUID,
        ngAbacusMove,
        ngAbacusReset,
        ngAbacusSolved,
        ngAbacusTarget,
        ngAbacusValue,
        ngLoadBeads,
        ngSaveBeads,
        type NgBeads,
    } from "./NgAbacus";

    const ROD_COLORS = ["#2b8fd6", "#58b368", "#e6b800", "#ff8a7a"];

    let beads = $state<NgBeads>(ngLoadBeads());
    let target = $state<number>(ngAbacusTarget());
    let feedback = $state<{ kind: "ok" | "err"; text: string } | null>(null);

    const value = $derived(ngAbacusValue(beads));

    function move(rod: number, delta: number): void {
        beads = ngAbacusMove(beads, rod, delta);
        ngSaveBeads(beads);
        feedback = null;
    }

    function check(): void {
        if (ngAbacusSolved(beads, target)) {
            feedback = { kind: "ok", text: `صحيح! بنيت الرقم ${target} ✓` };
            ngCelebrate(`أحسنت يا بطل! بنيت الرقم ${target} على المعداد 🎉`);
            target = ngAbacusTarget();
        } else {
            feedback = { kind: "err", text: "لم يصل بعد — عدّل الخرزات وحاول مجددًا 💙" };
        }
    }

    function newTarget(): void {
        target = ngAbacusTarget();
        feedback = null;
    }

    function resetBeads(): void {
        beads = ngAbacusReset();
        ngSaveBeads(beads);
        feedback = null;
    }

    function close(): void {
        toastStore.removeToast(NG_ABACUS_TOAST_UUID);
    }
</script>

<div
    class="fixed inset-0 z-[1001] flex items-center justify-center bg-black/30 p-4"
    transition:fly={{ y: 20, duration: 220 }}
>
    <div class="w-full max-w-lg rounded-3xl border-2 border-[#38b6ff]/50 bg-white/95 p-4 shadow-xl">
        <p class="mb-1 text-center text-base font-extrabold text-[#1e97d6]">🧮 معدادي</p>
        <p class="mb-2 text-center text-3xl font-extrabold text-[#1272a8]" aria-live="polite">{value}</p>

        <div class="grid grid-cols-4 gap-2">
            {#each NG_ABACUS_ROD_LABELS as label, rod (label)}
                <div class="flex flex-col items-center gap-1">
                    <button
                        type="button"
                        class="h-8 w-8 rounded-full bg-[#38b6ff] text-lg font-extrabold text-white hover:bg-[#1e97d6]"
                        aria-label="أضف خرزة إلى {label}"
                        onclick={() => move(rod, 1)}>＋</button
                    >
                    <span class="text-[11px] font-bold text-slate-500">{label}</span>
                    <div class="flex h-32 w-11 flex-col-reverse items-center gap-[3px] rounded-xl bg-[#fdf3d8] p-1.5">
                        {#each Array(beads[rod] ?? 0) as _, bead (bead)}
                            <span
                                class="h-5 w-8 rounded-full border border-black/10 shadow-sm"
                                style="background: {ROD_COLORS[rod]}"
                            ></span>
                        {/each}
                    </div>
                    <button
                        type="button"
                        class="h-8 w-8 rounded-full bg-[#eaf7ff] text-lg font-extrabold text-[#1272a8] hover:bg-[#d3edff]"
                        aria-label="أنقص خرزة من {label}"
                        onclick={() => move(rod, -1)}>－</button
                    >
                </div>
            {/each}
        </div>

        <div class="mt-3 rounded-2xl bg-[#eaf7ff] p-2 text-center">
            <p class="text-sm font-bold text-[#1272a8]">
                أرِنا الرقم: <span class="text-xl font-extrabold">{target}</span>
            </p>
            <div class="mt-1 flex justify-center gap-2">
                <button
                    type="button"
                    class="rounded-full bg-[#38b6ff] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#1e97d6]"
                    onclick={check}>تحقّق ✓</button
                >
                <button
                    type="button"
                    class="rounded-full bg-white px-4 py-1.5 text-xs font-bold text-[#1272a8] hover:bg-[#d3edff]"
                    onclick={newTarget}>هدف جديد 🎲</button
                >
                <button
                    type="button"
                    class="rounded-full bg-white px-4 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100"
                    onclick={resetBeads}>تصفير ↺</button
                >
            </div>
            {#if feedback}
                <p
                    class="mt-1 text-xs font-extrabold {feedback.kind === 'ok' ? 'text-green-600' : 'text-[#1272a8]'}"
                    aria-live="polite"
                >
                    {feedback.text}
                </p>
            {/if}
        </div>

        <button
            type="button"
            class="mt-3 w-full rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200"
            onclick={close}
        >
            ✖ انتهيت من المعداد
        </button>
    </div>
</div>
