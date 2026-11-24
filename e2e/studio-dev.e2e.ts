import { expect, test, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import {
	cpSync,
	mkdirSync,
	readFileSync,
	rmSync,
	utimesSync,
	writeFileSync
} from "node:fs";
import { join, resolve } from "node:path";

/** The SDK's test studio, and the game of it that has a client. */
const STUDIO = "src/test/book-studio";
const GAME = "reel-test";

/**
 * `rolarie-studio dev`, the SDK's stand-in for the site (src/dev.ts), on a copy of the
 * test studio's game and its books: a copy, so that its rebuilds never touch the game itself.
 * Under test-results, so that it finds the SDK in this repository. Each test starts its
 * own, on a port of its parallel slot (4200 and up), so that tests running at once never
 * share one.
 */
async function startDev() {
	const port = 4200 + test.info().parallelIndex;
	const root = resolve(`test-results/studio-dev-${port}`);
	rmSync(root, { recursive: true, force: true });
	mkdirSync(root, { recursive: true });
	cpSync(join(STUDIO, GAME), join(root, GAME), {
		recursive: true,
		filter: (path) =>
			!path.includes(join("client", "dist")) && !path.includes(".svelte-kit")
	});
	// A studio of that one game: the test studio's other has no client to play.
	writeFileSync(
		join(root, "studio.json"),
		JSON.stringify({ name: "Book Studio", sdk: "^0.21.0", games: [GAME] })
	);
	const dev: ChildProcess = spawn(
		"bun",
		[
			"src/cli.ts",
			"dev",
			GAME,
			"--root",
			root,
			"--port",
			String(port),
			"--balance",
			"10.00"
		],
		{ stdio: "ignore" }
	);
	const url = `http://localhost:${port}/`;
	await expect
		.poll(async () => (await fetch(`${url}api/state`).catch(() => null))?.ok, {
			timeout: 20_000
		})
		.toBe(true);
	return {
		url,
		root,
		/** Stops it, and waits until it has stopped, so the next test can have the port. */
		stop: async () => {
			const exited = new Promise((done) => dev.once("exit", done));
			dev.kill("SIGTERM");
			await exited;
			rmSync(root, { recursive: true, force: true });
		}
	};
}

async function openGame(page: Page, url: string) {
	await page.goto(url);
	const game = page.frameLocator("iframe.game-frame");
	await expect(game.locator('body[data-ready="true"]')).toBeAttached({
		timeout: 20_000
	});
	// In sight, once its page said it had something to show.
	await expect(page.locator("iframe.game-frame")).not.toHaveClass(/waiting/);
	return game;
}

test("dev plays a game against the stand-in, logs what the site would ignore, and sets a pretend balance", async ({
	page
}) => {
	const dev = await startDev();
	try {
		const errors: string[] = [];
		page.on("pageerror", (error) => errors.push(error.message));
		// Nothing a client does is refused or complained of in the console, its own frame's
		// included: a request the policy stops is written there.
		page.on("console", (message) => {
			if (message.type() === "error" || message.type() === "warning")
				errors.push(`${message.type()}: ${message.text()}`);
		});
		const game = await openGame(page, dev.url);
		const log = page.locator(".log");
		await expect(page.locator(".figure")).toHaveText("10.00");
		await expect(log).toContainText('"type":"init"');

		// The game is asked to count its frames here, and the page says how smoothly it is
		// drawn; the counts are kept out of the messages shown, which they would bury.
		await expect(log).toContainText('"measure":true');
		await expect(page.locator(".frames")).toContainText(/\d+ frames a second/, {
			timeout: 10_000
		});
		await expect(log).not.toContainText('"type":"frames"');

		// A message the site would ignore is logged as ignored, with why.
		await page
			.frames()
			.find((frame) => frame.url().includes("/studio-frame/"))!
			.evaluate(() =>
				window.parent.postMessage(
					{
						protocol: "rolarie-game/2",
						type: "open",
						id: 9,
						bet: -5,
						params: {}
					},
					"*"
				)
			);
		await expect(log).toContainText("ignored, as the site would");

		// A spin: the stake leaves at once, and the round is played by the stand-in, from the
		// game's books. What it paid is in the balance once the game says it was shown. The
		// client may be built once more just after `dev` starts, which loads the game again
		// under a spin: it is spun again until one has been shown to its end.
		await expect(async () => {
			await game.getByRole("button", { name: "Spin", exact: true }).click();
			await expect(log).toContainText('"type":"round"');
			await expect(log).toContainText('"type":"settled"', { timeout: 10_000 });
		}).toPass({ timeout: 40_000 });
		await expect(page.locator(".seeds")).toContainText(/Bets on these seeds\s*[1-9]/);

		// The pretend balance can be set, and the game is told.
		await page.getByRole("textbox", { name: "New balance" }).fill("50.00");
		await page.getByRole("button", { name: "Set", exact: true }).click();
		await expect(page.locator(".figure")).toHaveText("50.00");
		await expect(log).toContainText('"type":"balance","balance":5000');

		// The phone's shape.
		// A phone's room: the engine chooses the tall view from it, since the game has one,
		// makes the frame that shape and tells the game, which shows its tall view.
		await page.getByRole("button", { name: "Phone, 9 by 16" }).click();
		await expect(page.locator("iframe.game-frame")).toHaveAttribute(
			"data-view",
			"tall"
		);
		await expect(log).toContainText('"type":"view","view":"tall"');
		await expect(
			page.frameLocator("iframe.game-frame").locator('.sdk-view[data-view="tall"]')
		).toBeVisible();
		const frame = await page.locator("iframe.game-frame").boundingBox();
		expect(frame!.height).toBeGreaterThan(frame!.width);
		// Coming back into view is when SvelteKit asks whether it has been replaced.
		await page
			.frameLocator("iframe.game-frame")
			.locator("body")
			.evaluate(() => window.dispatchEvent(new Event("focus")));
		await page.waitForTimeout(300);
		expect(errors).toEqual([]);
	} finally {
		await dev.stop();
	}
});

test("dev starts the stand-in again when the maths changes, and reloads the game when the client is rebuilt", async ({
	page
}) => {
	const dev = await startDev();
	try {
		const game = await openGame(page, dev.url);
		const log = page.locator(".log");
		const now = new Date();
		utimesSync(join(dev.root, GAME, "maths", "index.ts"), now, now);
		await expect(log).toContainText("The maths changed", { timeout: 20_000 });
		await expect(game.locator('body[data-ready="true"]')).toBeAttached({
			timeout: 20_000
		});

		utimesSync(
			join(dev.root, GAME, "client", "src", "routes", "+page.svelte"),
			now,
			now
		);
		await expect(log).toContainText("The client was built again", {
			timeout: 20_000
		});
		await expect(game.locator('body[data-ready="true"]')).toBeAttached({
			timeout: 20_000
		});
	} finally {
		await dev.stop();
	}
});
