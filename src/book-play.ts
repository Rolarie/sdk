/**
 * What a studio writes to have its books made: for each of a game's tables, how one round
 * drawn from it plays out. `rolarie-studio` plays each table's rounds, weighs the rows
 * they come to (./book-weights.ts) and writes the books (./book-maker.ts). This is the
 * only code of a studio's that decides anything, and it runs on the studio's machine and
 * nowhere else: the site is sent the books.
 *
 *   export default defineBooks({
 *     seed: 1,
 *     tables: {
 *       spin: { rounds: 500_000, play: (rng) => spin(rng) },
 *       "storm-gale": { rounds: 100_000, worthBp: 180_000, play: (rng) => freeSpins(rng, 6, 2) }
 *     }
 *   });
 *
 * `play` is pure: every random choice comes from the stream it is handed, so the same
 * seed makes the same books on any machine with any number of cores.
 *
 * Pure. A game's maths imports this, `valibot` and its own files, and nothing else.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import type { BookRow } from "./book.ts";
import type { ShapeGroup } from "./book-weights.ts";
import type { Rng } from "./rng.ts";

/** One round as it played out: what it pays, and the row that plays it (./book.ts). */
export interface PlayedRow extends BookRow {
	/** What the row itself pays, as a multiple of the bet in basis points. */
	payoutBp: number;
}

/** A group of rows asked for by name (./book-weights.ts), and which rows are in it. */
export interface PlayedGroup extends ShapeGroup {
	/** Whether a row belongs. A row is in the first group that takes it. */
	when(row: PlayedRow): boolean;
}

/** How one table's rounds are played, and what is asked of the table they make. */
export interface TableMaths {
	/** How many rounds to play: the table's rows. */
	rounds: number;
	/** Plays one round. `round` is its number, from 0, for maths that wants it. */
	play(rng: Rng, round: number): PlayedRow;
	/**
	 * What a row drawn from the table must be worth, in basis points of the bet. Left
	 * out for a table a mode opens (96% of what the mode costs) or a counter fills from
	 * (what the units that fill it were counted at); needed for a table a choice offers.
	 */
	worthBp?: number;
	/** Groups of rows to draw so often, or to make up so much of the table's worth. */
	shape?: PlayedGroup[];
}

/** A game's maths: every table it ships, by name, and the seed they are all made from. */
export interface BooksMaths {
	seed: number;
	tables: Record<string, TableMaths>;
}

/** A game's maths, as its `maths/index.ts` exports it by default. */
export const defineBooks = (maths: BooksMaths): BooksMaths => maths;

/** A text as a whole number of 32 bits, the same every time. */
function hashText(text: string): number {
	let hash = 0x811c9dc5;

	for (let index = 0; index < text.length; index++) {
		hash ^= text.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}

	return hash >>> 0;
}

/**
 * The stream one round of one table is played from. It depends on the seed, the table
 * and the round and nothing else, so rounds can be played in any order, on any core.
 * A small fast generator: books are about the maths, and a bet is drawn from one by the
 * site's own stream (./rng.ts), not this.
 */
export function playingRng(seed: number, table: string, round: number): Rng {
	let state =
		(Math.imul(seed | 0, 0x9e3779b1) ^
			hashText(table) ^
			Math.imul(round + 1, 0x85ebca6b)) >>>
		0;

	/** The next number from 0 up to 1. */
	const float = () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let mixed = state;
		mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
		mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);

		return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
	};

	return {
		float,
		int: (below) => Math.floor(float() * below),
		shuffle<Item>(items: readonly Item[]): Item[] {
			const shuffled = [...items];

			for (let last = shuffled.length - 1; last > 0; last--) {
				const other = Math.floor(float() * (last + 1));
				[shuffled[last], shuffled[other]] = [shuffled[other], shuffled[last]];
			}

			return shuffled;
		}
	};
}
