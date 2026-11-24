/**
 * Making books: that a game's maths becomes books that pass the site's check, each table
 * worth exactly what it must be, that the same maths makes the same books whatever
 * played it, and that maths that cannot become books is refused with the reason.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import { spawnSync } from "node:child_process";
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
	loadBookGame,
	openBooks,
	readBooksSummary,
	readGameManifest
} from "./book-files.ts";
import { makeBooks, tableWorths } from "./book-maker.ts";
import { defineBooks, playingRng } from "./book-play.ts";
import { playRound, type PlayedRound } from "./book-round.ts";
import { createRng } from "./rng.ts";

const game = fileURLToPath(new URL("./test/book-studio/gem-drop", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "keros3ne-maker-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

describe("a game's books, made from its maths", () => {
	it("pass the site's check, every table worth what it must be", async () => {
		const made = await makeBooks(game, { books: join(scratch, "here"), workers: 0 });

		expect(made.check.problems).toEqual([]);
		expect(made.check.modes.map((mode) => mode.id)).toEqual(["spin", "bonus"]);
		for (const mode of made.check.modes) {
			expect(mode.rtpBp).toBeLessThanOrEqual(9_600);
			expect(mode.rtpBp).toBeGreaterThan(9_599.5);
		}

		expect(
			made.tables.map((table) => [table.table, table.rows, table.worthBp])
		).toEqual([
			["spin", 60_000, 9_600],
			["bought", 1_000, 240_000],
			["bonus-steady", 5_000, 200_000],
			["bonus-wild", 5_000, 200_000],
			["gem-pour", 2_000, 2_000]
		]);

		// As played, a spin was near its worth but not on it: the weights did the rest.
		const spin = made.tables[0];
		expect(Math.abs(spin.playedBp - 9_600)).toBeGreaterThan(1);
		expect(Math.abs(spin.playedBp - 9_600)).toBeLessThan(600);

		// Nothing is left behind but the books and their summary.
		expect(readdirSync(join(scratch, "here")).sort()).toEqual(
			[
				"books.json",
				...Object.keys(made.books.tables).flatMap((table) => [
					`${table}.index`,
					`${table}.rows`
				])
			].sort()
		);
	});

	it("are the books the record kept beside the game describes", async () => {
		const made = await makeBooks(game, { books: join(scratch, "kept"), workers: 0 });

		expect(made.books).toEqual(readBooksSummary(join(game, "books")));
	});

	it("are the same books whoever played them", async () => {
		const here = await makeBooks(game, { books: join(scratch, "again"), workers: 0 });
		const crew = await makeBooks(game, { books: join(scratch, "crew"), workers: 3 });
		const first = await makeBooks(game, { books: join(scratch, "here"), workers: 0 });

		expect(here.books).toEqual(first.books);
		expect(crew.books).toEqual(first.books);
	});

	it("can be played from, counters, choices and all", async () => {
		await makeBooks(game, { books: join(scratch, "played"), workers: 0 });

		const books = openBooks(join(scratch, "played"));
		const rules = readGameManifest(game);
		let held: Record<string, number> = {};
		let paid = 0;
		let pours = 0;
		let bonuses = 0;
		const bets = 20_000;

		for (let nonce = 0; nonce < bets; nonce++) {
			const rng = () => createRng("server seed", "client seed", nonce);
			let round = playRound(books, "spin", rng(), [], {
				rules,
				held
			}) as PlayedRound;

			if (round.open) {
				bonuses += 1;
				round = playRound(books, "spin", rng(), [nonce % 2 ? "wild" : "steady"], {
					rules,
					held
				}) as PlayedRound;
			}

			pours += round.steps.filter((step) => step.filled).length;
			paid += round.payoutBp;
			held = round.counters!;
		}

		for (const book of Object.values(books)) book.close();

		// Twenty thousand bets cannot pin 96% down, only show that nothing is far out.
		expect(paid / bets).toBeGreaterThan(8_000);
		expect(paid / bets).toBeLessThan(11_500);
		expect(bonuses).toBeGreaterThan(300);
		expect(pours).toBeGreaterThan(30);
	});
});

describe("a game loaded to be played, by `dev` or a story", () => {
	it("has its books checked once for each making of them, and the check kept beside them", async () => {
		// The game's manifest in a folder of its own, with books made there from its maths.
		const copy = join(scratch, "loaded");
		const made = () => makeBooks(game, { books: join(copy, "books"), workers: 0 });

		mkdirSync(copy, { recursive: true });
		cpSync(join(game, "game.json"), join(copy, "game.json"));
		await made();

		const kept = join(copy, "books", "checked.json");
		expect(existsSync(kept)).toBe(false);

		const first = loadBookGame(copy, "fixture");
		const checked = JSON.parse(readFileSync(kept, "utf8")) as {
			key: string;
			check: { passed: boolean; modes: { id: string }[] };
		};
		expect(checked.check.passed).toBe(true);
		expect(checked.check.modes.map((mode) => mode.id)).toEqual(["spin", "bonus"]);

		// Loaded again, it is the same game, from what was kept.
		const again = loadBookGame(copy, "fixture");
		expect(again.maxMultiplierBp({ mode: "spin" })).toBe(
			first.maxMultiplierBp({ mode: "spin" })
		);
		expect(JSON.parse(readFileSync(kept, "utf8")).key).toBe(checked.key);

		// What was kept of other books is not believed: these are read through, and kept anew.
		writeFileSync(
			kept,
			JSON.stringify({
				key: "of other books",
				check: { passed: true, problems: [], modes: [] }
			})
		);
		expect(loadBookGame(copy, "fixture").maxMultiplierBp({ mode: "spin" })).toBe(
			first.maxMultiplierBp({ mode: "spin" })
		);
		expect(JSON.parse(readFileSync(kept, "utf8")).key).toBe(checked.key);

		// And books made again are other books, though they hold the same rows.
		await made();
		loadBookGame(copy, "fixture");
		expect(JSON.parse(readFileSync(kept, "utf8")).key).not.toBe(checked.key);
	});
});

describe("the books command", () => {
	it("makes a studio's books, says what they hold, and leaves the record they are held to", () => {
		const studio = fileURLToPath(new URL("./test/book-studio", import.meta.url));
		const cli = fileURLToPath(new URL("./cli.ts", import.meta.url));
		const kept = readBooksSummary(join(game, "books"));
		const ran = spawnSync("bun", [cli, "books", "--root", studio, "--workers", "2"], {
			encoding: "utf8"
		});

		expect(ran.stderr).toBe("");
		expect(ran.status).toBe(0);
		expect(ran.stdout).toContain("spin: 60,000 rows, worth 0.96 bets");
		expect(ran.stdout).toContain('group "jackpot": once in 12.0 rounds');
		expect(ran.stdout).toMatch(/mode spin: returns 95\.99\d\d%/);
		expect(ran.stdout).toContain('! "bonus-wild" came to');
		expect(ran.stdout).toContain("gem-drop: books made and checked");

		// The record committed beside the game is the one any machine makes.
		expect(readBooksSummary(join(game, "books"))).toEqual(kept);
	});

	it("says so when a game named is not played from books", () => {
		// A studio of one folder that has maths and no manifest.
		const studio = mkdtempSync(join(tmpdir(), "keros3ne-no-books-"));
		mkdirSync(join(studio, "plain", "maths"), { recursive: true });
		writeFileSync(join(studio, "plain", "maths", "index.ts"), "export default {};");
		writeFileSync(
			join(studio, "studio.json"),
			JSON.stringify({
				id: "fixture",
				name: "Fixture",
				blurb: "A studio for a test.",
				sdk: "^0.11.0",
				games: ["plain"]
			})
		);

		const cli = fileURLToPath(new URL("./cli.ts", import.meta.url));
		const ran = spawnSync("bun", [cli, "books", "plain", "--root", studio], {
			encoding: "utf8"
		});

		rmSync(studio, { recursive: true, force: true });

		expect(ran.status).toBe(1);
		expect(ran.stderr).toContain("plain: it has no game.json");
	});
});

describe("the make command", () => {
	const cli = fileURLToPath(new URL("./cli.ts", import.meta.url));

	it("makes a game's books, builds its client, checks it and packs it, in that order", () => {
		const studio = fileURLToPath(new URL("./test/book-studio", import.meta.url));
		const out = mkdtempSync(join(tmpdir(), "keros3ne-made-"));
		const record = join(studio, "reel-test", "client", "client.json");
		const kept = readFileSync(record, "utf8");
		const ran = spawnSync(
			"bun",
			[cli, "make", "reel-test", "--root", studio, "--out", out, "--workers", "2"],
			{ encoding: "utf8" }
		);
		const packed = readdirSync(out);

		rmSync(out, { recursive: true, force: true });

		expect(ran.stderr).toBe("");
		expect(ran.status).toBe(0);
		// Each step is said, and done, before the next begins.
		const said = [
			"== books ==",
			"reel-test: books made and checked",
			"== client ==",
			"reel-test: built",
			"== check ==",
			"reel-test: passes every check.",
			"== pack ==",
			"reel-test at 1.0.0: reel-test-1.0.0.tar.gz"
		].map((words) => ran.stdout.indexOf(words));
		expect(said).not.toContain(-1);
		expect(said).toEqual([...said].sort((a, b) => a - b));
		expect(packed).toEqual(["reel-test-1.0.0.tar.gz"]);

		// The same source builds the client on record: making a game leaves nothing to commit.
		expect(readFileSync(record, "utf8")).toBe(kept);
	});

	it("stops at the first step that fails, with nothing packed", () => {
		// A studio of one folder that has maths and no manifest: its books cannot be made.
		const studio = mkdtempSync(join(tmpdir(), "keros3ne-not-made-"));
		mkdirSync(join(studio, "plain", "maths"), { recursive: true });
		writeFileSync(join(studio, "plain", "maths", "index.ts"), "export default {};");
		writeFileSync(
			join(studio, "studio.json"),
			JSON.stringify({
				id: "fixture",
				name: "Fixture",
				blurb: "A studio for a test.",
				sdk: "^0.11.0",
				games: ["plain"]
			})
		);

		const ran = spawnSync("bun", [cli, "make", "plain", "--root", studio], {
			encoding: "utf8"
		});
		const packed = existsSync(join(studio, "release"));

		rmSync(studio, { recursive: true, force: true });

		expect(ran.status).toBe(1);
		expect(ran.stderr).toContain("plain: it has no game.json");
		expect(ran.stderr).toContain("Stopped at books: nothing was packed.");
		expect(ran.stdout).not.toContain("== client ==");
		expect(packed).toBe(false);
	});
});

describe("a round's stream", () => {
	it("depends on the seed, the table and the round, and nothing else", () => {
		const draws = (seed: number, table: string, round: number) => {
			const rng = playingRng(seed, table, round);

			return [rng.int(1_000_000), rng.int(1_000_000), rng.float()];
		};

		expect(draws(1, "spin", 5)).toEqual(draws(1, "spin", 5));
		expect(draws(1, "spin", 5)).not.toEqual(draws(2, "spin", 5));
		expect(draws(1, "spin", 5)).not.toEqual(draws(1, "bonus", 5));
		expect(draws(1, "spin", 5)).not.toEqual(draws(1, "spin", 6));
	});
});

describe("maths that cannot become books", () => {
	const manifest = readGameManifest(game);
	const play = () => ({ payoutBp: 0, events: [] });
	const table = { rounds: 10, play };
	const whole = {
		spin: table,
		bought: table,
		"bonus-steady": { ...table, worthBp: 200_000 },
		"bonus-wild": { ...table, worthBp: 200_000 },
		"gem-pour": table
	};

	it("is a table with no worth, a worth that disagrees, or a table left out", () => {
		const worths =
			(tables: Record<string, typeof table & { worthBp?: number }>) => () =>
				tableWorths(manifest, defineBooks({ seed: 1, tables }));

		expect(worths(whole)()).toEqual({
			spin: 9_600,
			bought: 240_000,
			"bonus-steady": 200_000,
			"bonus-wild": 200_000,
			"gem-pour": 2_000
		});
		expect(worths({ ...whole, "bonus-steady": table })).toThrow(
			/"bonus-steady" must say what it is worth/
		);
		expect(worths({ ...whole, spin: { ...table, worthBp: 9_700 } })).toThrow(
			/"spin" must be worth 9600 \(the mode "spin"\) and 9700 \(its maths\)/
		);

		const { "gem-pour": _left, ...without } = whole;
		expect(worths(without)).toThrow(
			/makes no table "gem-pour", which the counter "gem" needs/
		);
	});
});
