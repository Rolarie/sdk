/**
 * What a studio needs to check its own work the way the site will: the check of its guide
 * (./guide.ts), the limits a round is held to (./limits.ts), and the scans of a game's
 * maths and of its client.
 *
 * Runs under Bun or Node, not in a browser: the scans read files.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { CLIENT_FILE_TYPES } from "./frame.ts";

export { checkGuide, guideSchema } from "./guide.ts";
export { ROUND_MAX_ACTIONS, ROUND_MAX_STATE_BYTES, fitsInStore } from "./limits.ts";

/** The largest a single file of a client may be. */
export const CLIENT_FILE_MAX_BYTES = 5_000_000;

/**
 * What a game's maths may import: valibot, its own files, and the parts of the SDK that
 * maths is written with (how books are played, the slot helpers, the random stream), named
 * as the package.
 */
const MATHS_IMPORTS =
	/^(valibot|@rolarie\/sdk\/(book-play|slots|rng|maths)|\.\/[\w./-]+)$/;

/**
 * The same parts of the SDK under `#sdk/...`, a name of a package.json's own `imports`.
 * It is refused unless whoever asks for the scan says otherwise (`ownNames`), and nothing
 * that takes a release into a site's studios ever does: a package.json could give that
 * name to anything. It is for the SDK's own test game, which reaches a clone of the SDK
 * that way, checked by itself and taken in on trial only.
 */
const OWN_NAME_IMPORTS = /^#sdk\/(book-play|slots|rng|maths)$/;

/**
 * Anything that would make two makings of the same books differ, or reach outside the
 * game. A studio's maths is never run by the site, but it is run where its books are
 * made, and a book must come out the same each time: naming any of these fails the scan.
 */
