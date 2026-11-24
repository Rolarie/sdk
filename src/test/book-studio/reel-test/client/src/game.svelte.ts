/**
 * Reel Test, as the game knows it: the balance, the round, the line of words, and how a
 * spin is played. It is kept here, above the game's two views, which only draw it: a view
 * is made again when the other was showing, and nothing of the game may be lost with it.
 *
 * It plays what the site hands it and decides nothing: a spin is one row of the game's
 * book, and the row's events are played in order, by handlers that tell the reels what to
 * do and wait for them.
 *
 * Author: dwclake
 * Created: 2026-11-19
 */
import type { BarHandle } from "@rolarie/sdk/bar";
import {
	Refusal,
	balanceBeforePayout,
	formatCoins,
	type GameHost
} from "@rolarie/sdk/client";
import type { Emitter } from "@rolarie/sdk/emitter";
import { playEvents, type Handlers } from "@rolarie/sdk/events";
import { LINE_ROW, type Spin } from "../../maths/rules";
import type { RoundView, RowEvent, StageEvent } from "./round.ts";
import { NAMES } from "./symbols.ts";

const wait = (ms: number) => new Promise<void>((done) => setTimeout(done, ms));

/** What a row's events are played with: what the round paid, in cents, and the spin once played. */
interface Playing {
	payout: number;
	spin: Spin | null;
}

/** The game: what its views draw, and what its bar does. */
export class ReelTest {
	balance = $state(0);
	busy = $state(false);
	autoLeft = $state(0);
	win = $state(0);
	/** The line of words: what just happened. */
	message = $state("Choose a bet and spin.");
	/** The bet the bar is set to, in cents, once the bar is made. */
	bet = $state<number>();
	/** The bar itself, for the pace of play. Each view makes its own, at the bet this holds. */
	bar = $state<BarHandle>();

	readonly limits: { minStake: number; maxStake: number };
	/** With nothing moving: the player has asked their device for less motion. */
	readonly still: boolean;

	/** Each of a row's events, played in order: the reels are told, and waited for. */
	private readonly handlers: Handlers<RowEvent, Playing> = {
		spin: async (event, playing) => {
			await this.emitter.broadcast({
				type: "reelsSpin",
				reels: event.reels,
				pace: this.bar?.pace() ?? 1
			});
			if (event.win)
				await this.emitter.broadcast({
					type: "reelsWin",
					text: formatCoins(playing.payout)
				});

			playing.spin = event;
		}
	};

	constructor(
		private readonly host: GameHost<RoundView, null>,
		private readonly emitter: Emitter<StageEvent>
	) {
		this.balance = host.init.balance;
		this.limits = host.init.limits;
		this.still = host.init.reducedMotion;

		host.onBalance((next) => (this.balance = next));
	}

	/** Says something on the line of words, and to a screen reader. */
	private say(text: string) {
		this.message = text;
		this.host.announce(text);
	}

	/** One spin at the bet the bar is set to. False when it was refused. */
	spin = async (): Promise<boolean> => {
		if (this.busy || this.bet === undefined) return false;

		this.busy = true;
		this.win = 0;

		let played = false;

		try {
			const round = await this.host.open(this.bet, {});
			const playing: Playing = { payout: round.payout, spin: null };

			// The stake is seen to leave; the win is not, until it has been shown.
			this.balance = balanceBeforePayout(round);
			await playEvents(round.view.steps[0].events, this.handlers, {
				context: playing
			});

			this.balance = round.balance;
			this.win = round.payout;

			const shown = playing.spin!;
			const line = shown.reels.map((reel) => NAMES[reel[LINE_ROW]]).join(", ");

			this.say(
				shown.win
					? `Three of a kind, ${NAMES[shown.win.symbol]}: you won ${formatCoins(round.payout)}.`
					: `${line}. No win.`
			);
			// The result has been shown: the site may now show the new balance.
			this.host.settled();
			played = true;
		} catch (error) {
			this.autoLeft = 0;
			this.say(
				error instanceof Refusal
					? error.message
					: "Something went wrong. Try again."
			);
		}

		this.busy = false;

		return played;
	};

	/** Spins by itself, until the plays run out or one is refused. */
	autoplay = async (count: number) => {
		this.autoLeft = count;

		while (this.autoLeft > 0) {
			if (!(await this.spin())) break;

			this.autoLeft = Math.max(0, this.autoLeft - 1);
			if (this.autoLeft > 0) await wait(this.still ? 300 : 250);
		}

		this.autoLeft = 0;
	};

	/** Stops playing by itself, once the spin under way is over. */
	stopAutoplay = () => {
		this.autoLeft = 0;
	};
}
