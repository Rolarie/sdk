#!/usr/bin/env bun
/// <reference types="bun" />
/**
 * rolarie-studio: a studio's tools for building games for Rolarie.
 *
 *   rolarie-studio books [slug...]   make a game's books from its maths, and say what they hold
 *   rolarie-studio client [slug...]  build a game's client, and put what was built on record
 *   rolarie-studio check [slug...]   the site's checks: books, guide, maths, client
 *   rolarie-studio pack [slug...]    pack each game into the one file a studio sends of it
 *   rolarie-studio make [slug...]    all four, one after another: books, client, check, pack
 *   rolarie-studio dev <slug>        play the game against a stand-in for the site
 *   rolarie-studio stories           the studio's stories, and the SDK's own, in Storybook
 *
 * Run it in the studio's folder, which holds a folder for each game (studio-folder.ts), or
 * pass `--root <folder>`. It runs on Bun, which imports a game's TypeScript as it is.
 */
import { buildClient } from "./client-build.ts";
import { checkBuiltClient, unsupported, writeClientRecord } from "./client-record.ts";
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { checkGuide } from "./guide.ts";
import { sharedFolders, sharedPackages, type StudioManifest } from "./manifest.ts";
import {
	gameFolders,
	isBookGame,
	loadGuide,
	packageFolder,
	pickGames,
	readManifest,
	type GameFolder
} from "./studio-folder.ts";
import { scanClient, scanClientSource, scanMaths } from "./testing.ts";

const HELP = `rolarie-studio: build games for Rolarie

Run it in the studio's folder: the one with studio.json, which lists the studio's games,
each in a folder of its own beside it.

Usage:
  rolarie-studio books [slug...]   play each game's maths into books, weigh them to
                                    96%, run the site's check on them and say what
                                    they hold
  rolarie-studio client [slug...]  build each game's client, and write the record of
                                    what was built (client/client.json), to commit
  rolarie-studio check [slug...]   the site's checks on each game: its books, its
                                    guide, its maths, and its client as it was built
                                    and put on record
  rolarie-studio pack [slug...]    pack each game, checked, into the one file a studio
                                    sends of it: <slug>-<version>.tar.gz, with its
                                    game.json, guide.json and card, its client as
                                    built, its books and any assets
  rolarie-studio make [slug...]    all four of those, one after another: each game's
                                    books made, its client built, the checks run and
                                    the game packed. Stops at the first that fails,
                                    with nothing packed
  rolarie-studio dev <slug>        build the client as it changes, and play the game in a
                                    browser against a stand-in for the site

  rolarie-studio stories           open Storybook on the studio's stories (*.stories.ts
                                    beside a game's client) and the SDK's own, with
                                    rounds from the studio's real books to play in them

Options:
  --root <folder>    the studio's folder, with its studio.json (default: here)
  --workers <number> books, make: how many workers to play on (default: one for each core)
  --trial            pack, make: pack a client built on packages from their clones too, for
                     trying a game. A game to publish is never packed with it
  --follows <file>   check: the game.json of the version this one is to follow on a
                     site. Says whether it may: its version comes after, it keeps
                     every size of bet, and nobody is left holding less in its counters
  --own-names        check: allow the SDK under #sdk/... in maths. For the SDK's own test
                     game only: a release is never checked with it
  --build            check: build each client again first, and hold what the source
                     builds now to the record
  --out <folder>     pack, make: where the file goes (default: release)
  --port <number>    dev: where to serve it (default: 4280); stories: (default: 6006)
  --build <folder>   stories: build them as a site into this folder, and stop
  --balance <amount> dev: the pretend balance to start with (default: 25.00)
`;

const { version } = JSON.parse(
	readFileSync(join(import.meta.dir, "..", "package.json"), "utf8")
) as {
	version: string;
};

