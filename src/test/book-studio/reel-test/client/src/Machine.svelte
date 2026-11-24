<!--
Reel Test's reels on their stage, in a square frame. Both views show it; where it is and
how large is each view's to say.

Author: dwclake
Created: 2026-11-19
-->
<script lang="ts">
	import { Stage } from "@rolarie/sdk/pixi";
	import { REELS, ROWS } from "../../maths/rules";
	import Reels from "./Reels.svelte";
	import { PICTURES } from "./symbols.ts";

	interface Props {
		/** Where its top left corner is in the view, and how wide and high it is, in the view's pixels. */
		x: number;
		y: number;
		size: number;
		/** With nothing moving: the player has asked their device for less motion. */
		still: boolean;
		/** Follows the stage as it loads: a loading screen's `track`. */
		track?: <Work>(work: Promise<Work>) => Promise<Work>;
		/** Called once the stage is ready to be played on. */
		onready?: () => void;
	}

	let { x, y, size, still, track, onready }: Props = $props();

	/** A cell's size on the stage, in the stage's own measure. */
	const CELL = 200;
</script>

<!-- The reels, drawn. What they show is said in words by the view, for a screen reader. -->
<div class="reels" style:left="{x}px" style:top="{y}px" style:width="{size}px">
	<Stage
		width={REELS * CELL}
		height={ROWS * CELL}
		pictures={PICTURES}
		{track}
		onready={() => onready?.()}
	>
		<Reels cell={CELL} {still} />
	</Stage>
</div>

<style>
	/* Square: the stage in it is as wide as it is high. */
	.reels {
		position: absolute;
		box-sizing: border-box;
		padding: 12px;
		border-radius: 12px;
		background: rgb(15 37 48 / 0.7);
		box-shadow: inset 0 0 0 2px #3b6577;
	}
</style>
