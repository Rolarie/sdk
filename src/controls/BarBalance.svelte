<!--
A control bar's balance: what the player has, under its label. One of the three items
every bar shows.

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
		/** The word over the amount. "Balance", left out. */
		label?: string;
		/** Whether RC is written after the amount. It is, left out, where there is room. */
		unit?: boolean;
	}

	let { look, size, label = "Balance", unit = true }: Props = $props();

	const bar = getBar("balance");
</script>

<div
	class="sdk-bar-segment"
	data-segment="balance"
	{@attach dressItem(() => look)}
	style:--segment-scale={itemSize(size)}
>
	<div class="sdk-bar-readout sdk-bar-balance">
		<span class="sdk-bar-label">{label}</span><output>
			{formatCoins(bar.balance)}{#if unit}<span class="sdk-bar-unit">
					{" RC"}
				</span>{/if}
		</output>
	</div>
</div>

<style>
	.sdk-bar-balance {
		padding-left: calc(6px * var(--s));
	}
</style>
