<!--
A round played out on the SDK's shared slot pieces: the row's events are played in order
by handlers, which tell the reels what to do over an emitter and wait for them. Buttons
play the round, light a win and fill the meter, and "Read" writes what is drawn where the
test can see it.

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts">
	import { Rectangle, type Application } from "pixi.js";
	import { provideEmitter } from "@rolarie/sdk/emitter";
	import { playSteps, type Handlers } from "@rolarie/sdk/events";
	import { Stage } from "@rolarie/sdk/pixi";
	import { Meter } from "@rolarie/sdk/slot";
	import Reels from "./Reels.svelte";
	import {
		HELD_FALL,
		ROW,
		START,
		TAKEN,
		type RowEvent,
		type StageEvent
	} from "./round.ts";

	const emitter = provideEmitter<StageEvent>();

	let instant = $state(false);
	let gems = $state(0);
	let app: Application | null = null;
	/** What happened, in the order it did. */
	const log: string[] = [];

	/** Each of a row's events, played by telling the pieces and waiting for them. */
	const handlers: Handlers<RowEvent, { events: RowEvent[] }> = {
		async spin(event) {
			log.push("spin");
			await emitter.broadcast({ type: "reelsSpin", grid: event.grid, instant });
			log.push("landed");
		},
		async win(event) {
			await emitter.broadcast({
				type: "reelsWins",
				wins: event.wins.map((win) => ({
					cells: win.cells,
					text: `${(win.amountBp / 10_000).toFixed(2)}x`
				}))
			});
			log.push("wins");
		},
		async tumble(event) {
			await emitter.broadcast({
				type: "reelsFall",
				taken: event.taken,
				drops: event.drops,
				instant
			});
			log.push("fell");
		},
		total(event) {
			log.push(`total ${event.payoutBp}`);
		}
	};

	/** Plays the round from the start, and says when it is over. */
	async function play() {
		log.length = 0;
		delete document.body.dataset.played;

		await emitter.broadcast({ type: "reelsShow", grid: START });
		await playSteps([ROW], handlers);

		document.body.dataset.log = JSON.stringify(log);
		document.body.dataset.played = "true";
	}

	/** One pixel of what is drawn, as "red,green,blue". */
	function pixelAt(x: number, y: number): string {
		const { pixels } = app!.renderer.extract.pixels({
			target: app!.stage,
			frame: new Rectangle(x, y, 1, 1)
		});

		return [pixels[0], pixels[1], pixels[2]].join(",");
	}

	/** Writes the colour near the corner of each cell, reel by reel, and the meter's two ends. */
	async function read() {
		await emitter.broadcast({ type: "reelsRead" });

		document.body.dataset.cells = JSON.stringify(
			[0, 1, 2].map((reel) =>
				[0, 1].map((row) => pixelAt(reel * 60 + 6, row * 60 + 6))
			)
		);
		document.body.dataset.meter = JSON.stringify([
			pixelAt(40, 140),
			pixelAt(140, 140)
		]);
		document.body.dataset.words = String(
			JSON.stringify(app!.stage.children.map((child) => child.children.length))
		);
	}
</script>

<div class="room">
	<Stage
		width={240}
		height={160}
		pictures={{ a: "./a.png", b: "./b.png", c: "./c.png", d: "./d.png" }}
		onready={(made) => {
			app = made;
			document.body.dataset.ready = "true";
		}}
	>
		<Reels onstop={(reel) => log.push(`stop ${reel}`)} />
		<Meter y={130} value={gems} full={10} width={180} height={20} fillTime={100} />
	</Stage>
</div>

<label><input type="checkbox" bind:checked={instant} /> Instant</label>
<button onclick={play}>Play</button>
<button
	onclick={() =>
		emitter.broadcast({ type: "reelsWins", wins: [{ cells: TAKEN, text: "1.50x" }] })}
>
	Wins
</button>
<button
	onclick={async () => {
		await emitter.broadcast({ type: "reelsShow", grid: START });
		await emitter.broadcast({ type: "reelsFall", ...HELD_FALL, instant });
		document.body.dataset.held = "true";
	}}
>
	Hold
</button>
<button onclick={() => (gems = 5)}>Fill</button>
<button onclick={read}>Read</button>

<style>
	/* The stage's own measure on the screen, so that a pixel read is a pixel drawn. */
	.room {
		width: 240px;
	}
</style>
