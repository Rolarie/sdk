<!--
A small drawing made with every piece of the SDK's Pixi bindings: a shape that moves when
state changes, a picture that comes and goes, words, a group with a shape in it that takes
a press, and a count of frames. Buttons beside it change its state, and "Read" writes what
is drawn at a few points where the test can see it.

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts">
	import { LoadingScreen, createLoading } from "@rolarie/sdk/loading";
	import { Rectangle, type Application } from "pixi.js";
	import { Container, Graphics, Sprite, Stage, Text } from "@rolarie/sdk/pixi";
	import Frames from "./Frames.svelte";

	let moved = $state(false);
	let shown = $state(true);
	let pressed = $state(0);
	let frames = $state(0);
	let app: Application | null = null;

	// Up from the first line, as in a game, and following the stage as it loads.
	const loading = createLoading();

	/** One pixel of what is drawn, as "red,green,blue". */
	function pixelAt(x: number, y: number): string {
		const { pixels } = app!.renderer.extract.pixels({
			target: app!.stage,
			frame: new Rectangle(x, y, 1, 1)
		});

		return [pixels[0], pixels[1], pixels[2]].join(",");
	}

	/** Writes what is drawn at each place the test looks, and how the stage stands. */
	function read() {
		const { dataset } = document.body;

		dataset.left = pixelAt(20, 20);
		dataset.right = pixelAt(170, 20);
		dataset.picture = pixelAt(80, 20);
		dataset.group = pixelAt(120, 70);
		dataset.words = String(app!.stage.children.some((child) => "text" in child));
		dataset.pieces = String(app!.stage.children.length);
		dataset.pressed = String(pressed);
		dataset.frames = String(frames);
	}
</script>

<LoadingScreen {loading} title="Pixi from Svelte" />

<div class="room">
	<Stage
		width={200}
		height={100}
		pictures={{ tile: "./tile.png" }}
		label="A test drawing"
		track={(work) => {
			// As a game's page does (GamePage.svelte): a stage that cannot be made is said on the screen.
			work.catch((error: unknown) => loading.fail(error));

			return loading.track(work);
		}}
		onready={(made) => {
			app = made;
			void loading.done().then(() => (document.body.dataset.ready = "true"));
		}}
	>
		<Graphics
			x={moved ? 150 : 0}
			draw={(shape) => shape.rect(0, 0, 40, 40).fill(0xff0000)}
		/>

		{#if shown}
			<Sprite texture="tile" x={60} width={40} height={40} />
		{/if}

		<Text
			text="{pressed} presses"
			x={4}
			y={60}
			style={{ fill: 0xffffff, fontSize: 12 }}
		/>

		<Container x={100} y={50}>
			<Graphics
				draw={(shape) => shape.rect(0, 0, 40, 40).fill(0x0000ff)}
				onpress={() => (pressed += 1)}
			/>
		</Container>

		<Frames onframe={() => (frames += 1)} />
	</Stage>
</div>

<button onclick={() => (moved = !moved)}>Move</button>
<button onclick={() => (shown = !shown)}>Picture</button>
<button onclick={read}>Read</button>

<style>
	/* The stage's own measure on the screen, so that a pixel read is a pixel drawn. */
	.room {
		width: 200px;
	}
</style>
