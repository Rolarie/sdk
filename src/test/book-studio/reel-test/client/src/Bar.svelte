<!--
Reel Test's control bar: the SDK's, on what the game knows. Both views show it; what
differs between them (how the bet is chosen, where the balance and the win are read) is
each view's to say, through the props.

Author: dwclake
Created: 2026-11-19
-->
<script lang="ts">
	import { ControlBar } from "@rolarie/sdk/controls";
	import type { ReelTest } from "./game.svelte.ts";

	interface Props {
		game: ReelTest;
		/** How the bet is chosen: stepped (left out), or as one button that opens the bets on offer. */
		betAs?: "steps" | "menu";
		/** Where the balance and the win are read: in the bar (left out), or in a strip along the top. */
		readouts?: "bar" | "strip";
		/** How big the bar is, against its usual size. */
		scale?: number;
	}

	let { game, betAs, readouts, scale }: Props = $props();
</script>

<!-- Every game has the SDK's control bar: the bet, the spin, autoplay, the speed, the balance
     and the last win. A view makes its own, at the bet the game already holds. -->
<ControlBar
	bets={{ steps: [{ under: 100, by: 10 }, { under: 1_000, by: 100 }, { by: 1_000 }] }}
	startBet={game.bet ?? 100}
	limits={game.limits}
	play={{ label: "Spin", symbol: "spin" }}
	onplay={() => void game.spin()}
	autoplay={{
		noun: ["spin", "spins"],
		onstart: (count) => void game.autoplay(count),
		onstop: game.stopAutoplay
	}}
	look={{ surface: "#0f2530", accent: "#ffd56b", onAccent: "#0f2530" }}
	balance={game.balance}
	win={game.win}
	busy={game.busy}
	autoLeft={game.autoLeft}
	{betAs}
	{readouts}
	{scale}
	bind:bet={game.bet}
	bind:bar={game.bar}
/>
