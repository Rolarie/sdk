<!--
Reel Test's reels: three of three on the SDK's board, with the line along the middle
row marked. They know nothing of rounds. They are told what to do over the game's emitter
(./round.ts): spin to where the reels stopped, and light the line when it wins.

Author: dwclake
Created: 2026-11-18
-->
<script lang="ts">
	import { getEmitter, onEvent } from "@rolarie/sdk/emitter";
	import { Graphics } from "@rolarie/sdk/pixi";
	import { Board } from "@rolarie/sdk/slot";
	import type { Cell } from "@rolarie/sdk/slots";
	import { LINE_ROW, REELS, ROWS, STRIP, type SymbolName } from "../../maths/rules";
	import type { StageEvent } from "./round.ts";

	interface Props {
		/** The size of one cell, in the stage's own measure. */
		cell: number;
		/** With nothing moving: the player has asked their device for less motion. */
		still: boolean;
	}

	let { cell, still }: Props = $props();

	const emitter = getEmitter<StageEvent>();
	let board = $state<ReturnType<typeof Board<SymbolName>>>();

	// How long a reel turns and how long after the last the next one stops, in milliseconds, at
	// the ordinary pace. The bar's speed button shortens both (`bar.pace()`).
	const SPIN_TIME = 1040;
	const REEL_DELAY = 1040;

	/** The cells of the line: the middle row of every reel. */
	const LINE: Cell[] = Array.from({ length: REELS }, (_, reel): Cell => [
		reel,
		LINE_ROW
	]);

	onEvent(emitter, "reelsSpin", (event) =>
		board?.spin(event.reels, {
			instant: still,
			spinTime: SPIN_TIME * event.pace,
			reelDelay: REEL_DELAY * event.pace
		})
	);
	onEvent(emitter, "reelsWin", (event) =>
		board?.showWins([{ cells: LINE, text: event.text }])
	);
</script>

<!-- The line, under the symbols on it. -->
<Graphics
	y={LINE_ROW * cell}
	draw={(line) =>
		line.rect(0, 0, REELS * cell, cell).fill({ color: 0xffd56b, alpha: 0.14 })}
/>

<!-- Before the first spin: the strip's opening symbols. -->
<Board
	bind:this={board}
	reels={REELS}
	rows={ROWS}
	{cell}
	grid={Array.from({ length: REELS }, (_, reel) =>
		STRIP.slice(reel * ROWS, reel * ROWS + ROWS)
	)}
	texture={(symbol) => symbol}
	labelStyle={{
		fill: 0xffd56b,
		fontSize: cell * 0.22,
		fontWeight: "700",
		stroke: { color: 0x0f2530, width: cell * 0.05 }
	}}
/>
