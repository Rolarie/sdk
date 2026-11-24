<!--
Reel Test at 9 by 16, for a phone held upright, drawn at 900 by 1600: its name, the reels
across the game, its line of words under them. The bar is left to its buttons: the bet is
one button that opens the bets on offer, and the balance and the win are in a strip along
the top. A game need not have this view; without it, it is shown wide everywhere.

Author: dwclake
Created: 2026-11-19
-->
<script lang="ts">
	import { TallView } from "@rolarie/sdk/views";
	import Bar from "./Bar.svelte";
	import Machine from "./Machine.svelte";
	import type { ViewProps } from "./view-props.ts";

	let { game, track, onready }: ViewProps = $props();
</script>

<TallView>
	<main>
		<h1 class="title">Reel Test</h1>
		<Machine x={50} y={330} size={800} still={game.still} {track} {onready} />
		<p class="message" id="message">{game.message}</p>
	</main>
	<!-- Twice the size: a tall view is shown on a phone at under half the size it is drawn. -->
	<Bar {game} betAs="menu" readouts="strip" scale={2} />
</TallView>

<style>
	.title {
		position: absolute;
		left: 0;
		right: 0;
		top: 170px;
		margin: 0;
		text-align: center;
		font-size: 72px;
		font-weight: 600;
		letter-spacing: 0.04em;
		color: var(--lamp);
	}

	.message {
		position: absolute;
		left: 60px;
		right: 60px;
		top: 1180px;
		margin: 0;
		min-height: 2.8em;
		text-align: center;
		font-size: 34px;
	}
</style>