function parse(argv: string[]) {
	const options: Record<string, string | true> = {};
	const words: string[] = [];
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (!arg.startsWith("--")) {
			words.push(arg);
			continue;
		}
		const [name, inline] = arg.slice(2).split("=", 2);
		if (inline !== undefined) options[name] = inline;
		else if (
			["root", "port", "balance", "workers", "out", "follows"].includes(name) ||
			// Only `stories --build <folder>` names something: `check --build` is a switch,
			// and must not take the game named after it for its value.
			(name === "build" &&
				argv.find((word) => !word.startsWith("--")) === "stories")
		)
			options[name] = argv[++i] ?? "";
		else options[name] = true;
	}
	return { command: words[0], slugs: words.slice(1), options };
}

const errorText = (error: unknown) =>
	error instanceof Error ? error.message : String(error);

/** Every check on one game: its books, its guide, its maths and its client. */
async function checkOne(
	folder: GameFolder,
	root: string,
	manifest: StudioManifest,
	ownNames: boolean
): Promise<string[]> {
	if (!isBookGame(folder))
		return [
			"there is no game.json beside its maths: a game is played from books (see the README)"
		];

	return [
		// First, whether this SDK and the game understand each other at all.
		...unsupported(folder.dir),
		...(await checkBooksOf(folder)),
		...scanMaths(folder.maths, { ownNames }),
		...checkClient(folder, root, manifest)
	];
}

/**
 * The site's checks on a game played from books, short of its client: its manifest, its
 * guide, which is plain data, and its books, which must be the ones recorded and pass
 * the check that sums each mode's return.
 */
async function checkBooksOf(folder: GameFolder): Promise<string[]> {
	const problems: string[] = [];

	try {
		const { checkGameFolder } = await import("./book-files.ts");
		const checked = checkGameFolder(folder.dir);

		if (checked.game.slug !== folder.slug)
			problems.push(
				`its game.json names it "${checked.game.slug}", not "${folder.slug}"`
			);

		problems.push(...checked.check.problems);
	} catch (error) {
		problems.push(
			`its books could not be checked: ${errorText(error)} Make them with: rolarie-studio books ${folder.slug}`
		);
	}

	if (!existsSync(folder.guide))
		problems.push("there is no guide.json beside its game.json");
	else
		try {
			checkGuide(folder.slug, await loadGuide(folder));
		} catch (error) {
			problems.push(errorText(error));
		}

	return problems;
}

/**
 * The checks on a game's client: what its source imports, that it has no configuration of
 * its own, that what is built is the client its record names, and what was built.
 */
function checkClient(
	folder: GameFolder,
	root: string,
	manifest: StudioManifest
): string[] {
	const problems: string[] = [];

	if (!existsSync(join(folder.client, "src", "routes"))) {
		return [
			"there is no client/src/routes: a client is a SvelteKit app, its page in src/routes/+page.svelte"
		];
	}

	problems.push(
		...scanClientSource(folder.client, root, [
			folder.dir,
			...sharedFolders(manifest).map((name) => join(root, name))
		])
	);
	for (const name of [
		"vite.config.ts",
		"vite.config.js",
		"vite.config.mjs",
		"svelte.config.js",
		"svelte.config.ts",
		"index.html",
		"src/app.html"
	])
		if (existsSync(join(folder.client, name)))
			problems.push(
				`client/${name} is never used: every client is built the same way, by the SDK. Take it out.`
			);

	// The client a release sends is the one built here and put on record, file for file.
	const built = checkBuiltClient(folder.dir);
	problems.push(...built);
	if (built.length === 0) problems.push(...scanClient(join(folder.client, "dist")));

	return problems;
}

/** The problems with the studio as a whole: its manifest beyond its shape, and its shared folders. */
function checkStudio(root: string, manifest: StudioManifest): string[] {
	const problems: string[] = [];
	const games = gameFolders(root);
	for (const name of games)
		if (!manifest.games.includes(name))
			problems.push(
				`${name}/ holds a game's maths, but studio.json does not list it`
			);
	// What its clients share is held to their rules. Maths can import nothing from it.
	const shared = sharedFolders(manifest).map((name) => join(root, name));
	for (const folder of shared)
		if (!existsSync(folder))
			problems.push(`it shares ${relative(root, folder)}/, which is not there`);
		else problems.push(...scanClientSource(folder, root, shared));

	// A package the manifest names is source of the studio's own, taken in to be read with
	// its games: held to a client's rules.
	for (const name of Object.keys(sharedPackages(manifest))) {
		const folder = packageFolder(root, name);

		if (!folder)
			problems.push(
				`it names the package ${name}, which is not here: install it (it is a dependency in package.json too)`
			);
		else if (
			existsSync(join(folder, "package.json")) &&
			"exports" in JSON.parse(readFileSync(join(folder, "package.json"), "utf8"))
		)
			problems.push(
				`the package ${name} has "exports" in its package.json: a shared package is plain source, imported by its files' paths`
			);
		else
			problems.push(
				...scanClientSource(folder, folder, [folder]).map(
					(problem) => `${name}: ${problem}`
				)
			);
	}

	return problems;
}

