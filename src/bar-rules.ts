/**
 * The control bar's rules, apart from how it is drawn: what it hands a game, the items it
 * is made of and which of them every bar must show, and the bar's symbols. The SDK's bar is
 * ./controls/ControlBar.svelte; its items and the frame that holds them are beside it.
 *
 * Pure: no page is needed to read it.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import type { StakeSteps } from "./stake-steps.ts";

export type { StakeSteps };

/**
 * The bar's symbols, as what is drawn inside each one's 16 by 16 picture. Drawn, so that
 * they need no font and no image to load, and in the manner of the site's own
 * (src/lib/components/Icon.svelte): lines, square ended, nothing filled.
 */
export const SYMBOL_PATHS = {
	spin: '<path d="M13.2 8a5.2 5.2 0 0 1-9.3 3.2"/><path d="M2.8 8a5.2 5.2 0 0 1 9.3-3.2"/><path d="M12.3 2.2V5H9.5"/><path d="M3.7 13.8V11h2.800"/>',
	play: '<path d="M5.5 3.5v9l7-4.500z"/>',
	ready: '<path d="M2.5 1v14L15 8z"/>',
	stop: '<path d="M2.5 2.5h11v11h-11z"/>',
	minus: '<path d="M3 8h10"/>',
	plus: '<path d="M8 3v10M3 8h10"/>',
	auto: '<path d="M13.4 8a5.4 5.4 0 1 1-1.900-4.100"/><path d="M11.800 1.700v2.400H9.400"/><path d="M6.800 6v4L10 8z"/>',
	fast: '<path d="M3.5 4l4 4-4 4"/><path d="M8.500 4l4 4-4 4"/>',
	turbo: '<path d="M2 4l4 4-4 4"/><path d="M6.500 4l4 4-4 4"/><path d="M11 4l4 4-4 4"/>',
	menu: '<path d="M3 4h10M3 8h10M3 12h10"/>'
} as const;

export type BarSymbol = keyof typeof SYMBOL_PATHS;

/** How long play takes at each speed, against the ordinary pace: ordinary, fast and turbo. */
export const PACES = [1, 0.7, 0.5] as const;

/**
 * The bar as a game holds it (`bind:bar` on ./controls/ControlBar.svelte): what a game may
 * ask of the bar and tell it.
 */
