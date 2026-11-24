import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { scanClient, scanMaths } from "./testing.ts";

const root = mkdtempSync(join(tmpdir(), "rolarie-sdk-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

/** Writes files under a fresh folder of the scratch root, and gives the folder. */
let folders = 0;
function folder(files: Record<string, string>): string {
	const dir = join(root, String(++folders));
	for (const [name, text] of Object.entries(files)) {
		mkdirSync(dirname(join(dir, name)), { recursive: true });
		writeFileSync(join(dir, name), text);
	}
	return dir;
}

describe("the site's checks, as a studio runs them", () => {
	it("pass pure maths that imports what maths is written with, valibot and itself, and has its own test", () => {
		const maths = folder({
			"index.ts": `import * as v from "valibot";\nimport { defineBooks } from "@rolarie/sdk/book-play";\nimport { createRound } from "@rolarie/sdk/slots";\nimport type { Rng } from "@rolarie/sdk/rng";\nimport { reels } from "./rules.ts";`,
			"rules.ts": "export const reels = [1, 2, 3];",
			"maths.spec.ts": `import { readFileSync } from "node:fs";`
		});
		expect(scanMaths(maths)).toEqual([]);
	});

	it("refuse the SDK under a name of the package's own, unless asked for the SDK's test game", () => {
		const maths = folder({
			"index.ts": `import { defineBooks } from "#sdk/book-play";\nimport type { Rng } from "#sdk/rng";`,
			"maths.spec.ts": `import { readFileSync } from "node:fs";`
		});

		// A package.json could give that name to anything: as a release is checked, it is refused.
		expect(scanMaths(maths).join("\n")).toMatch(/imports "#sdk\/book-play"/);
		expect(scanMaths(maths, { ownNames: true })).toEqual([]);
		// And only those parts of it, even then.
		const more = folder({
			"index.ts": `import { connect } from "#sdk/client";\nimport x from "#other/thing";`,
			"maths.spec.ts": ""
		});
		expect(scanMaths(more, { ownNames: true })).toHaveLength(2);
	});

	it("find maths that reaches outside itself, draws its own randomness, or has no test", () => {
		const maths = folder({
			"index.ts": `import { connect } from "@rolarie/sdk/client";\nexport const roll = () => Math.random();`,
			"clock.ts": `import { x } from "../elsewhere";\nexport const now = Date.now();`
		});
		const problems = scanMaths(maths).join("\n");
		expect(problems).toMatch(/imports "@rolarie\/sdk\/client"/);
		expect(problems).toMatch(/imports "\.\.\/elsewhere"/);
		expect(problems).toMatch(/Math\.random/);
		expect(problems).toMatch(/Date\.now/);
		expect(problems).toMatch(/no test of its own/);
	});

	it("pass a client built as the site serves one, and find what the site would refuse", () => {
		const good = folder({
			"index.html": `<!doctype html><script crossorigin src="./_app/immutable/start.js"></script>`,
			"assets/index.js": `document.body.append(document.createElement("canvas"));`,
			"card.svg": "<svg/>"
		});
		expect(scanClient(good)).toEqual([]);

		const bad = folder({
			"index.html": `<!doctype html><script>alert(1)</script><link rel="stylesheet" href="/assets/index.css">`,
			"assets/index.js": `const menu = document.createElement("select");`,
			"assets/data.bin": "x"
		});
		const problems = scanClient(bad).join("\n");
		expect(problems).toMatch(/no card\.svg/);
		expect(problems).toMatch(/inline script/);
		expect(problems).toMatch(/from the site's root/);
		expect(problems).toMatch(/<select>/);
		expect(problems).toMatch(/data\.bin is a kind of file the site does not serve/);
		expect(scanClient(join(root, "nowhere"))[0]).toMatch(/no index\.html/);
	});
});