async function check(root: string, slugs: string[], build = false, ownNames = false) {
	const manifest = readManifest(root);
	let failed = false;
	const studio = checkStudio(root, manifest);
	if (studio.length) {
		failed = true;
		console.error("studio.json:");
		for (const problem of studio) console.error(`  - ${problem}`);
	}
	for (const folder of pickGames(root, slugs)) {
		// Built again first, where asked, without touching the record: the source as it
		// stands must build the client the record names.
		const unbuilt: string[] = [];
		if (build)
			try {
				await buildClient(folder.client);
			} catch (error) {
				unbuilt.push(errorText(error));
			}

		const problems = [
			...unbuilt,
			...(await checkOne(folder, root, manifest, ownNames))
		];
		if (problems.length === 0) {
			console.log(`${folder.slug}: passes every check.`);
		} else {
			failed = true;
			console.error(`${folder.slug}:`);
			for (const problem of problems) console.error(`  - ${problem}`);
		}
	}
	return failed ? 1 : 0;
}

/**
 * Makes the books of each game asked for, or of every game the studio has that is played
 * from books, and prints what they hold. Fails if any game's books do not pass the check.
 */
async function makeAllBooks(
	root: string,
	slugs: string[],
	workers?: number
): Promise<number> {
	const { makeBooks } = await import("./book-maker.ts");
	const { formatReport } = await import("./book-report.ts");
	const folders = pickGames(root, slugs);
	let failed = false;
	let made = 0;

	for (const folder of folders) {
		if (!existsSync(join(folder.dir, "game.json"))) {
			if (slugs.length > 0) {
				console.error(
					`${folder.slug}: it has no game.json, so it is not played from books.`
				);
				failed = true;
			}
			continue;
		}

		const started = Date.now();
		console.log(`${folder.slug}: making its books`);

		const books = await makeBooks(folder.dir, {
			workers,
			log: (line) => console.log(`  ${line}`)
		});
		made += 1;

		console.log(`\n${formatReport(books.tables, books.check.modes)}\n`);

		if (!books.check.passed) {
			for (const problem of books.check.problems) console.error(`  - ${problem}`);
			console.error(`${folder.slug}: its books do NOT pass the site's check.`);
			failed = true;
			continue;
		}

		console.log(
			`${folder.slug}: books made and checked, ${Math.round((Date.now() - started) / 1000)}s. books/books.json is the record to commit; the books themselves go with a release.`
		);
	}

	if (made === 0 && !failed)
		console.log("No game here is played from books (none has a game.json).");

	return failed ? 1 : 0;
}

/**
 * Packs each game asked for, or every game the studio has, into the one file a studio
 * sends of it. Fails if any game's books or client are missing or are not the ones on
 * record.
 */
async function packAllGames(
	root: string,
	slugs: string[],
	out: string,
	trial = false
): Promise<number> {
	const { packGame } = await import("./release-pack.ts");
	let failed = false;

	for (const folder of pickGames(root, slugs).filter(isBookGame))
		try {
			const packed = await packGame(folder.dir, folder.slug, out, { trial });

			console.log(
				`${folder.slug} at ${packed.version}: ${packed.name}, ${(packed.size / 1e6).toFixed(1)} MB, sha256 ${packed.sha256}`
			);
		} catch (error) {
			failed = true;
			console.error(
				`${folder.slug}: ${errorText(error)} Make its books with rolarie-studio books ${folder.slug}, and build its client with rolarie-studio client ${folder.slug}.`
			);
		}

	if (failed) return 1;

	/** The folder as a command would name it from here. */
	const from = relative(process.cwd(), out);

	console.log(
		`\nPacked into ${from.startsWith("..") ? out : from || "."}. Each file is all of a game that leaves here: its manifest, guide and card, its client as built, its books and any assets.`
	);

	return 0;
}