export interface BarHandle {
	/** The bar's part along the bottom of the game, or its first: what `rect()` measures. */
	readonly element: HTMLElement;
	/** The bet chosen, in cents. */
	readonly bet: number;
	/** How quick the player has asked play to be: 0 is the ordinary pace, 1 fast, 2 turbo. */
	readonly speed: Speed;
	/**
	 * Whether to play quickly now. Ask at every step, so that a change takes hold
	 * at once. Pass `true` while a bonus is being shown (free spins, a feature):
	 * fast, the first level, quickens ordinary play only, so that what the player
	 * was playing for is still seen at its own pace. Turbo quickens everything.
	 */
	quick(inBonus?: boolean): boolean;
	/**
	 * How long what is played now should take, against the ordinary pace: 1 at the
	 * ordinary pace, less when fast, least at turbo (`PACES`). Multiply a time by it. Ask
	 * at every step. Pass `true` while a bonus is being shown: fast leaves a bonus at the
	 * ordinary pace, and turbo quickens everything.
	 */
	pace(inBonus?: boolean): number;
	/** The volume chosen in the menu, from 0 (off) to 1. */
	readonly volume: number;
	/**
	 * Set while a round is being played or shown. The bet cannot be changed and
	 * the play button cannot be pressed. Autoplay can still be stopped.
	 */
	busy: boolean;
	/**
	 * How many plays of autoplay are left. The game sets it as they run. Autoplay is
	 * readied in its popup and started and stopped by the play button, which shows the
	 * plays waiting or left; the bar calls `autoplay.onStart` and `onStop` for it.
	 */
	autoLeft: number;
	setBalance(cents: number): void;
	/**
	 * What the last play won, in cents: nothing when a play starts, and what it won once
	 * that is shown. The bar keeps the last win of more than nothing in view, in green
	 * while it is the last play's and greyed once a later play has started or won nothing.
	 */
	setWin(cents: number): void;
	/**
	 * What the next play will cost, in cents, when that is not the bet itself: a
	 * boosted spin, say. The bar shows it where the bet is shown, so that what the
	 * player reads is what will leave the balance. Pass `null` to show the bet again.
	 */
	setCost(cents: number | null): void;
	/**
	 * What the bet is called over its amount, when the next play is a kind of its own: a
	 * boosted spin, say. One of the `betLabels` the bar was made with; `null` for "Bet"
	 * again. The segment is as wide as the longest of them from the start, so it never
	 * changes size. Throws on a name not declared.
	 */
	setBetLabel(label: string | null): void;
	/**
	 * Free spins left, shown on the play button over the spin symbol as autoplay's plays
	 * are. While they show, the button cannot be pressed: free spins are not the player's
	 * to stop. `null` gives the button back.
	 */
	setFreeSpins(left: number | null): void;
	/** Called when the player changes the bet. */
	onBet(listener: (bet: number) => void): void;
	/** Says more about the play button to a screen reader, such as what a boosted spin costs. */
	describePlay(label: string): void;
	focusPlay(): void;
	/** Where the top of the bar is, in pixels from the top of the game. For a bar along the bottom; `inset()` answers for any. */
	top(): number;
	/**
	 * The room the bar takes at the top and at the bottom of the game, in pixels:
	 * a game draws between the two. A floating bar counts with whichever edge it
	 * is nearer, from that edge to its far side. The same two figures are kept on
	 * the page as `--sdk-bar-top` and `--sdk-bar-bottom`, for a style sheet.
	 */
	inset(): { top: number; bottom: number };
	/**
	 * Where the bar is in the game, in pixels from its top left, for placing a game's own
	 * button beside it.
	 */
	rect(): { left: number; top: number; width: number; height: number };
}

/** How many plays the bar's autoplay offers, where a game does not say: ten to a hundred, by tens. */
export const AUTOPLAY_COUNTS: readonly number[] = [
	10, 20, 30, 40, 50, 60, 70, 80, 90, 100
];

export type Speed = 0 | 1 | 2;
export const SPEEDS = ["normal", "fast", "turbo"] as const;

/**
 * The bar's items, each a component of its own (./controls): the SDK's bar is made of them,
 * and a studio may make a bar of its own from them. The balance, the bet and play are in
 * every bar; the rest are a studio's to leave out.
 */
export type BarItem = "menu" | "balance" | "bet" | "play" | "autoplay" | "speed" | "win";
/** The items a bar must show: a frame with one missing throws. */
export const REQUIRED_ITEMS: readonly BarItem[] = ["balance", "bet", "play"];
/** What the SDK's own bar may be asked to leave out. */
export type Hideable = "menu" | "win";
/** How much bigger or smaller one item may be than the rest of its bar. */
export const ITEM_SCALE = { min: 0.5, max: 2 };
/**
 * How a bet with minus and plus is laid out: the bet between them (`split`, the default),
 * or plus over minus in a column at the bet's left (`column-start`) or right (`column-end`).
 */
export type BetArrangement = "split" | "column-start" | "column-end";
export const BET_ARRANGEMENTS: readonly BetArrangement[] = [
	"split",
	"column-start",
	"column-end"
];
/**
 * How big a bar may be made against its usual size. Its usual size suits a wide view, drawn
 * 1600 across. A tall view is drawn 900 across and shown on a phone at well under half
 * that, so its bar is made about twice as big to be pressed with a thumb.
 */
export const BAR_SCALE = { min: 0.8, max: 2.5 };

/** How big what a bar's buttons open may be, against the bar (`popups`). */
export const POPUP_SCALE = { min: 1, max: 2 };

/**
 * The most characters a name for the bet may have (`betLabels`). The label is monospace, so
 * that many are no wider than the amount under it, and a name never widens the segment.
 */
export const BET_LABEL_LENGTH = 10;
