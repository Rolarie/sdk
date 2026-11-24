<!--
A control bar's last win: the last play that won more than nothing, kept in view. Green
while it is the last play's own, greyed once a later play has started or won nothing, so
that a player can tell at a glance, at any speed, whether the play just gone won.

Author: dwclake
Created: 2026-11-19
-->
<script lang="ts">
	import { formatCoins } from "../coins.ts";
	import type { SegmentLook } from "../look.ts";
	import { dressItem, itemSize } from "./bar-item.ts";
	import { getBar } from "./bar-state.svelte.ts";

	interface Props {
		/** How it looks: its ground, edge, corners and padding (../look.ts). Nothing round it, left out. */
		look?: SegmentLook;
		/** Its size against the rest of the bar: 0.5 to 2. */
		size?: number;
		/** The word over the amount. "Win", left out. */
		label?: string;
		/** Whether RC is written after the amount. It is, left out, where there is room. */
		unit?: boolean;
	}

	let { look, size, label = "Win", unit = true }: Props = $props();

	const bar = getBar("win");
</script>

<div
	class="sdk-bar-segment"
	data-segment="win"
	{@attach dressItem(() => look)}
	style:--segment-scale={itemSize(size)}
>
	<div class="sdk-bar-readout sdk-bar-win" data-fresh={bar.winFresh ? "" : undefined}>
		<span class="sdk-bar-label">{label}</span><output>
			{formatCoins(bar.win)}{#if unit}<span class="sdk-bar-unit">{" RC"}</span>{/if}
		</output>
	</div>
</div>

<style>
	.sdk-bar-win {
		padding-right: calc(6px * var(--s));
		text-align: right;
	}
	/* The last win: green while it is the last play's own, greyed once it is an earlier play's. */
	.sdk-bar-win output {
		color: var(--bar-dim, #b4b6ba);
	}
	.sdk-bar-win[data-fresh] output {
		color: var(--bar-win, #8fc79a);
	}
</style>
