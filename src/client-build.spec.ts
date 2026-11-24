/**
 * Building a client (./client-build.ts): that SvelteKit's page is finished for the frame
 * it is played in, with no script written into it, and that a page with a loading screen
 * has the screen in it as its props dress it, with the code to wait for.
 *
 * Author: dwclake
 * Created: 2026-11-19
 */

import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { buildClient, sharedFolder } from "./client-build.ts";

// Inside the repository, so that Svelte and SvelteKit are found from it as from a studio's folder.
const scratch = fileURLToPath(new URL("../test-results", import.meta.url));
mkdirSync(scratch, { recursive: true });
const studio = mkdtempSync(join(scratch, "client-build-"));
afterAll(() => rmSync(studio, { recursive: true, force: true }));

const LOADING = fileURLToPath(new URL("./loading.ts", import.meta.url));
const RENDERED = `export const prerender = true;\n`;

/** Writes a client's files, builds it, and returns its page and how to read what was built. */
async function built(game: string, files: Record<string, string>) {
	const client = join(studio, game, "client");
	for (const [name, text] of Object.entries(files)) {
		mkdirSync(dirname(join(client, name)), { recursive: true });
		writeFileSync(join(client, name), text);
	}

	// Named from the folder this is run in, as a studio names it.
	await buildClient(relative(process.cwd(), client));

	const dist = join(client, "dist");

	return {
		page: readFileSync(join(dist, "index.html"), "utf8"),
		has: (file: string) => existsSync(join(dist, file)),
		read: (file: string) => readFileSync(join(dist, file), "utf8"),
		size: (file: string) => readFileSync(join(dist, file)).byteLength
	};
}

