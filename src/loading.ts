/**
 * A game's loading screen: over the whole game from the first moment, with a bar that
 * fills as what the game waits for arrives, and gone only once the game under it has
 * been drawn. A game is put together a piece at a time, and none of that is to be seen.
 *
 * The screen is a component (./LoadingScreen.svelte), in the game's page, and what the
 * game waits for is told to a `Loading` it is given:
 *
 *     <script lang="ts">
 *         const loading = createLoading();
 *
 *         onMount(async () => {
 *             const host = await loading.track(connect(), 2);
 *             ...
 *             await loading.done();
 *         });
 *     </script>
 *
 * A game that cannot finish loading says so (`loading.fail()`), and one from which nothing
 * has arrived for twenty seconds is taken to have stalled: either way the screen says
 * what has happened and offers to try again, which loads the page anew. A loading screen
 * never just stops.
 *
 *     <LoadingScreen {loading} title="Game Title" logo="./loading-logo.svg" look={{ ... }} />
 *
 * A client's page is rendered when it is built (./client-build.ts), so the screen is in
 * the page itself, as its props dress it, and is seen before any of the game's code has
 * arrived. Until that code runs, the bar is filled by a script of the page's own as the
 * code arrives (./loading-first.js); then the component takes the screen over, and what
 * the game tracks fills the rest of the bar from where the code left it.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */
import type { LoadingLook } from "./loading-look.ts";

export { default as LoadingScreen } from "./LoadingScreen.svelte";
export type { LoadingLook };

export interface Loading {
	/**
	 * Waits for `work` as part of loading, and returns it. The bar fills by `weight` when
	 * it settles, whether it succeeded or failed: handle a failure where `work` is awaited.
	 */
	track<T>(work: Promise<T>, weight?: number): Promise<T>;
	/** How much is loaded, from 0 to 1, for work the screen cannot see. The bar never goes back. */
	set(share: number): void;
	/**
	 * Fills the bar and takes the screen away, once what is under it has been drawn. Call it
	 * when the game is ready to be seen and played.
	 */
	done(): Promise<void>;
	/**
	 * Says the game cannot finish loading (its code or a picture did not come, the browser
	 * would not draw it): the screen says so and offers to try again, which loads the page
	 * anew. `why` goes to the console, for whoever is looking into it.
	 */
	fail(why?: unknown): void;
	/**
	 * The screen this fills: the loading screen's own, given by the component as an
	 * attachment. A game never calls it.
	 */
	screen(element: HTMLElement): void;
}

/**
 * Waits until the page has been drawn twice more: once for what was just set up, and once
 * for what that drawing itself set off. A page that is not being drawn at all (a tab in the
 * background) is not waited for.
 */
function drawn(): Promise<void> {
	return new Promise((resolve) => {
		const giveUp = window.setTimeout(resolve, 500);

		requestAnimationFrame(() =>
			requestAnimationFrame(() => {
				window.clearTimeout(giveUp);
				resolve();
			})
		);
	});
}

/** How long nothing may arrive before the screen offers to try again, in milliseconds. */
const STALLED_MS = 20_000;

/** What the screen says when it offers to try again. */
const SAYS = {
	stalled: "This is taking longer than usual.",
	failed: "The game did not finish loading."
};

/** What a game tells its loading screen: made where the game starts, and given to the screen. */
export function createLoading(): Loading {
	let screen: HTMLElement | undefined;
	/** How full the bar was when the game took it over: what it tracks fills the rest. */
	let from = 0;

	// What is tracked, by weight, and what has settled of it; and a share set directly.
	let total = 0;
	let settled = 0;
	let direct = 0;
	let shown = 0;
	let waiting: number | undefined;
	/** The screen is gone, or going: nothing more is said on it. */
	let over = false;
	let failed = false;
	let stalling: number | undefined;

	/**
	 * Has the screen say what is wrong and offer to try again (its `data-problem` shows the
	 * words and the button: ./loading.css). A game that has only stalled may still arrive,
	 * and the screen then goes as it would have.
	 */
	function offerAgain(problem: keyof typeof SAYS) {
		if (!screen || over) return;

		screen.dataset.problem = problem;
		const words = screen.querySelector<HTMLElement>(".sdk-loading-problem");
		if (words) words.textContent = SAYS[problem];
	}

	/** Starts the wait again: something has arrived, so the game is not stalled. */
	function stillComing() {
		window.clearTimeout(stalling);
		if (over || failed) return;

		// Whatever it said while it waited is taken back.
		if (screen?.dataset.problem === "stalled") delete screen.dataset.problem;

		stalling = window.setTimeout(() => offerAgain("stalled"), STALLED_MS);
	}

	/** Draws the bar as full as what has settled makes it. */
	function render() {
		window.clearTimeout(waiting);
		waiting = undefined;
		if (!screen) return;

		// Never back: tracking more work after some has settled must not empty the bar.
		const tracked = Math.max(direct, total ? settled / total : 0);
		shown = Math.max(shown, from + (1 - from) * tracked);

		const bar = screen.querySelector<HTMLElement>(".sdk-loading-bar");
		const fill = screen.querySelector<HTMLElement>(".sdk-loading-fill");
		fill?.style.setProperty("transform", `scaleX(${shown})`);
		bar?.setAttribute("aria-valuenow", String(Math.round(shown * 100)));
	}

	/**
	 * Draws the bar a moment from now, not at once. A game tracks its next work as soon as
	 * what that waits for has settled (the stage, once the site has answered), and for that
	 * instant everything tracked has settled: drawn then, the bar would be full with work
	 * still to come, and could not go back.
	 */
	function renderSoon() {
		waiting ??= window.setTimeout(render, 0);
	}

	return {
		track(work, weight = 1) {
			total += weight;
			const done = () => {
				settled += weight;
				stillComing();
				renderSoon();
			};
			work.then(done, done);

			return work;
		},

		set(share) {
			const next = Math.min(1, Math.max(0, share));
			if (next > direct) stillComing();

			direct = next;
			renderSoon();
		},

		async done() {
			over = true;
			window.clearTimeout(stalling);
			direct = 1;
			render();
			if (!screen) return;

			delete screen.dataset.problem;

			// What the game set up as it became ready (the stage's first picture, words in a
			// typeface just arrived) is drawn over the next frames: the screen stays for them.
			await drawn();

			screen.classList.add("leaving");
			const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
			// As long as it takes to fade (./loading.css).
			await new Promise((resolve) => setTimeout(resolve, still ? 0 : 200));
			screen.hidden = true;
		},

		fail(why) {
			if (over || failed) return;

			failed = true;
			window.clearTimeout(stalling);
			console.error("The game did not finish loading.", why ?? "");
			offerAgain("failed");
		},

		screen(element) {
			screen = element;
			// A failure said before the screen was there is said on it now.
			if (failed) offerAgain("failed");
			else stillComing();

			element
				.querySelector<HTMLButtonElement>(".sdk-loading-again")
				?.addEventListener("click", () => location.reload());
			// The page's own script, which filled the bar as the code arrived, stops at this.
			element.removeAttribute("data-waiting");
			from = Math.min(1, Math.max(0, Number(element.dataset.shown) || 0));
			shown = from;
			render();
		}
	};
}
