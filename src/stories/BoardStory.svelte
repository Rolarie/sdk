<!--
A board of reels on a stage, for its stories: buttons spin it, light a win and let the
win fall, each as a round's events would.

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts">
	import { Stage } from "../pixi/index.ts";
	import { Board } from "../slot/index.ts";
	import type { Cell, Grid } from "../slots.ts";

	type Sym = "a" | "b" | "c" | "d";

	let {
		reels = 5,
		rows = 3,
		instant = false
	}: { reels?: number; rows?: number; instant?: boolean } = $props();

	const SYMBOLS: Sym[] = ["a", "b", "c", "d"];
	const COLOURS: Record<Sym, string> = {
		a: "#dc2828",
		b: "#00c850",
		c: "#2850dc",
		d: "#e6c800"
	};

	/** A symbol's picture: a tile of its colour, drawn here so that nothing has to be loaded. */
	const tile = (colour: string) =>
		`data:image/svg+xml,${encodeURIComponent(
			`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect x="4" y="4" width="56" height="56" rx="8" fill="${colour}"/></svg>`
		)}`;
	const pictures = Object.fromEntries(
		SYMBOLS.map((symbol) => [symbol, tile(COLOURS[symbol])])
	);

	const any = () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
	const grid = (): Grid<Sym> =>
		Array.from({ length: reels }, () => Array.from({ length: rows }, any));

	let board = $state<ReturnType<typeof Board<Sym>>>();
	/** The top row, as a win to light and to take away. */
	const topRow = (): Cell[] =>
		Array.from({ length: reels }, (_, reel): Cell => [reel, 0]);
</script>

<div class="room">
	<Stage width={reels * 100} height={rows * 100} {pictures} label="A board of reels">
		<Board
			bind:this={board}
			{reels}
			{rows}
			cell={100}
			grid={grid()}
			texture={(symbol) => symbol}
		/>
	</Stage>
</div>

<p class="buttons">
	<button onclick={() => board?.spin(grid(), { instant })}>Spin</button>
	<button
		onclick={() => board?.showWins([{ cells: topRow(), text: "12.50" }], { instant })}
	>
		Light the top row
	</button>
	<button
		onclick={() =>
			board?.tumble(
				{ taken: topRow(), drops: topRow().map(() => [any()]) },
				{ instant }
			)}
	>
		Let it fall
	</button>
	<button onclick={() => board?.light(null)}>Light them all</button>
</p>

<style>
	.room {
		max-width: 640px;
		margin: 1rem;
	}

	.buttons {
		display: flex;
		gap: 0.5rem;
		margin: 1rem;
	}
</style>
