<!--
The SDK's control bar in a box the size of a game, for its stories: its props are the
story's controls, and what the player does with it is written above it.

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts">
	import type { Hideable } from "../bar-rules.ts";
	import type { Shape } from "../shapes.ts";
	import View from "../View.svelte";
	import { Action, ControlBar, Switch } from "../controls/index.ts";

	interface Props {
		/**
		 * The view the bar is shown in. A tall view asks the bar for what suits it: the bet as
		 * one button, the balance and the win in a strip, and twice the size.
		 */
		shape?: Shape;
		balance?: number;
		busy?: boolean;
		freeSpins?: number | null;
		autoLeft?: number;
		autoplay?: boolean;
		speeds?: "turbo" | "fast" | "none";
		place?: "bottom" | "top";
		scale?: number;
		hide?: Hideable[];
		/** A colour to stain the bar's glass with. */
		tint?: string;
	}

	let {
		shape = "wide",
		balance = 1_250_00,
		busy = false,
		freeSpins = null,
		autoLeft = 0,
		autoplay = true,
		speeds = "turbo",
		place = "bottom",
		scale = 1,
		hide = [],
		tint
	}: Props = $props();

	let bet = $state<number>();
	let win = $state(0);
	let sound = $state(true);
	let said = $state("Nothing pressed yet.");
</script>

<p class="said">{said} Bet: {bet === undefined ? "" : (bet / 100).toFixed(2)}</p>

<div class={["game", shape]}>
	<View {shape}>
		<!-- Something to see through the glass. -->
		<div class="scenery">
			{#each Array.from({ length: 15 }) as _, index}
				<span class={{ lit: index % 4 === 1 }}></span>
			{/each}
		</div>
		<ControlBar
			look={tint ? { tint } : undefined}
			bets={{
				steps: [
					{ under: 2_00, by: 20 },
					{ under: 6_00, by: 25 },
					{ under: 10_00, by: 50 },
					{ by: 2_50 }
				]
			}}
			startBet={100}
			limits={{ minStake: 20, maxStake: 25_00 }}
			play={{ label: "Spin", symbol: "spin" }}
			onplay={() => {
				win = Math.random() < 0.4 ? (bet ?? 0) * 2 : 0;
				said = win > 0 ? "Played, and won." : "Played.";
			}}
			autoplay={autoplay
				? {
						noun: ["spin", "spins"],
						onstart: (count) => (said = `Autoplay started: ${count} spins.`),
						onstop: () => (said = "Autoplay stopped.")
					}
				: undefined}
			{speeds}
			{place}
			scale={shape === "tall" ? scale * 2 : scale}
			betAs={shape === "tall" ? "menu" : "steps"}
			readouts={shape === "tall" ? "strip" : "bar"}
			popups={shape === "tall" ? 1.5 : 1}
			{hide}
			{balance}
			{win}
			{busy}
			{freeSpins}
			{autoLeft}
			bind:bet
		>
			{#snippet menu()}
				<Switch label="Sound effects" bind:checked={sound} />
				<Action label="Rules" onpress={() => (said = "Rules pressed.")} />
			{/snippet}
		</ControlBar>
	</View>
</div>

<style>
	.said {
		margin: 0;
		padding: 0.75rem 1rem;
	}

	/* A game's frame, as a page would give it: the view in it is scaled to fit. */
	.game {
		position: relative;
		width: 1000px;
		height: 625px;
		max-width: 100%;
		overflow: hidden;
		background: #1d1418;
		outline: 1px solid rgb(255 255 255 / 0.12);
	}

	.game.tall {
		width: 390px;
		height: 693px;
	}

	.scenery {
		position: absolute;
		inset: 12% 20% 22%;
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 2%;
	}

	.scenery span {
		border: 1px solid #4c4e53;
		border-radius: 14%;
		background: #26272b;
	}

	.scenery span.lit {
		background: #8ab4f8;
	}
</style>
