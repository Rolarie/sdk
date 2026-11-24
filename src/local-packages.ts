/**
 * Whether the SDK is being run on the engine as it stands in the clone beside this
 * repository, and not the release installed: `ROLARIE_DEV=1`, which `bun run local ...`
 * sets. The SDK imports the engine through `imports` in package.json (`#engine/...`), and
 * the `rolarie-dev` condition there names the file in the clone (`local/engine`, a link that is
 * not committed). Bun and Node are told the condition on their command lines; Vite resolves
 * imports itself, so every Vite the SDK starts is told here.
 *
 * It is for developing the SDK and the engine together before either is released, and a
 * studio may use the same for a package of its own that its games share: a kit named in
 * its games' `imports` with a `local` condition is taken from its clone when a client is
 * built with `LOCAL_PACKAGES=1` (the README's "A package your games share, as you change
 * it"). Installed, the SDK finds the engine as the package it depends on.
 *
 * Author: dwclake
 * Created: 2026-11-19
 */
import type { UserConfig } from "vite";

/**
 * Whether the SDK itself is being developed, on the engine as it stands in the clone beside
 * this repository: `ROLARIE_DEV=1`. Its condition is `rolarie-dev`, a name of its own, so
 * that nothing a studio sets ever turns it on in an installed SDK, where there is no clone.
 */
export const DEV = process.env.ROLARIE_DEV === "1";

/**
 * Whether a studio is trying packages of its own from their clones: `LOCAL_PACKAGES=1`,
 * whose condition is `local`.
 */
export const LOCAL = process.env.LOCAL_PACKAGES === "1";

/** The conditions in use, for whatever resolves an import itself. */
export const LOCAL_CONDITIONS: string[] = [
	...(DEV ? ["rolarie-dev"] : []),
	...(LOCAL ? ["local"] : [])
];

/**
 * What a Vite configuration needs to resolve the engine as this run does: nothing, unless
 * the clone is in use. Spread into the configuration.
 */
export function localResolve(): Pick<UserConfig, "resolve" | "ssr"> {
	if (LOCAL_CONDITIONS.length === 0) return {};

	return {
		resolve: {
			conditions: [
				...LOCAL_CONDITIONS,
				"module",
				"browser",
				"development|production"
			],
			// A clone has packages of its own installed: one copy of each is used, the SDK and
			// the engine among them, or a studio's kit would be on another SDK than its game.
			dedupe: [
				"valibot",
				"@noble/hashes",
				"svelte",
				"pixi.js",
				"@rolarie/sdk",
				"@rolarie/engine"
			]
		},
		ssr: {
			resolve: {
				conditions: [
					...LOCAL_CONDITIONS,
					"module",
					"node",
					"development|production"
				]
			}
		}
	};
}
