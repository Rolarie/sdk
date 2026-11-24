/**
 * Gem Drop: the maths of the small game the SDK's own tests make books from. It has one
 * of everything a game played from books can have: a spin, a bonus that can be bought, a
 * choice between two bonuses worth the same, and a counter that fills over many spins.
 *
 * As played, a spin comes to a little under 96% and the tables it leads to a little off
 * what they must be worth; the weights make each exact.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import { defineBooks, type PlayedRow } from "@rolarie/sdk/book-play";
import type { Rng } from "@rolarie/sdk/rng";

/** What the bonus is worth, either way it is taken: twenty bets. */
const BONUS_BP = 200_000;

const BONUS_CHOICE = [
	{ id: "steady", table: "bonus-steady" },
	{ id: "wild", table: "bonus-wild" }
];

/** One spin: seven in ten lose, some pay a little, some drop a gem, a few land the bonus. */
function spin(rng: Rng): PlayedRow {
	const roll = rng.int(1_000);
	if (roll < 700) return { payoutBp: 0, events: [{ type: "reveal", win: 0 }] };

	if (roll < 940) {
		const payoutBp = (rng.int(8) + 1) * 3_000;

		return { payoutBp, events: [{ type: "reveal", win: payoutBp }] };
	}

	if (roll < 970) {
		const gems = 1 + rng.int(2);

		return {
			payoutBp: 5_000,
			events: [
				{ type: "reveal", win: 5_000 },
				{ type: "gems", gems }
			],
			adds: { gem: gems }
		};
	}

	return { payoutBp: 0, events: [{ type: "bonus" }], choice: BONUS_CHOICE };
}

export default defineBooks({
	seed: 20261117,
	tables: {
		spin: {
			rounds: 60_000,
			play: spin
		},

		// A bonus bought outright goes straight to the choice.
		bought: {
			rounds: 1_000,
			worthBp: 240_000,
			play: (rng) => ({
				payoutBp: 30_000 + rng.int(5) * 5_000,
				events: [{ type: "bought" }],
				choice: BONUS_CHOICE
			})
		},

		"bonus-steady": {
			rounds: 5_000,
			worthBp: BONUS_BP,
			play(rng) {
				const payoutBp = 150_000 + rng.int(11) * 10_000;

				return { payoutBp, events: [{ type: "freeSpins", win: payoutBp }] };
			}
		},

		"bonus-wild": {
			rounds: 5_000,
			worthBp: BONUS_BP,
			shape: [
				{ name: "jackpot", oneIn: 12, when: (row) => row.payoutBp >= 1_900_000 }
			],
			play(rng) {
				const payoutBp =
					rng.int(10) === 0
						? 1_900_000 + rng.int(3) * 100_000
						: rng.int(5) * 25_000;

				return { payoutBp, events: [{ type: "freeSpins", win: payoutBp }] };
			}
		},

		"gem-pour": {
			rounds: 2_000,
			play(rng) {
				const payoutBp = rng.int(4) === 0 ? 8_500 : 0;

				return { payoutBp, events: [{ type: "pour", win: payoutBp }] };
			}
		}
	}
});
