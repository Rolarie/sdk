<!--
Reel Test, the game: what it knows (./game.svelte.ts), and its two views, wide and tall,
which only draw that. Which view is shown is not the game's to say: `Views` shows the one
it is told to by whoever hosts it.

`host` is the site, or in a story something that plays rounds from the book in its place.

Author: dwclake
Created: 2026-11-18
-->
<script lang="ts">
	import { untrack } from "svelte";
	import type { GameHost } from "@rolarie/sdk/client";
	import { provideEmitter } from "@rolarie/sdk/emitter";
	import { Views, type Shape } from "@rolarie/sdk/views";
	import { ReelTest } from "./game.svelte.ts";
	import type { RoundView, StageEvent } from "./round.ts";
	import TallView from "./TallView.svelte";
	import WideView from "./WideView.svelte";

	interface Props {
		host: GameHost<RoundView, null>;
		/** Follows the stage as it loads: a loading screen's `track`. */
		track?: <Work>(work: Promise<Work>) => Promise<Work>;
		/** Called once the game is ready to be played. */
		onready?: () => void;
		/** The view to show whatever the host says: for a story of one view. */
		show?: Shape;
	}

	let { host: given, track, onready, show }: Props = $props();

	// The site a game is played on does not change under it.
	const host = untrack(() => given);
	const game = new ReelTest(host, provideEmitter<StageEvent>());
</script>

<Views {host} wide={WideView} tall={TallView} props={{ game, track, onready }} {show} />
