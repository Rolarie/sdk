/**
 * The SDK's Storybook: what `rolarie-studio stories` runs. It shows the stories a studio
 * has written beside its games' clients (`*.stories.ts`), and the SDK's own, of the
 * pieces every game shares. It is the SDK's as the client build is: a studio brings no
 * Storybook configuration, and none of its own is read.
 *
 * `STUDIO_ROOT` is the studio's folder, set by the command.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/svelte-vite";
import { readManifest } from "../studio-folder.ts";
import { storyBooksPlugin } from "./books-plugin.ts";

const here = dirname(fileURLToPath(import.meta.url));
const sdk = resolve(here, "..");
const root = resolve(process.env.STUDIO_ROOT ?? ".");

/** Where the typefaces the SDK's style sheets load are installed. */
const TYPEFACES = ["@fontsource-variable/geist", "@fontsource-variable/geist-mono"].map(
	(name) => dirname(createRequire(import.meta.url).resolve(`${name}/package.json`))
);

const config: StorybookConfig = {
	framework: {
		name: "@storybook/svelte-vite",
		// Built by the SDK's own configuration, whatever is in the folder it is run from.
		options: { builder: { viteConfigPath: join(here, "vite.config.ts") } }
	},
	stories: [
		// The SDK's own: the pieces every game shares, and rounds from the studio's books.
		{ directory: join(sdk, "stories"), files: "*.stories.ts", titlePrefix: "SDK" },
		// The studio's: beside each game's client, and in what its games share.
		{ directory: root, files: "*/client/**/*.stories.ts" },
		// Not where the studio's folder is the SDK's own repository: its `src/stories` are the
		// SDK's, listed above, and listed twice the second copy of each does not open.
		...(resolve(root, "sdk") === sdk
			? []
			: [{ directory: root, files: "*/stories/**/*.stories.ts" }])
	],
	core: { disableTelemetry: true, disableWhatsNewNotifications: true },
	viteFinal: (viteConfig) => ({
		...viteConfig,
		plugins: [...(viteConfig.plugins ?? []), storyBooksPlugin(root)],
		optimizeDeps: {
			...viteConfig.optimizeDeps,
			// The SDK is source, Svelte and runes among it, wherever it is read from: where it
			// is a dependency of what runs this (the site, with a studio taken in), Vite would
			// otherwise bundle it ahead as it does a finished package, and cannot.
			exclude: [
				...(viteConfig.optimizeDeps?.exclude ?? []),
				"@rolarie/sdk",
				// And so are the packages the studio's games share.
				...Object.keys(readManifest(root).packages ?? {})
			],
			// What the SDK itself draws with is a finished package, and is still bundled ahead.
			include: [
				...(viteConfig.optimizeDeps?.include ?? []),
				"@rolarie/sdk > pixi.js",
				"@rolarie/sdk > pixi.js/unsafe-eval"
			]
		},
		server: {
			...viteConfig.server,
			fs: {
				...viteConfig.server?.fs,
				// The bar's typefaces are packages of the SDK's, which a package manager may
				// keep outside the folder this is run from: their files are served all the same.
				allow: [...(viteConfig.server?.fs?.allow ?? []), root, sdk, ...TYPEFACES]
			},
			watch: {
				...viteConfig.server?.watch,
				// What is made, not written. A client built again (`rolarie-studio dev`
				// beside this, or a test) is a page of HTML changed, at which Vite reloads
				// every story, in the middle of whatever it was playing. Books are data
				// the server reads, and what is kept beside them is no story's concern.
				ignored: ["**/client/dist/**", "**/books/**", "**/test-results/**"]
			}
		}
	})
};

export default config;
