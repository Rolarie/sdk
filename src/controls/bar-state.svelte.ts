/**
 * What a control bar knows, shared by its items: the bet, the speed, whether a round is
 * under way, autoplay waiting or running, the balance and the last win. A `BarFrame`
 * makes one and gives it to every item inside it, so the items are the same bar wherever
 * a studio puts them.
 *
 * Author: dwclake
 * Created: 2026-11-19
 */

import { getContext, setContext, untrack, type Snippet } from "svelte";
import {
	AUTOPLAY_COUNTS,
	BET_LABEL_LENGTH,
	PACES,
	SPEEDS,
	type BarItem,
	type Speed,
	type StakeSteps
} from "../bar-rules.ts";
import { stakeLadder } from "../stake-steps.ts";

/** What a bar is made with: its bets, what play does, and what the game is told. */
export interface BarOptions {
	/** The bets on offer, in cents: a list, or the steps the bet buttons move by. */
	bets: number[] | { steps: StakeSteps };
	startBet: number;
	limits: { minStake: number; maxStake: number };
	/** Other names for the bet, which `betLabel` may show in place of "Bet". */
	betLabels?: string[];
	/** What the big button does: its name for a screen reader, and how it is drawn. */
	play: { label: string; symbol: "spin" | "play" };
	onplay: () => void;
	/** Left out for a game that cannot play by itself: the button is not drawn. */
	autoplay?: {
		/** How many plays can be chosen. Ten to a hundred by tens, left out. */
		counts?: readonly number[];
		/** What is played, singular and plural: `["spin", "spins"]`. */
		noun: [one: string, many: string];
		onstart: (count: number) => void;
		onstop: () => void;
		/** More settings for the autoplay popup. */
		content?: Snippet;
	};
	/** The speeds the button goes through. All three, left out. */
	speeds?: "turbo" | "fast" | "none";
	onspeed?: (speed: Speed) => void;
	onvolume?: (volume: number) => void;
	onbet?: (bet: number) => void;
}

/** What a bar's frame measures for it: where its parts are in the game. */
export interface BarMeasures {
	/** The part a game's own button is placed beside: the one at the bottom, or the first. */
	element(): HTMLElement | undefined;
	inset(): { top: number; bottom: number };
	rect(): { left: number; top: number; width: number; height: number };
}

/** A bar's state. Its items read it where they are drawn and change it as they are pressed. */
export class BarState {
	/** The options as they are now: what the game is told may change under the bar. */
	readonly #options: () => BarOptions;
	/** The bets on offer, inside what the game takes. Fixed when the bar is made. */
	readonly bets: readonly number[];
	/** Every name the bet can have. */
	readonly names: readonly string[];

	stake = $state(0);
	busy = $state(false);
	speed = $state<Speed>(0);
	volume = $state(1);
	/** What the next play costs, when that is not the bet. */
	cost = $state<number | null>(null);
	betName = $state("Bet");
	freeSpins = $state<number | null>(null);
	playLabel = $state("");
	/** Autoplay's plays left, and the plays chosen and waiting for play. */
	left = $state(0);
	ready = $state(0);
	// Not read from the game while the bar is set up, only once it is in the page: a page
	// may hand over a balance it is still waiting for.
	balance = $state(0);
	win = $state(0);
	/** Whether the win in view is the last play's own. Otherwise it is an earlier play's, greyed. */
	winFresh = $state(false);

	/** The offers either side of the bet. */
	readonly lower = $derived.by(() => this.bets.findLast((offer) => offer < this.stake));
	readonly higher = $derived.by(() => this.bets.find((offer) => offer > this.stake));
	/** While a round is played or autoplay runs: the bet cannot be changed. */
	readonly locked = $derived(this.busy || this.left > 0);
	/**
	 * What play's button shows: its own symbol, or free spins left, or autoplay waiting for it
	 * (a triangle and how many), or running (a square and how many are left).
	 */
	readonly face = $derived(
		this.freeSpins !== null
			? "free"
			: this.left > 0
				? "stop"
				: this.ready > 0
					? "ready"
					: "play"
	);
	readonly faceCount = $derived(this.freeSpins ?? (this.left || this.ready));
	readonly playName = $derived(
		this.freeSpins !== null
			? `Free spins, ${this.freeSpins} left`
			: this.left > 0
				? `Stop autoplay, ${this.plays(this.left)} left`
				: this.ready > 0
					? `Start autoplay, ${this.plays(this.ready)}`
					: this.playLabel
	);

	/** The items in the bar, by name: a bar must show the balance, the bet and play. */
	readonly items = new Set<BarItem>();
	/** Play's button, for `focusPlay()`. */
	playElement: HTMLButtonElement | undefined;
	/** Set by the frame once it is in the page. */
	measures: BarMeasures | undefined;
	readonly #betListeners: ((bet: number) => void)[] = [];

