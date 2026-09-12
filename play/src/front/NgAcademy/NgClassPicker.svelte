<script lang="ts">
    /**
     * NG Academy — أكاديمية الجيل الجديد
     * "أين فصلي؟" — seven big rounded buttons; the answer is remembered on the
     * device so the train knows the destination next times too.
     */
    import { fly } from "svelte/transition";
    import { toastStore } from "../Stores/ToastStoreSingleton";
    import {
        NG_CLASS_PICKER_TOAST_UUID,
        NG_CLASSROOM_LABELS,
        NG_CLASSROOM_SLUGS,
        ngSetMyClass,
        ngTrainRide,
    } from "./NgTrain";

    function choose(slug: (typeof NG_CLASSROOM_SLUGS)[number]): void {
        ngSetMyClass(slug);
        toastStore.removeToast(NG_CLASS_PICKER_TOAST_UUID);
        ngTrainRide(slug).catch((e) => console.error(e));
    }
</script>

<div
    class="fixed inset-0 z-[1001] flex items-center justify-center bg-black/30 p-4"
    transition:fly={{ y: 20, duration: 220 }}
>
    <div class="w-full max-w-md rounded-3xl border-2 border-[#38b6ff]/50 bg-white/95 p-4 shadow-xl">
        <p class="mb-3 text-center text-base font-extrabold text-[#1e97d6]">🏫 أين فصلك يا بطل؟</p>
        <div class="grid grid-cols-2 gap-2">
            {#each NG_CLASSROOM_SLUGS as slug (slug)}
                <button
                    type="button"
                    class="rounded-2xl bg-[#eaf7ff] px-3 py-3 text-sm font-bold text-[#1272a8] hover:bg-[#d3edff]"
                    onclick={() => choose(slug)}
                >
                    {NG_CLASSROOM_LABELS[slug]}
                </button>
            {/each}
        </div>
        <button
            type="button"
            class="mt-3 w-full rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200"
            onclick={() => toastStore.removeToast(NG_CLASS_PICKER_TOAST_UUID)}
        >
            🚶 سأستكشف بنفسي أولًا
        </button>
    </div>
</div>