describe("a client's build", () => {
	it("renders the page as it is built, and starts it from a file: no script is written into it", async () => {
		const { page, has, read } = await built("plain", {
			"src/routes/+layout.ts": RENDERED,
			"src/routes/+page.svelte": `<script lang="ts">\n\tlet count = $state(0);\n</script>\n\n<svelte:head><title>Plain</title></svelte:head>\n<button onclick={() => count++}>pressed {count}</button>`,
			"public/card.svg": `<svg xmlns="http://www.w3.org/2000/svg" />`
		});

		// What the page shows first is in the page.
		expect(page).toContain("<title>Plain</title>");
		// Dark, as the site round it is: no white ground before it has drawn anything.
		expect(page).toContain(`<meta name="color-scheme" content="dark" />`);
		expect(page).toContain("pressed 0</button>");

		// Every script is a file of the client's own, asked for by a relative address.
		const scripts = [...page.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
		expect(scripts).toHaveLength(1);
		expect(scripts[0][2].trim()).toBe("");
		const start =
			/^ crossorigin src="\.\/(_app\/immutable\/start\.[\w-]{8}\.js)"$/.exec(
				scripts[0][1]
			);
		expect(start).not.toBeNull();
		expect(page).not.toMatch(/\b(src|href)="\//);

		// The script moved finds the code it starts from its own address.
		const script = read(start![1]);
		expect(script).toContain("kit.start(");
		// And answers SvelteKit's question of whether it has been replaced itself: a client
		// can make no request, and one refused is written in the console.
		expect(script).toMatch(/window\.fetch = /);
		expect(script).toContain(`/\\/_app\\/version\\.json(\\?|$)/`);
		expect(JSON.parse(read("_app/version.json"))).toEqual({ version: "client" });
		const asked = [...script.matchAll(/import\("\.\/([^"]+)"\)/g)].map(
			(found) => found[1]
		);
		expect(asked.length).toBeGreaterThan(0);
		for (const file of asked) expect(has(`_app/immutable/${file}`), file).toBe(true);

		// With no loading screen, nothing is there to fill one; what public held is copied.
		expect(page).not.toContain("loading-first");
		expect(has("card.svg")).toBe(true);
	});

	it("has a loading screen in the page as its props dress it, with the code to wait for and what fills it", async () => {
		const { page, has, read, size } = await built("waits", {
			"src/routes/+layout.ts": RENDERED,
			"src/later.ts": `export const LATER: string = "the game itself, asked for in the browser";`,
			"src/routes/+page.svelte": `<script lang="ts">\n\timport { onMount } from "svelte";\n\timport { LoadingScreen, createLoading } from "${LOADING}";\n\n\tconst loading = createLoading();\n\tonMount(async () => {\n\t\tawait loading.track(import("../later.ts"));\n\t\tawait loading.done();\n\t});\n</script>\n\n<LoadingScreen\n\t{loading}\n\ttitle="Tide & Time"\n\tlogo="./mark.svg"\n\tlook={{ surface: "linear-gradient(#123, #456)", fill: "#fc0", barWidth: 180 }}\n/>`,
			"public/mark.svg": `<svg xmlns="http://www.w3.org/2000/svg" />`
		});

		// The screen, dressed and named, waiting to be filled.
		const screen = /<div class="sdk-loading[^"]*"[^>]*>/.exec(page)![0];
		expect(screen).toContain("data-waiting");
		expect(screen).toContain(
			`style="--loading-surface: linear-gradient(#123, #456); --loading-fill: #fc0; --loading-bar-width: 180px"`
		);
		expect(page).toContain(`<img class="sdk-loading-logo" src="./mark.svg" alt=""`);
		expect(page).toContain(`<p class="sdk-loading-title">Tide &amp; Time</p>`);
		expect(page).toContain(`aria-label="Loading Tide &amp; Time"`);

		// What fills it is a file of the client's, asked for first.
		const filler =
			/<script defer crossorigin src="\.\/(_app\/immutable\/loading-first\.[\w-]{8}\.js)">/.exec(
				page
			);
		expect(filler).not.toBeNull();
		expect(has(filler![1])).toBe(true);
		// It tells the site the page has something to show, in the protocol the site speaks.
		expect(read(filler![1])).toContain(
			`{ protocol: "rolarie-game/3", type: "drawn" }`
		);
		expect(read(filler![1])).not.toContain("__PROTOCOL__");
		expect(page.indexOf(filler![0])).toBeLessThan(page.indexOf("modulepreload"));

		// The code named is real, by about its size, each file asked for from the start; the game's
		// own code that the page asks for only in the browser is among it.
		const code = /data-code="([^"]*)"/
			.exec(screen)![1]
			.split(",")
			.map((entry) => entry.split(":"));
		expect(code.length).toBeGreaterThan(3);
		let said = 0;
		let real = 0;
		for (const [file, bytes] of code) {
			said += Number(bytes);
			real += size(file);
			expect(page, file).toContain(`<link href="./${file}" rel="modulepreload">`);
		}
		// A weight, not a count: a small file may be finished after its size was noted.
		expect(said / real).toBeCloseTo(1, 1);
		const later = code.filter(([file]) =>
			readFileSync(join(studio, "waits", "client", "dist", file), "utf8").includes(
				"the game itself, asked for in the browser"
			)
		);
		expect(later).toHaveLength(1);
	});

	it("is refused where the page is not rendered as it is built", async () => {
		await expect(
			built("unrendered", {
				"src/routes/+page.svelte": `<p>Only in a browser.</p>`
			})
		).rejects.toThrow(/did not build|built no index\.html/);
	});

	it("names a component from the folder the client and the SDK are both in, wherever that is", () => {
		const here = dirname(fileURLToPath(import.meta.url));

		// A game beside the SDK's own files, and one deeper: from the nearest folder that holds both.
		expect(sharedFolder(here, here)).toBe(here);
		expect(sharedFolder(join(here, "test"), join(here, "controls"))).toBe(here);
		expect(sharedFolder(join(here, "test", "book-studio"), here)).toBe(here);
	});
});