/**
 * Says whether a game, as it stands, may follow another version of itself on a site
 * (the engine's `checkUpdate`): `before` is that version's `game.json`.
 */
async function checkFollows(root: string, slugs: string[], before: string) {
	if (slugs.length !== 1) {
		console.error(
			"Name the one game: rolarie-studio check <slug> --follows <game.json>"
		);

		return 1;
	}

	const { checkGameManifest } = await import("./game-manifest.ts");
	const { readGameManifest } = await import("./book-files.ts");
	const { checkUpdate } = await import("./counter-conversion.ts");
	const [folder] = pickGames(root, slugs);
	const was = checkGameManifest(before, JSON.parse(readFileSync(before, "utf8")));
	const next = readGameManifest(folder.dir);
	const { problems, excessBp } = checkUpdate(was, next);

	if (problems.length > 0) {
		console.error(`${next.slug} at ${next.version} may not follow ${was.version}:`);
		for (const problem of problems) console.error(`  - ${problem}`);

		return 1;
	}

	console.log(
		`${next.slug} at ${next.version} may follow ${was.version}.${
			next.counters && was.counters
				? ` What players hold in its counters is carried over, and nobody holds less; rounding gives away at most ${(excessBp / 10_000).toFixed(4)} of a bet.`
				: ""
		}`
	);

	return 0;
}

/** Where `dev` serves a game unless told otherwise. */
const DEV_PORT = 4280;

/**
 * Ports a browser will not open, whatever is served there: each is kept for another
 * protocol (4190, where `dev` once served, is a mail server's). A game served on one is a
 * page that never loads, with no word of why, so `dev` refuses them itself.
 */
const UNSAFE_PORTS = new Set([
	1, 7, 9, 11, 13, 15, 17, 19, 20, 21, 22, 23, 25, 37, 42, 43, 53, 69, 77, 79, 87, 95,
	101, 102, 103, 104, 109, 110, 111, 113, 115, 117, 119, 123, 135, 137, 139, 143, 161,
	179, 389, 427, 465, 512, 513, 514, 515, 526, 530, 531, 532, 540, 548, 554, 556, 563,
	587, 601, 636, 989, 990, 993, 995, 1719, 1720, 1723, 2049, 3659, 4045, 4190, 5060,
	5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697, 10080
]);

/**
 * Builds each game's client, and writes the record of what was built
 * (`client/client.json`), to be committed: a release sends exactly that client.
 */
async function buildAllClients(root: string, slugs: string[]): Promise<number> {
	let failed = false;

	for (const folder of pickGames(root, slugs))
		try {
			await buildClient(folder.client);
			const record = writeClientRecord(folder.dir);

			console.log(
				`${folder.slug}: built, ${Object.keys(record.files).length} files on record in client/client.json.`
			);
		} catch (error) {
			failed = true;
			console.error(`${folder.slug}: ${errorText(error)}`);
		}

	return failed ? 1 : 0;
}

/** How many workers `--workers` asks for: none said is `undefined`, and a number that cannot be one is `null`. */
function workersOf(said: string | true | undefined): number | undefined | null {
	if (said === undefined) return undefined;

	const workers = Number(said);

	return Number.isInteger(workers) && workers >= 0 ? workers : null;
}

/**
 * Makes each game asked for, or every game the studio has, from its source to the one
 * file a studio sends of it: its books, its client, the site's checks, and the package,
 * one after another. Stops at the first step that fails, so nothing is packed of a game
 * that did not pass.
 */
