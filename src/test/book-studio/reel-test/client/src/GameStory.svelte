<!--
The whole of Reel Test in a story, in one of its two views, played from its real book
with nothing of the site behind it (./story-host.ts).

Author: dwclake
Created: 2026-11-18
-->
<script lang="ts">
	import type { Shape } from "@rolarie/sdk/views";
	import StoryFrame from "@rolarie/sdk/story";
	import Game from "./Game.svelte";
	import { storyHost } from "./story-host.ts";
	import "./style.css";

	interface Props {
		/** A spin that pays, in place of whatever the book gives. */
		winning?: boolean;
		/** The view to show, in a frame of its shape. */
		shape?: Shape;
	}

	let { winning = false, shape = "wide" }: Props = $props();

	/** What the game last announced: on the site, the site says it to a screen reader. */
	let said = $state("");
</script>

<!-- The game fills its frame on the site: here, a box of a frame's shape. -->
{#key `${winning} ${shape}`}
	<StoryFrame {shape} {said}>
		<Game host={storyHost(winning, (text) => (said = text))} show={shape} />
	</StoryFrame>
{/key}
