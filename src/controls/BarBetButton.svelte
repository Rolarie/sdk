<!--
A control bar's bet as one button: the bet under its label, and pressed, a popup of every
bet on offer in a grid, which closes when one is chosen. It takes less room than minus and
plus (./BarBet.svelte), so the SDK's bar uses it on a narrow game.

Author: dwclake
Created: 2026-11-19
-->
<script lang="ts">
	import { formatCoins } from "../coins.ts";
	import type { SegmentLook } from "../look.ts";
	import { dressItem, itemSize } from "./bar-item.ts";
	import { getBar, popupOpens } from "./bar-state.svelte.ts";
	import Choices from "./Choices.svelte";
	import Popup from "./Popup.svelte";

	interface Props {
		/** How it looks: its ground, edge, corners and padding (../look.ts). Nothing round it, left out. */
		look?: SegmentLook;
		/** Its size against the rest of the bar: 0.5 to 2. */
		size?: number;
		/** How many bets to a line in the popup. Four, left out. */
		columns?: number;
	}

	let { look, size, columns = 4 }: Props = $props();

	const bar = getBar("bet");
	const opens = popupOpens();

	let popup = $state<ReturnType<typeof Popup>>();
</script>

<div
	class="sdk-bar-bet sdk-bar-segment"
	role="group"
	aria-label="Bet"
	data-segment="bet"
	{@attach dressItem(() => look)}
	style:--segment-scale={itemSize(size)}
>
	<Popup
		bind:this={popup}
		label="Bet"
		title="Bet"
		button="readout"
		opens={opens()}
		disabled={bar.locked}
		name={`${bar.betName} ${formatCoins(bar.cost ?? bar.stake)}. Press to choose a bet.`}
	>
		{#snippet face()}<span class="sdk-bar-readout sdk-bar-betvalue">
				<span class="sdk-bar-label sdk-bar-betlabel">
					{#each bar.names as name}<span
							class={{ "sdk-bar-betlabel-on": name === bar.betName }}
						>
							{name}
						</span>{/each}
				</span><output>{formatCoins(bar.cost ?? bar.stake)}</output>
			</span>{/snippet}
		<Choices
			label="Bet"
			grid={columns}
			options={bar.bets.map((value) => ({ value, label: formatCoins(value) }))}
			value={bar.stake}
			onchange={(value) => bar.setBet(value)}
			onpick={() => popup?.close()}
			maxHeight={232}
			figures
		/>
	</Popup>
</div>

<style>
	/* The face of the bet's button (./Popup.svelte draws the button itself): smaller than a readout in the bar. */
	.sdk-bar-betvalue {
		min-width: calc(36px * var(--s));
	}

	.sdk-bar-label {
		color: color-mix(in srgb, var(--bar-ink, #f2f2f2) 82%, transparent);
	}

	.sdk-bar-betvalue output {
		font-size: calc(17px * var(--s));
	}
</style>
