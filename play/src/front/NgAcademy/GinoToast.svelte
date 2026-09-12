<script lang="ts">
    /**
     * NG Academy — أكاديمية الجيل الجديد
     * The speech bubble of Gino / the teachers / the location banner.
     * Rendered through the global toast stack but positioned on its own
     * (bottom center) so it reads like a character talking to the child.
     */
    import { fly } from "svelte/transition";
    import type { NgBubble } from "./NgBubble";
    import { dismissCurrentBubble, ngBubbleAction } from "./GinoStore";

    interface Props {
        bubble: NgBubble;
    }

    // The toast stack also injects a `toastUuid` prop; we dismiss through the
    // GinoStore, so it is intentionally not declared.
    let { bubble }: Props = $props();
</script>

{#if bubble.kind === "location"}
    <div
        class="pointer-events-none fixed inset-x-0 bottom-24 z-[1000] flex justify-center"
        transition:fly={{ y: 16, duration: 220 }}
    >
        <span class="rounded-full bg-[#38b6ff] px-5 py-2 text-sm font-bold text-white shadow-lg" role="status">
            {bubble.text}
        </span>
    </div>
{:else}
    <div class="fixed inset-x-0 bottom-20 z-[1000] flex justify-center px-3" transition:fly={{ y: 24, duration: 260 }}>
        <div
            class="flex w-full max-w-md items-center gap-3 rounded-3xl border-2 border-[#38b6ff]/50 bg-white/95 p-3 shadow-xl"
            role="status"
        >
            <img
                src={bubble.portrait}
                alt={bubble.speaker}
                class="h-14 w-14 shrink-0 rounded-full border-2 border-[#38b6ff]/60 bg-[#eaf7ff] object-cover"
            />
            <div class="min-w-0 flex-1 text-right">
                <p class="text-sm font-extrabold text-[#1e97d6]">
                    {bubble.speaker}
                    {#if bubble.role}
                        <span class="mr-1 text-xs font-medium text-slate-500">· {bubble.role}</span>
                    {/if}
                </p>
                <p class="mt-0.5 text-sm leading-6 text-slate-700">{bubble.text}</p>
                {#if bubble.actions && bubble.actions.length > 0}
                    <div class="mt-2 flex flex-wrap justify-end gap-2">
                        {#each bubble.actions as action (action.id)}
                            <button
                                type="button"
                                class="rounded-full bg-[#38b6ff] px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-[#1e97d6]"
                                onclick={() => ngBubbleAction(action.id)}
                            >
                                {action.label}
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>
            <button
                type="button"
                class="shrink-0 rounded-full bg-[#eaf7ff] px-2.5 py-1 text-xs font-bold text-[#1e97d6] hover:bg-[#d3edff]"
                onclick={dismissCurrentBubble}
                aria-label="إغلاق الرسالة"
            >
                ✕
            </button>
        </div>
    </div>
{/if}
