<!--
A control bar's frame: what makes a bar a bar, with nothing drawn. It holds the bar's
state (the bet, the speed, autoplay, the balance, the last win) and gives it to the items
inside it, which may be anywhere in it, in one part or several (./BarPart.svelte). It
measures the game, says what room the bar takes, and hands the game the bar (`bind:bar`).

The SDK's own bar (./ControlBar.svelte) is a frame with the items laid out in it. A studio
that wants another bar writes its own frame the same way:

    <BarFrame {bets} {startBet} {limits} {play} {onplay} {balance} {win} {busy} bind:bet bind:bar>
      <BarPart inset={16} look={{ surface: "#0008", radius: "44px" }}>
        <BarMenu /><BarBalance /><BarBet /><BarPlay /><BarAutoplay /><BarSpeed /><BarWin />
      </BarPart>
    </BarFrame>

Every bar shows the balance, the bet and play: a frame without one of them throws. The
frame covers the game and takes no presses itself; its parts do.

Author: dwclake
Created: 2026-11-19
-->
<script lang="ts">
	import { untrack, type Snippet } from "svelte";
	import "../ui.css";
	import "../bar.css";
	import {
		BAR_SCALE,
		POPUP_SCALE,
		REQUIRED_ITEMS,
		type BarHandle
	} from "../bar-rules.ts";
	import { barProperties, dress, type BarLook } from "../look.ts";
	import { getView } from "../view.svelte.ts";
	import { BarState, provideBar, type BarOptions } from "./bar-state.svelte.ts";

	interface Props extends BarOptions {
		/** How the bar looks: its colours, typefaces and buttons (../look.ts). It may change. */
		look?: BarLook;
		/** Its size against the usual: from 0.8 to 2.5. A tall view's is about twice a wide one's. */
		scale?: number;
		/**
		 * How big what its buttons open is (the bets, autoplay, the menu), against the bar
		 * itself: from 1 to 2. As big as the bar, left out. A view shown small says more: a
		 * tall view is shown on a phone at well under half its size, where a bet in a list
		 * must still be as big as a thumb, so it passes about 1.5.
		 */
		popups?: number;
		/** The player's balance, in cents. */
		balance: number;
		/**
		 * What the last play won, in cents: 0 when a play starts, and what it won once that is
		 * shown. The bar keeps the last win of more than nothing in view: green while it is the
		 * last play's, greyed once a later play has started or won nothing.
		 */
		win?: number;
		/** While a round is played or shown: the bet cannot be changed, nor play pressed. */
		busy?: boolean;
		/** How many plays of autoplay are left, as the game counts them down. */
		autoLeft?: number;
		/** What the next play will cost, when that is not the bet itself. `null` for the bet. */
		cost?: number | null;
		/** What the bet is called, one of `betLabels`. `null` for "Bet". */
		betLabel?: string | null;
		/** Free spins left, shown on the play button. `null` gives the button back. */
		freeSpins?: number | null;
		/** More about the play button for a screen reader. */
		playDescription?: string;
		/** Out: the bet chosen, in cents. */
		bet?: number;
		/** Out: the bar itself. */
		bar?: BarHandle;
		/** Called once the bar is made and in the page. */
		onready?: (bar: BarHandle) => void;
		/** The bar's parts and items. */
		children: Snippet;
	}

	let {
		look,
		scale = 1,
		popups = 1,
		balance,
		win,
		busy,
		autoLeft,
		cost,
		betLabel,
		freeSpins,
		playDescription,
		bet = $bindable(),
		bar = $bindable(),
		onready,
		children,
		...options
	}: Props = $props();

	const shared = provideBar(new BarState(() => options));
	/** The view the bar is in, if it is in one: it is measured on the screen and said in the view's pixels. */
	const view = getView();

	let root = $state<HTMLElement>();
	let container: HTMLElement | undefined;
	let inset = { top: 0, bottom: 0 };

	// What the bar shows follows the frame's props, where they are given.
	$effect(() => {
		shared.balance = balance;
	});
	$effect(() => {
		if (win !== undefined) shared.setWin(win);
	});
	$effect(() => {
		if (busy !== undefined) shared.busy = busy;
	});
	$effect(() => {
		if (autoLeft !== undefined) shared.left = Math.max(0, autoLeft);
	});
	$effect(() => {
		if (cost !== undefined) shared.cost = cost;
	});
	$effect(() => {
		if (betLabel !== undefined) shared.setBetLabel(betLabel);
	});
	$effect(() => {
		if (freeSpins !== undefined) shared.setFreeSpins(freeSpins);
	});
	$effect(() => {
		if (playDescription !== undefined) shared.playLabel = playDescription;
	});
	// And the bet chosen goes back to whoever bound it, at once.
	shared.onBet((next) => (bet = next));

	/** The bar's parts, as they are in the page now. */
	const parts = () => [
		...(root?.querySelectorAll<HTMLElement>(":scope > .sdk-bar-part") ?? [])
	];

	/** The part a game's own button is placed beside: the one at the bottom, or the first. */
	const mainPart = () =>
		parts().find((part) => part.dataset.edge === "bottom") ?? parts()[0];

	/**
	 * Sizes the bar, and measures what room its parts take at the game's top and bottom.
	 */
	function place() {
		if (!root || !container) return;

		const width = container.clientWidth;
		const height = container.clientHeight;
		if (!root.isConnected || !width || !height) return;

		// As big as asked, within what a bar may be: it is drawn at the size of the game's
		// view, and scaled with it, so there is nothing to fit it to.
		const sized = Math.max(BAR_SCALE.min, Math.min(BAR_SCALE.max, scale));

		root.style.setProperty("--bar-s", String(Math.round(sized * 1000) / 1000));
		root.style.setProperty(
			"--bar-popups",
			String(Math.max(POPUP_SCALE.min, Math.min(POPUP_SCALE.max, popups)))
		);

		// Rounded up, from the game's exact height (`clientHeight` is rounded to a whole pixel):
		// a game drawing clear of the bar must never be a fraction of a pixel under it.
		// Measured on the screen, and said in the view's own pixels: a view is scaled as a
		// whole, and what draws clear of the bar is laid out in the view's measure.
		const shrunk = view?.scale || 1;
		const origin = container.getBoundingClientRect();
		const next = { top: 0, bottom: 0 };
		for (const part of parts()) {
			const box = part.getBoundingClientRect();
			if (!box.width || !box.height) continue;

			// The clear room a part asks for beyond itself, at the bar's size.
			const gap = Number(part.dataset.gap ?? 0) * sized;

			if (part.dataset.edge === "top")
				next.top = Math.max(
					next.top,
					Math.ceil((box.bottom - origin.top) / shrunk + gap - 0.01)
				);
			else
				next.bottom = Math.max(
					next.bottom,
					Math.ceil((origin.bottom - box.top) / shrunk + gap - 0.01)
				);
		}

		inset = next;
		container.style.setProperty("--sdk-bar-top", `${inset.top}px`);
		container.style.setProperty("--sdk-bar-bottom", `${inset.bottom}px`);
	}

	/** Where an element is in the game, in pixels from its top left. */
	function rectOf(element: HTMLElement | undefined) {
		const box = element?.getBoundingClientRect();
		const origin = container?.getBoundingClientRect();
		if (!box || !origin) return { left: 0, top: 0, width: 0, height: 0 };

		const shrunk = view?.scale || 1;

		return {
			left: (box.left - origin.left) / shrunk,
			top: (box.top - origin.top) / shrunk,
			width: box.width / shrunk,
			height: box.height / shrunk
		};
	}

	/** The bar as a game holds it: what it may ask of the bar and tell it. */
	const api: BarHandle = {
		get element() {
			return mainPart()!;
		},
		get bet() {
			return shared.stake;
		},
		get speed() {
			return shared.speed;
		},
		quick: (inBonus) => shared.quick(inBonus),
		pace: (inBonus) => shared.pace(inBonus),
		get volume() {
			return shared.volume;
		},
		get busy() {
			return shared.busy;
		},
		set busy(next: boolean) {
			shared.busy = next;
		},
		get autoLeft() {
			return shared.left;
		},
		set autoLeft(next: number) {
			shared.left = Math.max(0, next);
		},
		setBalance: (cents) => void (shared.balance = cents),
		setWin: (cents) => shared.setWin(cents),
		setCost: (cents) => void (shared.cost = cents),
		setBetLabel: (label) => shared.setBetLabel(label),
		setFreeSpins: (spins) => shared.setFreeSpins(spins),
		onBet: (listener) => shared.onBet(listener),
		describePlay: (label) => void (shared.playLabel = label),
		focusPlay: () => shared.playElement?.focus({ preventScroll: true }),
		top: () => rectOf(mainPart()).top,
		rect() {
			place();

			return rectOf(mainPart());
		},
		inset() {
			place();

			return inset;
		}
	};

	/**
	 * Once the frame is drawn: it is told what it is placed in, marks that as where its popups
	 * must keep, and measures again whenever the game or one of its parts changes size.
	 */
	function mount(frame: HTMLElement) {
		for (const item of REQUIRED_ITEMS)
			if (!shared.items.has(item))
				throw new Error(
					`A bar must show the balance, the bet and play: this one has no ${item}.`
				);

		// In a game's view, the view: the bar is placed in the picture, and scaled with it.
		container = frame.closest<HTMLElement>(".sdk-view") ?? document.documentElement;
		// The bar's popups keep inside it (Popup.svelte).
		container.dataset.sdkBounds = "";

		const watcher = new ResizeObserver(place);
		watcher.observe(container);

		// Parts come and go as the layout changes (a narrow game has other parts than a wide one).
		const watch = () => {
			for (const part of parts()) watcher.observe(part);
			place();
		};
		const comings = new MutationObserver(watch);
		comings.observe(frame, { childList: true });
		watch();

		shared.measures = {
			element: mainPart,
			inset: () => api.inset(),
			rect: () => api.rect()
		};

		untrack(() => {
			bet = shared.stake;
			bar = api;
			onready?.(api);
		});

		return () => {
			watcher.disconnect();
			comings.disconnect();
			bar = undefined;
		};
	}

	// The bar is drawn in the browser only. It is placed by measuring the game it is in, which
	// a server cannot do, and a page drawn by a server shows its own loading until the bar is in.
	// Known from the start, not found out in an effect: a page being taken over from a
	// server must not have what it draws change under it part way.
	const drawn = typeof document !== "undefined";

	// A bar made bigger or smaller is measured anew, and so is one whose view is scaled another way.
	$effect(() => {
		void scale;
		void popups;
		void view?.scale;
		place();
	});
</script>

{#if drawn}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="sdk-bar-frame"
		{@attach dress(() => barProperties(look))}
		bind:this={root}
		onkeydown={(event) => {
			// Escape puts away autoplay that is waiting. With the popup open, the popup takes it to close.
			if (event.key !== "Escape" || shared.ready === 0 || shared.left > 0) return;

			shared.ready = 0;
		}}
		{@attach mount}
	>
		{@render children()}
	</div>
{/if}

<style>
	/* The frame: over the whole game, taking no presses itself. Its parts do. */
	.sdk-bar-frame {
		position: absolute;
		z-index: 4;
		inset: 0;
		box-sizing: border-box;
		pointer-events: none;
		color: var(--bar-ink, #f2f2f2);
		font:
			500 calc(15px * var(--s))/1.2 var(--bar-font, "Geist Variable"),
			ui-sans-serif,
			system-ui,
			sans-serif;
		user-select: none;
		/* A double tap on a button, even a disabled one, does not zoom the game. */
		touch-action: manipulation;
	}

	.sdk-bar-frame > :global(*) {
		pointer-events: auto;
	}
</style>
