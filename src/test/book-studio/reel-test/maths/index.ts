/**
 * Reel Test: the maths its book is made from. A deliberately simple slot, kept so
 * that a studio can see the whole of what a game played from books is in one place.
 *
 * The reels can stop 8,000 ways, and the book is all of them: one row for each, played in
 * order and not drawn at random, so nothing the game can do is left out of it. Played so,
 * every way as likely as the next, 7,676 of every 8,000 basis points staked come back:
 * 95.95%. The weights make the rows that pay a hair likelier, and the return 96.00%.
 *
 * This runs where the book is made, and nowhere else: the site is sent the book.
 *
 * Author: dwclake
 * Created: 2026-11-18
 */

import { defineBooks } from "@rolarie/sdk/book-play";
import { createRound } from "@rolarie/sdk/slots";
import { STOPS, spinOf } from "./rules.ts";

export default defineBooks({
	seed: 1,
	tables: {
		spin: {
			rounds: STOPS,
			// Each round is one way of stopping the reels: the stream is not asked for anything.
			play(_rng, way) {
				const round = createRound();
				const spin = spinOf(way);

				round.event("spin", { ...spin });
				round.pay(spin.win?.bp ?? 0);

				return round.row();
			}
		}
	}
});
