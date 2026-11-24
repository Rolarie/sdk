/**
 * The scan of a client's source: that a client written in Svelte is read as one written
 * without it is, that it may import what packages it likes but no file outside what the site takes in, and that
 * its stories, which only Storybook loads, are not held to a client's rules.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { scanClientSource } from "./testing.ts";

const root = mkdtempSync(join(tmpdir(), "rolarie-client-scan-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

/** Writes a studio's files, and scans the client of its game. */
function scan(files: Record<string, string>): string[] {
	const studio = mkdtempSync(join(root, "studio-"));

	for (const [name, text] of Object.entries(files)) {
		mkdirSync(dirname(join(studio, name)), { recursive: true });
		writeFileSync(join(studio, name), text);
	}

	return scanClientSource(join(studio, "game", "client"), studio, [
		join(studio, "game")
	]);
}

describe("a client's source", () => {
	it("may import any package by name, and its own game's files", () => {
		expect(
			scan({
				"game/client/src/Game.svelte": `<script lang="ts">
	import { onMount } from "svelte";
	import { Stage } from "@rolarie/sdk/pixi";
	import { Texture } from "pixi.js";
	import confetti from "canvas-confetti";
	import Sheet from "@studio-name/kit/Sheet.svelte";
	import { LINES } from "../../maths/rules";
</script>`,
				"game/client/src/routes/+page.svelte": `<script lang="ts">\n\timport Game from "../Game.svelte";\n</script>\n\n<Game />`
			})
		).toEqual([]);
	});

	it("is refused a file outside its game, in a Svelte file as in any other", () => {
		const problems = scan({
			"game/client/src/Game.svelte": `<script lang="ts">
	import { secret } from "../../../other-game/maths";
</script>`
		});

		expect(problems).toHaveLength(1);
		expect(problems[0]).toMatch(
			/Game\.svelte imports "\.\.\/\.\.\/\.\.\/other-game\/maths"/
		);
	});

	it("is not held to these rules in its stories, which are never built into it", () => {
		expect(
			scan({
				"game/client/src/Reels.stories.ts": `import type { Meta } from "@storybook/svelte-vite";\nimport ReelsStory from "./ReelsStory.svelte";`,
				"game/client/src/ReelsStory.svelte": `<script lang="ts">\n\timport { Board } from "@rolarie/sdk/slot";\n</script>`
			})
		).toEqual([]);
	});
});
