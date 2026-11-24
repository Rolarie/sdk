/**
 * A game's built client as a file of a release. A studio builds its own client, where its
 * code is, with the SDK it was written for; the site never builds one, and never runs a
 * studio's code to make one. What was built is not committed. Its record is:
 * `client/client.json`, the digest of every file of it, written when it is built
 * (`rolarie-studio client`) and committed, so that a tag says exactly which client it
 * sends. The built files travel in the game's package (./release-pack.ts),
 * and the site unpacks them beside the record and holds every file to it.
 *
 * Author: dwclake
 * Created: 2026-11-19
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import * as v from "valibot";
import { BOOK_VERSION } from "./book.ts";
import { LOCAL_CONDITIONS } from "./local-packages.ts";
import { PROTOCOL } from "./protocol.ts";
import { isPlace } from "./tar.ts";

/**
 * What a client built before its record said its protocol spoke: the SDK at 0.15, which
 * wrote no `protocol`, spoke this one.
 */
const PROTOCOL_BEFORE_RECORDED = "rolarie-game/2";

const recordSchema = v.strictObject({
	/** The SDK the client was built with: said for people, and held to nothing. */
	sdk: v.string(),
	/**
	 * The protocol the client speaks to the site in (./protocol.ts), as the SDK it was built
	 * with has it. A site takes a client that speaks its own, whatever SDK either is on.
	 */
	protocol: v.optional(v.string(), PROTOCOL_BEFORE_RECORDED),
	/** Every file of the built client, by its place in it, and its SHA-256 digest. */
	/**
	 * The conditions the client was built under, if any: packages taken from their clones,
	 * not at their tags (./local-packages.ts). Such a client is for trying a change, and is
	 * never a release: no tag of anything made its files.
	 */
	conditions: v.optional(v.array(v.string())),
	files: v.record(
		v.pipe(v.string(), v.check(isPlace)),
		v.pipe(v.string(), v.regex(/^[0-9a-f]{64}$/))
	)
});

/** The record of a built client: what a tag says it sends. */
export type ClientRecord = v.InferOutput<typeof recordSchema>;

/** Where a game's record of its built client is kept. */
export function clientRecordFile(gameFolder: string): string {
	return join(gameFolder, "client", "client.json");
}

/** This SDK's version: what a client built now is built with. */
const { version } = JSON.parse(
	readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8")
) as { version: string };

/** The SHA-256 digest of some bytes, as a record writes it. */
export const digest = (bytes: Uint8Array) =>
	createHash("sha256").update(bytes).digest("hex");

/** Every file under a folder, by its place in it, written with `/`. */
export function filesIn(folder: string): string[] {
	const walk = (within: string): string[] =>
		readdirSync(within, { withFileTypes: true }).flatMap((entry) =>
			entry.isDirectory()
				? walk(join(within, entry.name))
				: [join(within, entry.name)]
		);

	return walk(folder)
		.map((file) => relative(folder, file).split(sep).join("/"))
		.sort();
}

/** The record of the client built into a game's `client/dist`, as it is now. */
export function recordClient(
	gameFolder: string,
	/** The conditions it was built under: those of this run, unless said. */
	conditions: readonly string[] = LOCAL_CONDITIONS
): ClientRecord {
	const dist = join(gameFolder, "client", "dist");
	if (!existsSync(join(dist, "index.html"))) {
		throw new Error(`${dist} has no index.html: is the client built?`);
	}

	return {
		sdk: version,
		protocol: PROTOCOL,
		...(conditions.length > 0 ? { conditions: [...conditions] } : {}),
		files: Object.fromEntries(
			filesIn(dist).map((file) => [file, digest(readFileSync(join(dist, file)))])
		)
	};
}

