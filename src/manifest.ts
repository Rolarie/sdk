/**
 * `studio.json`: what a repository of a studio's holds, at its root. A studio keeps its
 * games in as many repositories as it likes, one game to each or several together; each
 * has one of these, and a release of the repository is what the site takes in.
 *
 *   {
 *     "sdk": "^0.14.0",
 *     "games": ["game-title"],
 *     "packages": { "@studio-name/kit": "https://github.com/studio-name/kit.git#v1.2.0" }
 *   }
 *
 * - `sdk` is the version of this SDK the games were built on, as a range (`^0.14.0`).
 * - `games` lists the games here by slug. Each is a folder beside studio.json, laid out
 *   as studio-folder.ts says. The order says nothing: the site orders what it lists.
 * - `shared`, if given, names folders beside the games that their clients share (code,
 *   art, sound).
 * - `packages`, if given, names what the clients share with the studio's other
 *   repositories: each a package of source (TypeScript, Svelte, styles, art), kept in a
 *   git repository of its own and named here at a tag. In the studio's repository it is
 *   an ordinary dependency, installed; the site fetches it at that tag as source, reads
 *   it as it reads a client, and builds with it. It has no `exports` of its own: a
 *   client imports its files by their paths (`@studio-name/kit/sound.ts`).
 * - `id`, `name` and `blurb`, if given, are what the studio's own tools call it. The site
 *   does not read them: a studio is known to the site by the name it was registered
 *   under and the id the site gave it then.
 *
 * A client may import from its own game's folder, the shared folders and the packages,
 * and nothing else of the studio's; maths imports none of them.
 *
 * Pure: read in the browser as well as on a server.
 */
import * as v from "valibot";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PACKAGE = /^(@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
/** What every client is built with already: not a studio's to name. */
const RESERVED = /^(@rolarie\/|svelte$|pixi\.js$|vite$)/;
const slug = (what: string) =>
	v.pipe(
		v.string(),
		v.regex(SLUG, `${what} is lowercase words joined by hyphens`),
		v.maxLength(40)
	);

export const studioManifest = v.pipe(
	v.strictObject({
		id: v.optional(slug("The studio's id")),
		name: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(60))),
		blurb: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120))),
		sdk: v.pipe(
			v.string(),
			v.regex(
				/^[\^~]?\d+\.\d+\.\d+$/,
				'sdk is the version it was built on, such as "^0.3.0"'
			)
		),
		games: v.pipe(
			v.array(slug("A game's slug")),
			v.minLength(1, "It lists no games"),
			v.maxLength(50),
			v.check(
				(games) => new Set(games).size === games.length,
				"A game is listed twice"
			)
		),
		shared: v.optional(
			v.pipe(v.array(slug("A shared folder's name")), v.maxLength(10))
		),
		packages: v.optional(
			v.pipe(
				v.record(
					v.pipe(
						v.string(),
						v.regex(
							PACKAGE,
							'A package is named as packages are: "kit", or "@studio/kit"'
						),
						v.maxLength(80)
					),
					v.pipe(
						v.string(),
						v.regex(
							/^[^\s#-][^\s#]*#[\w.+-]+$/,
							'A package is a git repository at a tag: "https://github.com/studio/kit.git#v1.0.0"'
						),
						v.maxLength(300)
					)
				),
				v.check(
					(packages) => Object.keys(packages).length <= 20,
					"More than twenty packages"
				),
				v.check(
					(packages) =>
						!Object.keys(packages).some((name) => RESERVED.test(name)),
					"A package may not take the name of the SDK, Svelte or Pixi"
				)
			)
		)
	}),
	v.check(
		(manifest) =>
			!(manifest.shared ?? []).some((name) => manifest.games.includes(name)),
		"A folder is both a game and shared"
	)
);

export type StudioManifest = v.InferOutput<typeof studioManifest>;

/** The folders of a studio its clients may import from besides their own: its `shared` ones. */
export const sharedFolders = (manifest: StudioManifest): string[] =>
	manifest.shared ?? [];

/** A shared package as a manifest names it: where its repository is, and the tag. */
export function packageSource(spec: string): { repository: string; tag: string } {
	const at = spec.lastIndexOf("#");

	return { repository: spec.slice(0, at), tag: spec.slice(at + 1) };
}

/** The packages a manifest names, by name: each a git repository at a tag. */
export const sharedPackages = (manifest: StudioManifest): Record<string, string> =>
	manifest.packages ?? {};

/** A studio's manifest, checked. Throws, naming where it came from, if it is not one. */
export function checkManifest(from: string, manifest: unknown): StudioManifest {
	const parsed = v.safeParse(studioManifest, manifest);
	if (!parsed.success) {
		const issue = parsed.issues[0];
		const at = issue.path?.map((step) => step.key).join(".");
		throw new Error(
			`${from} is not a studio manifest the site can read: ${at ? `${at}: ` : ""}${issue.message}`
		);
	}
	return parsed.output;
}
