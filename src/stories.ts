/**
 * For a studio's stories: rounds from the game's real books, asked of the SDK's Storybook
 * while it runs (`rolarie-studio stories`). A story plays what comes back through the
 * game's own handlers, so a piece is seen doing what it will do on the site.
 *
 *   const { view } = await roundFromBooks({ slug: "stormglass" });
 *   await playSteps(view.steps, handlers);
 *
 * Pure: it runs in the story's page.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import type { BookView } from "./book-game.ts";
import type { GameHost } from "./client.ts";
import type { RoundMessage } from "./protocol.ts";

/** A story's own types, handed on, so that a studio's stories need nothing but the SDK. */
export type { Meta, StoryObj } from "@storybook/svelte-vite";
import type { Counters } from "./book-round.ts";

/** Where stories ask, on Storybook's own server: `/round` for a round, `/games` for the games. */
export const STORY_BOOKS = "/__rolarie/books";

/** What a story asks for: a game, a way of opening a round, and what to pick in it. */
export interface StoryRoundRequest {
	slug: string;
	/** The mode's id. The game's ordinary one, left out. */
	mode?: string;
	/** The options to pick, in order, wherever the round stops at a choice. */
	choices?: string[];
	/** Which round: the same seed gives the same round. A different one each time, left out. */
	seed?: string;
	/** What the player holds going in, for a game with counters. */
	held?: Counters;
}

/** A round as a story is handed it: what the client is shown, and the seed that gives it again. */
export interface StoryRound {
	view: BookView;
	seed: string;
}

/** A studio's games that are played from books, each with its modes. */
export interface StoryGames {
	games: { slug: string; name: string; modes: { id: string; name: string }[] }[];
}

/** Asks Storybook's server, and hands back its answer or throws what it said was wrong. */
async function ask<Answer>(path: string): Promise<Answer> {
	const response = await fetch(`${STORY_BOOKS}${path}`);
	const answer = (await response.json()) as Answer & { problem?: string };

	if (!response.ok)
		throw new Error(answer.problem ?? "Storybook could not read the game's books.");

	return answer;
}

/**
 * A round played from a game's books, as the site would play it. Where the round stops at
 * a choice, `view.options` says what may be picked: ask again with the same `seed` and
 * the choice added to `choices`, and the round goes on from there.
 */
export const roundFromBooks = (request: StoryRoundRequest): Promise<StoryRound> =>
	ask(`/round?request=${encodeURIComponent(JSON.stringify(request))}`);

/** The studio's games that are played from books. */
export const gamesWithBooks = (): Promise<StoryGames> => ask("/games");

/** What a story's stand-in for the site is made with. */
export interface StoryHostOptions<View, Progress> {
	/** The game, by its slug, and its name. */
	slug: string;
	name?: string;
	/** What the player has to begin with, in cents. Plenty, left out. */
	balance?: number;
	/** The bets the stand-in says the site takes. */
	limits?: { minStake: number; maxStake: number };
	/**
	 * What a way of playing costs, in bets, from what the game opens a round with (`params`):
	 * `(params) => MODES[params.mode].bets`. One bet, left out.
	 */
	cost?: (params: unknown) => number;
	/** The mode's id, from the same. `params.mode`, left out. */
	mode?: (params: unknown) => string | undefined;
	/**
	 * Which rounds the story is of: rounds are asked for until one passes. A spin that pays,
	 * one that lands the bonus. Any, left out.
	 */
	want?: (view: BookView) => boolean;
	/** What the player holds going in, for a game with counters, and what the game is told of it. */
	held?: Counters;
	progress?: (held: Counters) => Progress;
	/** Called with whatever the game announces: a story writes it under the game. */
	onannounce?: (text: string) => void;
	/** How the view the books give is handed to the game, where that is not as it comes. */
	view?: (view: BookView) => View;
}

/** The most rounds asked for in looking for one a story wants. */
const STORY_TRIES = 400;

/**
 * A stand-in for the site, for a story: something to play the whole game against with no
 * site behind it. It opens rounds from the game's real books, charges and pays as the
 * site would, plays on from a choice, and keeps the counters of a game that has them.
 */
export function createStoryHost<View = BookView, Progress = null>(
	options: StoryHostOptions<View, Progress>
): GameHost<View, Progress> {
	const { slug } = options;
	const modeOf =
		options.mode ?? ((params) => (params as { mode?: string } | null)?.mode);
	let balance = options.balance ?? 10_000_00;
	let held = options.held;
	let bet = 0;
	let charged = 0;
	let seed = "";
	let mode: string | undefined;

	const progressNow = () =>
		held && options.progress ? options.progress(held) : (null as Progress | null);

	/** A round from the books as the site would report it. */
	function report(round: StoryRound): RoundMessage<View, Progress> {
		const payout = round.view.open
			? 0
			: Math.floor((bet * round.view.payoutBp) / 10_000);

		balance += payout;
		if (round.view.counters) held = round.view.counters;

		return {
			open: round.view.open,
			stake: charged,
			baseStake: bet,
			payout,
			view: options.view
				? options.view(round.view)
				: (round.view as unknown as View),
			progress: progressNow(),
			balance
		};
	}

	return {
		init: {
			game: { slug, name: options.name ?? slug },
			balance,
			limits: options.limits ?? { minStake: 1, maxStake: 100_00 },
			reducedMotion: false,
			round: null,
			// A story shows the view it asks for (`Views`' `show`), whatever this says.
			view: "wide"
		},

		async open(stake, params) {
			bet = stake;
			mode = modeOf(params);
			charged = stake * (options.cost?.(params) ?? 1);
			balance -= charged;

			for (let tried = 0; tried < STORY_TRIES; tried++) {
				const round = await roundFromBooks({ slug, mode, held });
				if (options.want && !options.want(round.view)) continue;

				seed = round.seed;

				return report(round);
			}

			throw new Error(`No round in ${STORY_TRIES} was one the story wants.`);
		},

		// The same round again, with the choice made: Storybook plays on from it.
		async act(action) {
			const { choose } = action as { choose: string };

			return report(
				await roundFromBooks({ slug, mode, seed, held, choices: [choose] })
			);
		},

		settled() {},
		announce: (text) => options.onannounce?.(text),
		progress: async () => progressNow(),
		history: async () => [],
		onBalance() {},
		onView() {}
	};
}
