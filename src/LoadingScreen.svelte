<!--
A game's loading screen: over the whole game until it is ready, with a bar that fills as
what the game waits for arrives (./loading.ts, which says how a game uses it).

How it looks is the studio's, through its props, so that it can look like the game it
gives way to: `look` is its ground, colours, typeface and bar (./loading-look.ts), and
`logo` the studio's picture over the game's name. Where it is and what it covers are not
a studio's to change (./loading.css).

A client's page is rendered when it is built, so this is in the page as its props dress
it, before any code has arrived. Nothing here may be worked out only in a browser.

Author: dwclake
Created: 2026-11-18
-->
<script lang="ts">
	import "./loading.css";
	import { lookStyle, type LoadingLook } from "./loading-look.ts";
	import type { Loading } from "./loading.ts";

	interface Props {
		/** What the game tells the screen: from `createLoading()`. */
		loading: Loading;
		/** The game's name, over the bar. */
		title?: string;
		/**
		 * The studio's logo, drawn over the name: a picture imported by the page, or the
		 * address of one in the client's `public` folder (`"./loading-logo.svg"`).
		 */
		logo?: string;
		/** How the screen looks, to match the game it gives way to. */
		look?: LoadingLook;
	}

	let { loading, title, logo, look = {} }: Props = $props();
</script>

<!-- `data-waiting`: until the game's code runs, the page's own script fills the bar
     (./loading-first.js). The bar's fill is drawn by `loading`, never from here. -->
<div
	class="sdk-loading sdk-loading-first"
	data-waiting
	style={lookStyle(look)}
	{@attach loading.screen}
>
	{#if logo}
		<img class="sdk-loading-logo" src={logo} alt="" />
	{/if}
	{#if title}
		<p class="sdk-loading-title">{title}</p>
	{/if}
	<div
		class="sdk-loading-bar"
		role="progressbar"
		aria-label={title ? `Loading ${title}` : "Loading"}
		aria-valuemin="0"
		aria-valuemax="100"
		aria-valuenow="0"
	>
		<div class="sdk-loading-fill"></div>
	</div>
	<!-- Shown only when the game has stalled or cannot load (`data-problem`, set by `loading`,
	     which also writes the words): what has happened, and a way to try again. -->
	<div class="sdk-loading-trouble">
		<p class="sdk-loading-problem" role="status"></p>
		<button type="button" class="sdk-loading-again">Try again</button>
	</div>
</div>
