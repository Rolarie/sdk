/**
 * The record of a built client (./client-record.ts): that what is built is put on record
 * file by file and held to it, and what a site makes of a record from another SDK. How a
 * client travels with a release is ./release-pack.spec.ts.
 *
 * Author: dwclake
 * Created: 2026-11-19
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { BOOK_VERSION } from "./book.ts";
import { PROTOCOL } from "./protocol.ts";
import {
	builtOnClones,
	checkBuiltClient,
	hasItsClient,
	readClientRecord,
	unsupported,
	writeClientRecord
} from "./client-record.ts";

const scratch = mkdtempSync(join(tmpdir(), "client-record-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

const BUILT = {
	"index.html": "<!doctype html><p>the game</p>",
	"card.svg": "<svg />",
	"_app/immutable/chunks/abc.js": "export const game = 1;"
};

/** A game's folder with these files built into its client's `dist`. */
function game(name: string, files: Record<string, string> = BUILT): string {
	const folder = join(scratch, name);
	for (const [file, text] of Object.entries(files)) {
		mkdirSync(dirname(join(folder, "client", "dist", file)), { recursive: true });
		writeFileSync(join(folder, "client", "dist", file), text);
	}

	return folder;
}

describe("a built client", () => {
	it("is put on record file by file, and held to the record", () => {
		const folder = game("recorded");
		expect(checkBuiltClient(folder)[0]).toMatch(/no client\/client\.json/);

		const record = writeClientRecord(folder, []);
		expect(Object.keys(record.files)).toEqual([
			"_app/immutable/chunks/abc.js",
			"card.svg",
			"index.html"
		]);
		expect(readClientRecord(folder)).toEqual(record);
		expect(checkBuiltClient(folder)).toEqual([]);
		expect(hasItsClient(folder)).toBe(true);

		// Built again differently, it is no longer the client on record.
		writeFileSync(
			join(folder, "client", "dist", "index.html"),
			"<!doctype html><p>another</p>"
		);
		writeFileSync(join(folder, "client", "dist", "extra.js"), "more");
		const problems = checkBuiltClient(folder);
		expect(problems.join("\n")).toMatch(
			/index\.html is not the one its record names/
		);
		expect(problems.join("\n")).toMatch(/has extra\.js, which is not on its record/);
		expect(hasItsClient(folder)).toBe(false);
	});

	it("is taken by a site that speaks its protocol and reads its books, whatever SDK built it", () => {
		const folder = game("understood");
		const record = writeClientRecord(folder, []);
		expect(record.protocol).toBe(PROTOCOL);
		mkdirSync(join(folder, "books"), { recursive: true });
		const books = (version: number) =>
			writeFileSync(
				join(folder, "books", "books.json"),
				JSON.stringify({ version, tables: {} })
			);
		books(BOOK_VERSION);
		expect(unsupported(folder)).toEqual([]);

		// Built with another SDK altogether, and it makes no difference.
		const rewrite = (change: Record<string, unknown>) =>
			writeFileSync(
				join(folder, "client", "client.json"),
				JSON.stringify({ ...record, ...change })
			);
		rewrite({ sdk: "9.9.9" });
		expect(unsupported(folder)).toEqual([]);

		// A record written before records said so (the SDK at 0.15) is of a client that spoke
		// that SDK's protocol.
		const { protocol: _said, ...before } = record;
		writeFileSync(join(folder, "client", "client.json"), JSON.stringify(before));
		expect(readClientRecord(folder).protocol).toBe("rolarie-game/2");

		// A client that speaks another protocol, or books in another format, is refused, and why.
		rewrite({ protocol: "rolarie-game/999" });
		expect(unsupported(folder)).toEqual([
			expect.stringMatching(
				new RegExp(`speaks rolarie-game/999, and this site speaks ${PROTOCOL}`)
			)
		]);
		rewrite({});
		books(BOOK_VERSION + 1);
		expect(unsupported(folder)).toEqual([
			expect.stringMatching(
				new RegExp(
					`format ${BOOK_VERSION + 1}, and this site reads format ${BOOK_VERSION}`
				)
			)
		]);
	});

	it("says when it was built on packages taken from their clones, which is no release", () => {
		const folder = game("on-clones");
		const record = writeClientRecord(folder, []);

		// Built on every package at its tag, the record says nothing of it.
		expect(record.conditions).toBeUndefined();
		expect(builtOnClones(folder)).toBeNull();

		// As `bun run local client` records it: its files are of no tag's making.
		writeFileSync(
			join(folder, "client", "client.json"),
			JSON.stringify({ ...record, conditions: ["local"] })
		);
		expect(builtOnClones(folder)).toMatch(/taken from their clones \(local\)/);
	});
});
