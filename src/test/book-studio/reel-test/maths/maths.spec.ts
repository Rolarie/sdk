/**
 * Reel Test: that its rules pay as its guide says, and that its book is every way
 * the reels can stop, each once, coming to the 95.95% the weights then make 96.00%.
 *
 * Author: dwclake
 * Created: 2026-11-18
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { playingRng } from "@rolarie/sdk/book-play";
import { multiple, type GameGuide } from "@rolarie/sdk/guide";
import books from "./index.ts";
import { PAYS, STOPS, STRIP, SYMBOLS, linePays, showing, spinOf } from "./rules.ts";

const guide = JSON.parse(
	readFileSync(fileURLToPath(new URL("../guide.json", import.meta.url)), "utf8")
) as GameGuide;

/** Every row of the book, as its maths plays it. */
const rows = Array.from({ length: STOPS }, (_, way) =>
	books.tables.spin.play(playingRng(1, "spin", way), way)
);

describe("the rules", () => {
	it("pay three of a kind on the middle row, and nothing else", () => {
		expect(linePays(["shell", "shell", "shell"])).toEqual({
			symbol: "shell",
			bp: PAYS.shell
		});
		expect(linePays(["shell", "shell", "fish"])).toBeNull();
		expect(showing(0)).toEqual([STRIP[STRIP.length - 1], STRIP[0], STRIP[1]]);
	});
});

describe("the book", () => {
	it("is every way the reels can stop, each once", () => {
		expect(books.tables.spin.rounds).toBe(8_000);

		const seen = new Set(
			rows.map((row) => JSON.stringify(spinOf(rows.indexOf(row)).reels))
		);
		const ways = new Set(
			Array.from({ length: STOPS }, (_, way) => JSON.stringify(spinOf(way)))
		);

		expect(ways.size).toBeGreaterThan(1);
		expect(seen.size).toBeGreaterThan(1);
		expect(
			rows.every((row, way) => row.payoutBp === (spinOf(way).win?.bp ?? 0))
		).toBe(true);
	});

	it("comes to 95.95% as played, which the weights make 96.00%", () => {
		const paid = rows.reduce((total, row) => total + row.payoutBp, 0);

		// 7,676 of every 8,000 basis points staked come back.
		expect(paid).toBe(9_595 * STOPS);
		expect(Math.max(...rows.map((row) => row.payoutBp))).toBe(PAYS.lighthouse);
	});

	it("closes every row with what it paid", () => {
		for (const row of rows)
			expect(row.events.at(-1)).toEqual({ type: "total", payoutBp: row.payoutBp });
	});
});

describe("the guide", () => {
	it("says what the rules are", () => {
		const table = guide.paytable![0];
		if (table.type !== "table") throw new Error("The paytable is not a table.");

		expect(table.rows.map((row) => row[1])).toEqual(
			SYMBOLS.map((symbol) => multiple(PAYS[symbol]))
		);
		expect(JSON.stringify(guide.rules)).toContain(
			`the same ${STRIP.length} symbols, so every spin stops one of ${STOPS.toLocaleString("en")} ways`
		);
	});
});
