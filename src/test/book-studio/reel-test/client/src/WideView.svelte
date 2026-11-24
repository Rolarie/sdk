<!--
Reel Test at 16 by 10, the view every game has, drawn at 1600 by 1000: its name and its
line of words in a column at the left, where a wide game has room to spare, the reels
beside them, and the bar along the foot with everything in it. It draws what the game
hands it and keeps nothing of its own.

Author: dwclake
Created: 2026-11-19
-->
<script lang="ts">
	import { WideView } from "@rolarie/sdk/views";
	import Bar from "./Bar.svelte";
	import Machine from "./Machine.svelte";
	import type { ViewProps } from "./view-props.ts";

	let { game, track, onready }: ViewProps = $props();
</script>

<WideView>
	<main>
		<div class="words">
			<h1 class="title">Reel Test</h1>
			<p class="message" id="message">{game.message}</p>
		</div>
		<Machine x={700} y={64} size={760} still={game.still} {track} {onready} />
	</main>
	<Bar {game} />
</WideView>

<style>
	.words {
		position: absolute;
		left: 100px;
		top: 300px;
		width: 500px;
		display: grid;
		gap: 30px;
	}

	.title {
		margin: 0;
		font-size: 64px;
		font-weight: 600;
		letter-spacing: 0.04em;
		color: var(--lamp);
	}

	.message {
		margin: 0;
		min-height: 2.8em;
		font-size: 26px;
	}
</style>
