<!--
A game's page: everything between the site and the game that is the same in every game.
It shows the loading screen from its first moment, answers the site, asks for the game's
own code, and once both have come hands the game the site (`host`), a way to tell the
loading screen of its own progress (`track`), and a call for when it is ready to be played
(`onready`), at which the loading screen is taken away. A client's page is this and
nothing else:

    <GamePage
      title="Game Title"
      logo="./loading-logo.svg"
      look={{ surface: "#173341", fill: "#ffd56b" }}
      game={() => import("../Game.svelte")}
    />

The page is rendered when the client is built, with no browser and no site, so the game is
asked for only once the page is in a browser: write `game` as a function that imports it,
which also lets the build split the game's code from the page's.

Author: dwclake
Created: 2026-11-19
-->
<script lang="ts">
	import { onMount, type Component } from "svelte";
	import { connect, type GameHost } from "./client.ts";
	import type { LoadingLook } from "./loading-look.ts";
	import { LoadingScreen, createLoading } from "./loading.ts";

	/** What a game's root component is given by its page. */
	export interface GameProps<View = unknown, Progress = unknown> {
		/** The site, or in a story something that plays rounds from the books in its place. */
		host: GameHost<View, Progress>;
		/**
		 * Follows a piece of work as it loads: hand it the stage's, and the loading screen's bar
		 * fills with it. Work that fails here is taken to mean the game cannot be played: the
		 * loading screen says so and offers to try again.
		 */
		track?: <Work>(work: Promise<Work>) => Promise<Work>;
		/** Called once the game is ready to be played. */
		onready?: () => void;
	}

	interface Props {
		/** The game's name: the page's title, and what the loading screen says. */
		title: string;
		/** The studio's logo over the name on the loading screen, as an address in the client. */
		logo?: string;
		/** How the loading screen looks (./loading-look.ts). */
		look?: LoadingLook;
		/** The game's root component, imported when the page is in a browser. */
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		game: () => Promise<{ default: Component<any> }>;
		/**
		 * Typefaces to have before the game is shown, each as `document.fonts.load` takes one.
		 * The control bar's own, left out.
		 */
		fonts?: string[];
	}

	let {
		title,
		logo,
		look,
		game,
		fonts = ['500 15px "Geist Variable"']
	}: Props = $props();

	const loading = createLoading();

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	let loaded = $state.raw<{
		Game: Component<any>;
		host: GameHost<unknown, unknown>;
	} | null>(null);

	/** How often the game's code is asked for before it is given up on. */
	const CODE_TRIES = 3;

	/**
	 * The game's own code, asked for again where it does not come: a phone's connection
	 * drops one request in many, and the game then never arrived.
	 */
	async function gameCode() {
		for (let attempt = 1; ; attempt++) {
			try {
				return await game();
			} catch (error) {
				if (attempt === CODE_TRIES) throw error;

				// A moment longer before each new asking.
				await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
			}
		}
	}

	// Up first: the site's answer, the game's own code, and its typefaces. Whatever of it
	// does not come is said on the loading screen, which then offers to try again.
	onMount(async () => {
		try {
			const typefaces = fonts.map((face) =>
				loading.track(document.fonts.load(face).catch(() => null))
			);
			const [host, code] = await Promise.all([
				loading.track(connect(), 2),
				loading.track(gameCode(), 2)
			]);
			await Promise.all(typefaces);

			loaded = { Game: code.default, host };
		} catch (error) {
			loading.fail(error);
		}
	});

	/**
	 * Follows a piece of the game's own loading (its stage, with its pictures). What the
	 * game hands over here is what it cannot be played without, so if it fails the loading
	 * screen says so: left alone, the bar filled and the game never came.
	 */
	function track<Work>(work: Promise<Work>): Promise<Work> {
		work.catch((error: unknown) => loading.fail(error));

		return loading.track(work, 2);
	}
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<LoadingScreen {loading} {title} {logo} {look} />

{#if loaded}
	<loaded.Game
		host={loaded.host}
		{track}
		onready={() => {
			document.body.dataset.ready = "true";
			void loading.done();
		}}
	/>
{/if}