const IMPURE =
	/Math\.random|Date\.now|new Date|performance\.|crypto\.|fetch\(|process\.|globalThis|\bself\b|\bBun\b|require\(|\beval\b|new Function|\.constructor\b|postMessage|addEventListener|import\.meta|setTimeout|setInterval/;

const importsOf = (source: string): string[] =>
	[...source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map(
		(match) => match[1]
	);

const isTest = (name: string) => /\.(spec|test)\.ts$/.test(name);
/** A client's stories, which only Storybook loads (`rolarie-studio stories`): never built into the client. */
const isStory = (name: string) => /\.stories\.ts$/.test(name);
/**
 * The problems with a game's maths folder, in words: an import it may not make, anything
 * impure, or no exact test of its own. Empty when there are none.
 */
export function scanMaths(
	folder: string,
	options: {
		/** Allow the SDK under `#sdk/...` too: for the SDK's own test game, never a release. */
		ownNames?: boolean;
	} = {}
): string[] {
	const mayImport = (from: string): boolean =>
		MATHS_IMPORTS.test(from) ||
		(options.ownNames === true && OWN_NAME_IMPORTS.test(from));

	const problems: string[] = [];
	const names = readdirSync(folder);
	const sources = names.filter((name) => name.endsWith(".ts") && !isTest(name));
	if (sources.length === 0) problems.push(`${folder} has no maths in it`);
	for (const name of sources) {
		const file = join(folder, name);
		const source = readFileSync(file, "utf8");
		for (const from of importsOf(source))
			if (!mayImport(from)) problems.push(`${file} imports "${from}"`);
		const impure = IMPURE.exec(source);
		if (impure) problems.push(`${file} uses ${impure[0]}`);
	}
	if (!names.some((name) => /\.spec\.ts$/.test(name)))
		problems.push(`${folder} has no test of its own (a maths.spec.ts)`);
	return problems;
}

/** Text a client's files may not contain, and why. */
const CLIENT_FORBIDDEN: [RegExp, string][] = [
	[
		/<select[\s>]|createElement\(\s*["']select["']/i,
		"a <select>: use Menu from the SDK's controls"
	],
	[
		/<input[^>]*type=["']?checkbox|createElement\(\s*["']input["']\s*\)[^;]*checkbox/i,
		"a checkbox: use Switch from the SDK's controls"
	]
];

/**
 * The problems with a built client (its `dist` folder), in words: a file of a kind the site
 * does not serve, an inline script (the policy refuses it), an address from the site's root
 * (it would not be found under the game's own folder), a browser control the SDK replaces,
 * or no card picture. Empty when there are none.
 */
export function scanClient(dist: string): string[] {
	const problems: string[] = [];
	if (!existsSync(join(dist, "index.html")))
		return [`${dist} has no index.html: is the client built?`];
	if (!existsSync(join(dist, "card.svg")))
		problems.push(
			`${dist} has no card.svg: the game's card picture goes in client/public/card.svg`
		);

	const walk = (folder: string): string[] =>
		readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
			entry.isDirectory()
				? walk(join(folder, entry.name))
				: [join(folder, entry.name)]
		);
	for (const file of walk(dist)) {
		const name = relative(dist, file);
		const type = CLIENT_FILE_TYPES[extname(file).toLowerCase()];
		if (!type) {
			problems.push(`${name} is a kind of file the site does not serve`);
			continue;
		}
		if (statSync(file).size > CLIENT_FILE_MAX_BYTES)
			problems.push(`${name} is over ${CLIENT_FILE_MAX_BYTES / 1_000_000} MB`);
		if (!/\.(html|js|css)$/.test(file)) continue;
		const text = readFileSync(file, "utf8");
		if (file.endsWith(".html")) {
			for (const tag of text.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))
				if (!/\bsrc=/.test(tag[1]) || tag[2].trim())
					problems.push(
						`${name} has an inline script, which the site's policy refuses`
					);
			if (/\b(src|href)=["']\/(?!\/)/.test(text))
				problems.push(
					`${name} loads something from the site's root ("/..."): build with base "./"`
				);
		}
		for (const [pattern, what] of CLIENT_FORBIDDEN)
			if (pattern.test(text)) problems.push(`${name} has ${what}`);
	}
	return problems;
}

/**
 * The problems with a client's source, in words. A studio builds its own client, with
 * whatever packages it installs, so what it imports by name is its own affair. What is
 * held is what makes the source the site takes in readable as a whole, and the client
 * able to run in its frame: a file it imports by a relative address is inside `within`
 * (its own game's folder and the studio's shared folders, which are what the site takes
 * in), and nothing is loaded from the network or from the site's root. Its tests and its
 * stories are not looked at; `dist`, `public` and what SvelteKit works out as it builds
 * (`.svelte-kit`) are not source.
 */
export function scanClientSource(
	client: string,
	studioRoot: string,
	within: string[]
): string[] {
	const problems: string[] = [];
	const root = resolve(studioRoot);
	const allowed = within.map((folder) => resolve(folder));
	const inside = (target: string) =>
		allowed.some((folder) => target === folder || target.startsWith(folder + sep));
	const walk = (folder: string): string[] =>
		readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
			if (entry.isDirectory())
				return ["dist", "public", "node_modules", ".svelte-kit"].includes(
					entry.name
				) && folder === client
					? []
					: walk(join(folder, entry.name));
			return /\.(ts|js|mjs|css|html|svelte)$/.test(entry.name) &&
				!isTest(entry.name) &&
				!isStory(entry.name)
				? [join(folder, entry.name)]
				: [];
		});
	for (const file of walk(client)) {
		const name = relative(root, file);
		const text = readFileSync(file, "utf8");
		const found = [
			...importsOf(text),
			...[...text.matchAll(/@import\s+(?:url\()?\s*['"]?([^'")\s;]+)/g)].map(
				(match) => match[1]
			),
			...(file.endsWith(".html")
				? [
						...text.matchAll(
							/<(?:script|link)\b[^>]*\b(?:src|href)=["']([^"']+)["']/gi
						)
					].map((match) => match[1])
				: [])
		];
		for (const from of found) {
			if (/^[a-z]+:/i.test(from) || from.startsWith("//"))
				problems.push(
					`${name} loads "${from}" from elsewhere: a client loads only its own files`
				);
			else if (from.startsWith(".")) {
				if (!inside(resolve(dirname(file), from)))
					problems.push(
						`${name} imports "${from}": a client imports from its own game's folder and the studio's shared folders only`
					);
			} else if (from.startsWith("/"))
				problems.push(
					`${name} loads "${from}" from the site's root: use a relative address`
				);
		}
	}
	return problems;
}
