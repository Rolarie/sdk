/**
 * Packing a game (./release-pack.ts): that what a studio packs is one file holding all of
 * the game that leaves it, which a site installs as the engine installs any package, and
 * that a game whose books or built client are not the ones on record is not packed.
 *
 * Author: dwclake
 * Created: 2026-11-20
 */

import { execFileSync } from "node:child_process";
import {
	cpSync,
	createReadStream,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeBooks } from "./book-maker.ts";
import { writeClientRecord } from "./client-record.ts";
import { fileDigest, installPackage } from "./game-package.ts";
import { bookFiles, packGame, packedName } from "./release-pack.ts";

const game = fileURLToPath(new URL("./test/book-studio/gem-drop", import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), "rolarie-pack-"));
const studio = join(scratch, "studio", "gem-drop");
const out = join(scratch, "release");
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const TABLES = ["spin", "bought", "bonus-steady", "bonus-wild", "gem-pour"];
const NAME = "gem-drop-1.0.0.tar.gz";

const BUILT: Record<string, string> = {
	"index.html": "<!doctype html><p>the game</p>",
	"card.svg": "<svg />",
	"_app/immutable/chunks/abc.js": "export const game = 1;"
};

beforeAll(async () => {
	// The maths plays where it is, in the SDK; its books are made into a folder of the test's.
	for (const file of ["game.json", "guide.json"])
		cpSync(join(game, file), join(studio, file));
	await makeBooks(game, { books: join(studio, "books"), workers: 0 });

	for (const [file, text] of Object.entries(BUILT)) {
		mkdirSync(dirname(join(studio, "client", "dist", file)), { recursive: true });
		writeFileSync(join(studio, "client", "dist", file), text);
	}
	mkdirSync(join(studio, "client", "public"), { recursive: true });
	writeFileSync(join(studio, "client", "public", "card.svg"), "<svg />");
	writeClientRecord(studio, []);

	await packGame(studio, "gem-drop", out);
});

describe("a game, packed by its studio", () => {
	it("is one file named for the game and its version, with all of the game in it", async () => {
		expect(packedName("gem-drop", "1.0.0")).toBe(NAME);
		expect(readdirSync(out)).toEqual([NAME]);

		const listed = execFileSync("tar", ["-tzf", join(out, NAME)], {
			encoding: "utf8"
		})
			.trim()
			.split("\n");
		expect([...listed].sort()).toEqual(
			[
				"release.json",
				"game.json",
				"guide.json",
				"card.svg",
				...Object.keys(BUILT).map((file) => `client/${file}`),
				"maths/books.json",
				...bookFiles(TABLES).map((file) => `maths/${file}`)
			].sort()
		);
		// The books, which are most of a game, come last: what is small is read first.
		expect(listed.at(-1)).toMatch(/^maths\//);
		expect(bookFiles(["spin"])).toEqual(["spin.index", "spin.rows"]);
	});

	it("says what was packed: the version, and the file's own size and digest", async () => {
		const again = join(scratch, "again");
		const packed = await packGame(studio, "gem-drop", again);

		expect(packed).toEqual({
			name: NAME,
			version: "1.0.0",
			...(await fileDigest(join(out, NAME)))
		});
		// The same game is the same file, wherever and whenever it is packed.
		expect(readFileSync(join(again, NAME))).toEqual(readFileSync(join(out, NAME)));
	});

	it("is installed by a site as it was packed, its books checked", async () => {
		const into = join(scratch, "site", "gem-drop", "1.0.0");
		const installed = await installPackage(
			() => createReadStream(join(out, NAME)),
			into,
			{ expect: { slug: "gem-drop", version: "1.0.0" } }
		);

		expect(installed.checked.check.problems).toEqual([]);
		expect(installed.record.protocol).toMatch(/^rolarie-game\//);
		for (const [file, text] of Object.entries(BUILT))
			expect(readFileSync(join(into, "client", file), "utf8")).toBe(text);
		for (const file of ["books.json", "spin.rows", "gem-pour.index"])
			expect(readFileSync(join(into, "maths", file))).toEqual(
				readFileSync(join(studio, "books", file))
			);
		expect(readFileSync(join(into, "guide.json"))).toEqual(
			readFileSync(join(studio, "guide.json"))
		);
	});

	it("takes its assets with it, where it has any", async () => {
		const folder = join(scratch, "sounding", "gem-drop");
		cpSync(studio, folder, { recursive: true });
		mkdirSync(join(folder, "assets", "sound"), { recursive: true });
		writeFileSync(join(folder, "assets", "sound", "theme.ogg"), "sound");

		const into = join(scratch, "sounding-out");
		await packGame(folder, "gem-drop", into);
		expect(
			execFileSync("tar", ["-tzf", join(into, NAME)], { encoding: "utf8" })
		).toMatch(/^assets\/sound\/theme\.ogg$/m);
	});

	it("is not packed when its books or its client are not the ones on record", async () => {
		const folder = join(scratch, "unsound", "gem-drop");
		cpSync(studio, folder, { recursive: true });
		const into = join(scratch, "unsound-out");

		writeFileSync(join(folder, "client", "dist", "extra.js"), "more");
		await expect(packGame(folder, "gem-drop", into)).rejects.toThrow(
			/extra\.js, which is not on its record/
		);
		rmSync(join(folder, "client", "dist", "extra.js"));

		// Built on packages taken from their clones: for a trial, and only when asked.
		const record = JSON.parse(
			readFileSync(join(folder, "client", "client.json"), "utf8")
		);
		writeFileSync(
			join(folder, "client", "client.json"),
			JSON.stringify({ ...record, conditions: ["local"] })
		);
		await expect(packGame(folder, "gem-drop", into)).rejects.toThrow(
			/built on packages taken from their clones/
		);
		expect((await packGame(folder, "gem-drop", into, { trial: true })).name).toBe(
			NAME
		);
		rmSync(into, { recursive: true });
		writeFileSync(join(folder, "client", "client.json"), JSON.stringify(record));

		rmSync(join(folder, "client", "public", "card.svg"));
		await expect(packGame(folder, "gem-drop", into)).rejects.toThrow(
			/has no client\/public\/card\.svg/
		);
		writeFileSync(join(folder, "client", "public", "card.svg"), "<svg />");

		rmSync(join(folder, "books", "spin.rows"));
		await expect(packGame(folder, "gem-drop", into)).rejects.toThrow();
		expect(existsSync(into) ? readdirSync(into) : []).toEqual([]);
	});
});