async function makeAllGames(
	root: string,
	slugs: string[],
	options: { workers?: number; out: string; trial: boolean }
): Promise<number> {
	const steps: [string, () => Promise<number>][] = [
		["books", () => makeAllBooks(root, slugs, options.workers)],
		["client", () => buildAllClients(root, slugs)],
		["check", () => check(root, slugs)],
		["pack", () => packAllGames(root, slugs, options.out, options.trial)]
	];

	for (const [step, run] of steps) {
		console.log(`\n== ${step} ==`);

		const code = await run();
		if (code !== 0) {
			console.error(
				`\nStopped at ${step}: nothing was packed. Put right what it says, and run make again.`
			);

			return code;
		}
	}

	return 0;
}

async function main(argv: string[]): Promise<number> {
	const { command, slugs, options } = parse(argv);
	const root = resolve(typeof options.root === "string" ? options.root : ".");

	if ("version" in options) {
		console.log(version);
		return 0;
	}
	switch (command) {
		case "check":
			if (typeof options.follows === "string")
				return checkFollows(root, slugs, resolve(options.follows));

			return check(
				root,
				slugs,
				"build" in options && command === "check",
				"own-names" in options
			);
		case "stories": {
			// Storybook's own command, with the SDK's configuration and no other.
			const { createRequire } = await import("node:module");
			const storybook = join(
				createRequire(import.meta.url).resolve("storybook/package.json"),
				"..",
				"dist",
				"bin",
				"dispatcher.js"
			);
			const config = join(import.meta.dir, "storybook");
			const how =
				typeof options.build === "string"
					? ["build", "-c", config, "-o", resolve(options.build)]
					: [
							"dev",
							"-c",
							config,
							"-p",
							String(options.port ?? 6006),
							"--no-open",
							"--ci"
						];

			readManifest(root);

			const { spawn } = await import("node:child_process");
			const running = spawn("node", [storybook, ...how], {
				stdio: "inherit",
				env: { ...process.env, STUDIO_ROOT: root }
			});

			// Stopped with this command, not left running behind it.
			for (const signal of ["SIGTERM", "SIGINT"] as const)
				process.on(signal, () => running.kill(signal));

			return new Promise<number>((done) =>
				running.on("exit", (code) => done(code ?? 0))
			);
		}
		case "client":
			return buildAllClients(root, slugs);
		case "pack":
			return packAllGames(
				root,
				slugs,
				resolve(
					typeof options.out === "string" ? options.out : join(root, "release")
				),
				"trial" in options
			);
		case "books":
		case "make": {
			const workers = workersOf(options.workers);
			if (workers === null) {
				console.error("--workers is a whole number: 0 plays without any.");
				return 1;
			}

			return command === "books"
				? makeAllBooks(root, slugs, workers)
				: makeAllGames(root, slugs, {
						workers,
						out: resolve(
							typeof options.out === "string"
								? options.out
								: join(root, "release")
						),
						trial: "trial" in options
					});
		}
		case "dev":
		case "dev-serve": {
			if (slugs.length !== 1) {
				console.error("Name the one game to play: rolarie-studio dev <slug>");
				return 1;
			}
			const port = Number(options.port ?? DEV_PORT);
			if (UNSAFE_PORTS.has(port)) {
				console.error(
					`Browsers refuse to open port ${port}: it is kept for another protocol. Choose another with --port.`
				);

				return 1;
			}
			const balanceText =
				typeof options.balance === "string" ? options.balance : "25.00";
			const { parseCoins } = await import("./coins.ts");
			const balance = parseCoins(balanceText);
			if (!Number.isInteger(port) || port <= 0 || balance === null) {
				console.error(
					"--port is a number, and --balance an amount such as 25.00."
				);
				return 1;
			}
			const [folder] = pickGames(root, slugs);
			const dev = await import("./dev.ts");
			return command === "dev"
				? dev.supervise({ cli: import.meta.path, root, folder, port, balance })
				: dev.serve({ root, folder, port, balance });
		}
		case "version":
			console.log(version);
			return 0;
		default:
			console.log(HELP);
			return command === undefined || command === "help" || "help" in options
				? 0
				: 1;
	}
}

if (import.meta.main) {
	main(process.argv.slice(2)).then(
		(code) => {
			if (code !== -1) process.exit(code);
		},
		(error) => {
			console.error(errorText(error));
			process.exit(1);
		}
	);
}