/** Writes the record of a game's built client beside its source, to be committed. */
export function writeClientRecord(
	gameFolder: string,
	/** The conditions it was built under: those of this run, unless said. */
	conditions: readonly string[] = LOCAL_CONDITIONS
): ClientRecord {
	const record = recordClient(gameFolder, conditions);
	writeFileSync(
		clientRecordFile(gameFolder),
		`${JSON.stringify(record, null, "\t")}\n`
	);

	return record;
}

/** A game's record of its built client. Throws if there is none, or it is not one. */
export function readClientRecord(gameFolder: string): ClientRecord {
	const file = clientRecordFile(gameFolder);
	if (!existsSync(file)) {
		throw new Error(
			`there is no client/client.json, the record of its built client: build it with rolarie-studio client`
		);
	}

	return v.parse(recordSchema, JSON.parse(readFileSync(file, "utf8")));
}

/**
 * Why a game's built client is not one to release, if it was built on packages taken from
 * their clones (`bun run local client`): in words, or `null` for a client built on every
 * package at its tag.
 */
export function builtOnClones(gameFolder: string): string | null {
	let conditions: string[] | undefined;
	try {
		({ conditions } = readClientRecord(gameFolder));
	} catch {
		// No record, or not one: said by the check of the built client.
		return null;
	}

	return conditions?.length
		? `its client was built on packages taken from their clones (${conditions.join(", ")}), which no tag made: build it again with rolarie-studio client, without them, before it is released`
		: null;
}

/**
 * The problems with a game's built client against its record, in words: no record, a file
 * that is not the one recorded, one missing, or one not on record. Empty when the client
 * built is exactly the one its record names.
 */
export function checkBuiltClient(gameFolder: string): string[] {
	let record: ClientRecord;
	let built: ClientRecord;
	try {
		record = readClientRecord(gameFolder);
		built = recordClient(gameFolder);
	} catch (error) {
		return [error instanceof Error ? error.message : String(error)];
	}

	const problems: string[] = [];
	for (const [file, recorded] of Object.entries(record.files)) {
		if (!(file in built.files))
			problems.push(`its built client has no ${file}, which its record names`);
		else if (built.files[file] !== recorded)
			problems.push(`its built client's ${file} is not the one its record names`);
	}
	for (const file of Object.keys(built.files)) {
		if (!(file in record.files))
			problems.push(`its built client has ${file}, which is not on its record`);
	}

	return problems.length > 0
		? [
				...problems.slice(0, 5),
				"build it again and record it with: rolarie-studio client"
			]
		: [];
}

/**
 * Why this SDK cannot take a game as it was built, in words: its client speaks another
 * version of the protocol than this one, or its books are written in another format than
 * this one reads. Empty when it can. These two are all that a site and a game must agree
 * on: a game is built by its studio with whatever version of the SDK it was written for,
 * and a site takes it so long as they understand each other.
 */
export function unsupported(gameFolder: string): string[] {
	const problems: string[] = [];

	try {
		const { protocol } = readClientRecord(gameFolder);
		if (protocol !== PROTOCOL) {
			problems.push(
				`its client speaks ${protocol}, and this site speaks ${PROTOCOL}: build it with an SDK that speaks ${PROTOCOL}`
			);
		}
	} catch {
		// No record, or not one: said by the check of the built client.
	}

	try {
		// Read as it is written: the record's own check would refuse another format outright.
		const { version: books } = JSON.parse(
			readFileSync(join(gameFolder, "books", "books.json"), "utf8")
		) as { version?: unknown };
		if (books !== BOOK_VERSION) {
			problems.push(
				`its books are in format ${books}, and this site reads format ${BOOK_VERSION}: make them with an SDK that writes format ${BOOK_VERSION}`
			);
		}
	} catch {
		// No record of its books: said by the check of the books.
	}

	return problems;
}

/** Whether a game's built client is on disk and is the one its record names. */
export function hasItsClient(gameFolder: string): boolean {
	return (
		existsSync(clientRecordFile(gameFolder)) &&
		checkBuiltClient(gameFolder).length === 0
	);
}
