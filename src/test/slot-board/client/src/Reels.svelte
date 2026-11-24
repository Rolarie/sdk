<!--
The reels of the test page: a board, told what to do over the game's emitter. It knows
nothing of rounds or rows, only the few things it listens for, which is what lets a piece
be played by itself.

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts">
	import { getEmitter, onEvent } from "@rolarie/sdk/emitter";
	import { Board } from "@rolarie/sdk/slot";
	import { START, type StageEvent, type Sym } from "./round.ts";

	let { onstop }: { onstop: (reel: number) => void } = $props();

	const emitter = getEmitter<StageEvent>();
	let board = $state<ReturnType<typeof Board<Sym>>>();

	onEvent(emitter, "reelsShow", (event) => board!.show(event.grid));
	onEvent(emitter, "reelsSpin", (event) =>
		board!.spin(event.grid, { instant: event.instant })
	);
	onEvent(emitter, "reelsWins", (event) => board!.showWins(event.wins));
	onEvent(emitter, "reelsFall", (event) =>
		board!.tumble(event, { instant: event.instant })
	);
	onEvent(emitter, "reelsRead", () => {
		document.body.dataset.showing = JSON.stringify(board!.showing());
	});
</script>

<Board
	bind:this={board}
	reels={3}
	rows={2}
	cell={60}
	grid={START}
	texture={(symbol) => symbol}
	spinTime={200}
	reelDelay={60}
	fallTime={150}
	labelStyle={{ fill: 0xffffff, fontSize: 14 }}
	{onstop}
/>
