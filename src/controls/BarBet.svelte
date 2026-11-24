<!--
A control bar's bet, with minus and plus: the bet under its label, and a button either
side that moves it to the next bet on offer: a bet is never typed. One of the three items every bar shows (this, or ./BarBetButton.svelte).

Author: dwclake
Created: 2026-11-19
-->
<script lang="ts">
	import { BET_ARRANGEMENTS, type BetArrangement } from "../bar-rules.ts";
	import { formatCoins } from "../coins.ts";
	import type { SegmentLook } from "../look.ts";
	import { dressItem, itemSize } from "./bar-item.ts";
	import { getBar } from "./bar-state.svelte.ts";
	import Mark from "./Mark.svelte";

	interface Props {
		/** How it looks: its ground, edge, corners and padding (../look.ts). Nothing round it, left out. */
		look?: SegmentLook;
		/** Its size against the rest of the bar: 0.5 to 2. */
		size?: number;
		/** The bet between minus and plus (`split`, left out), or plus over minus at one side. */
		arrange?: BetArrangement;
	}

	let { look, size, arrange = "split" }: Props = $props();

	const bar = getBar("bet");

	$effect(() => {
		if (!BET_ARRANGEMENTS.includes(arrange))
			throw new Error(`The bet is arranged ${BET_ARRANGEMENTS.join(", ")}.`);
	});
</script>

{#snippet betFace()}<span class="sdk-bar-label sdk-bar-betlabel">
		{#each bar.names as name}<span
				class={{ "sdk-bar-betlabel-on": name === bar.betName }}
			>
				{name}
			</span>{/each}
	</span><output>{formatCoins(bar.cost ?? bar.stake)}</output>{/snippet}

<div
	class="sdk-bar-bet sdk-bar-segment"
	role="group"
	aria-label="Bet"
	data-segment="bet"
	{@attach dressItem(() => look)}
	data-arrange={arrange}
	style:--segment-scale={itemSize(size)}
>
	<button
		type="button"
		class="sdk-bar-button sdk-bar-minus"
		aria-label="Lower the bet"
		disabled={bar.locked || bar.lower === undefined}
		onclick={() => bar.setBet(bar.lower ?? bar.stake)}
	>
		<Mark name="minus" />
	</button>
	<div class="sdk-bar-readout sdk-bar-betvalue">
		{@render betFace()}
	</div>
	<button
		type="button"
		class="sdk-bar-button sdk-bar-plus"
		aria-label="Raise the bet"
		disabled={bar.locked || bar.higher === undefined}
		onclick={() => bar.setBet(bar.higher ?? bar.stake)}
	>
		<Mark name="plus" />
	</button>
</div>

<style>
	/* The bet with plus over minus at one side of it. Buttons one over another are shorter, so the two fit the bar. */
	.sdk-bar-segment[data-arrange^="column"] {
		display: grid;
		grid-auto-flow: column;
		column-gap: calc(8px * var(--s));
		row-gap: calc(4px * var(--s));
		align-items: center;
	}
	.sdk-bar-segment[data-arrange^="column"] .sdk-bar-button {
		height: calc(36px * var(--s));
		min-height: calc(36px * var(--s));
		border-radius: calc(18px * var(--s));
	}
	.sdk-bar-segment[data-arrange^="column"] .sdk-bar-button :global(svg) {
		width: calc(20px * var(--s));
		height: calc(20px * var(--s));
	}
	.sdk-bar-segment[data-arrange="column-start"] {
		grid-template-areas: "plus value" "minus value";
	}
	.sdk-bar-segment[data-arrange="column-end"] {
		grid-template-areas: "value plus" "value minus";
	}
	.sdk-bar-segment[data-arrange^="column"] .sdk-bar-plus {
		grid-area: plus;
	}
	.sdk-bar-segment[data-arrange^="column"] .sdk-bar-minus {
		grid-area: minus;
	}
	.sdk-bar-segment[data-arrange^="column"] .sdk-bar-betvalue {
		grid-area: value;
	}
</style>