	constructor(options: () => BarOptions) {
		this.#options = options;

		const { bets, limits, startBet, betLabels, play } = untrack(options);

		this.bets = (
			Array.isArray(bets)
				? bets
				: stakeLadder({ min: limits.minStake, max: limits.maxStake }, bets.steps)
		).filter((offer) => offer >= limits.minStake && offer <= limits.maxStake);

		// Each name is as long as the label has room for, or the bar is not made.
		this.names = ["Bet", ...(betLabels ?? [])];
		for (const name of this.names)
			if (!name.trim() || name.length > BET_LABEL_LENGTH)
				throw new Error(
					`A name for the bet must be 1 to ${BET_LABEL_LENGTH} characters: "${name}".`
				);

		// The bet to begin with: the one asked for, or if that is not on offer, the nearest below it.
		this.stake = this.bets.includes(startBet)
			? startBet
			: (this.bets.findLast((offer) => offer <= startBet) ?? this.bets[0]);
		this.playLabel = play.label;
	}

	/** The options as they are now. */
	get options(): BarOptions {
		return this.#options();
	}

	/** The plays autoplay offers. */
	get counts(): readonly number[] {
		return this.options.autoplay?.counts ?? AUTOPLAY_COUNTS;
	}

	/** So many plays, in the game's own word for them: "10 spins". */
	plays(count: number): string {
		const [one, many] = this.options.autoplay?.noun ?? ["play", "plays"];

		return `${count} ${count === 1 ? one : many}`;
	}

	/** Sets the bet, and tells whoever asked to be told. */
	setBet(next: number) {
		this.stake = next;
		this.options.onbet?.(next);
		for (const listener of this.#betListeners) listener(next);
	}

	onBet(listener: (bet: number) => void) {
		this.#betListeners.push(listener);
	}

	/** Play: stops autoplay that is running, starts autoplay that is waiting, or plays once. */
	pressPlay() {
		const { autoplay, onplay } = this.options;
		if (this.left > 0) return autoplay?.onstop();

		if (this.ready > 0) {
			const count = this.ready;

			this.ready = 0;

			return autoplay?.onstart(count);
		}

		onplay();
	}

	/** One press of the speed button goes on to the next speed, and round again. */
	nextSpeed() {
		const speeds = this.options.speeds ?? "turbo";

		this.speed = ((this.speed + 1) %
			(speeds === "fast" ? 2 : SPEEDS.length)) as Speed;
		this.options.onspeed?.(this.speed);
	}

	/**
	 * What the last play won. Only a win of more than nothing replaces the one in view; nothing
	 * won, or a play starting, leaves it there and greys it.
	 */
	setWin(cents: number) {
		if (cents > 0) this.win = cents;

		this.winFresh = cents > 0;
	}

	/** What the bet is called, one of the names the bar was made with. */
	setBetLabel(label: string | null) {
		const next = label ?? "Bet";
		if (!this.names.includes(next))
			throw new Error(`"${next}" is not one of the bar's betLabels.`);

		this.betName = next;
	}

	setFreeSpins(spins: number | null) {
		this.freeSpins = spins === null ? null : Math.max(0, spins);
	}

	/** Whether to play quickly now: turbo always, fast outside a bonus. */
	quick(inBonus = false): boolean {
		return this.speed === 2 || (this.speed === 1 && !inBonus);
	}

	/** How long what is played now should take, against the ordinary pace. */
	pace(inBonus = false): number {
		return PACES[this.speed === 1 && inBonus ? 0 : this.speed];
	}
}

const KEY = Symbol("rolarie-bar");
const PART = Symbol("rolarie-bar-part");

/** Gives a bar's state to every item inside the component calling this. */
export function provideBar(state: BarState): BarState {
	return setContext(KEY, state);
}

/** The bar an item is in, which it says it is part of. Throws outside a `BarFrame`. */
export function getBar(item?: BarItem): BarState {
	const state = getContext<BarState | undefined>(KEY);
	if (!state)
		throw new Error("A bar's item must be inside a BarFrame (or a ControlBar).");

	if (item) state.items.add(item);

	return state;
}

/** Says which edge of the game the part these items are in is at. */
export function providePart(edge: () => "top" | "bottom") {
	setContext(PART, edge);
}

/** Which way an item's popup opens: away from the edge its part is at. */
export function popupOpens(): () => "up" | "down" {
	const edge = getContext<(() => "top" | "bottom") | undefined>(PART);

	return () => (edge?.() === "top" ? "down" : "up");
}
