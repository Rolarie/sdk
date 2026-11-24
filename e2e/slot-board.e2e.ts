/**
 * The SDK's shared slot pieces (src/slot), played from a round's events
 * (src/events.ts) in a browser, under the policy a studio game's client is served
 * with: that a row's events are played in order, each waited for, that the board lands
 * where a spin says, falls as the maths says it does, and lights a win with its amount,
 * and that the meter fills.
 *
 * The page is the SDK's own (src/test/slot-board), built as every client is.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import { expect, test, type Page } from "@playwright/test";
import { tumble } from "@rolarie/sdk/slots";
import {
	DROPS,
	LANDED,
	START,
	HELD_FALLEN,
	TAKEN,
	type Sym
} from "../src/test/slot-board/client/src/round";
import { serveClient } from "./client-server";

/** The colour of each symbol's picture, and of one dimmed because it did not win. */
const COLOUR: Record<Sym, string> = {
	a: "220,40,40",
	b: "0,200,80",
	c: "40,80,220",
	d: "230,200,0"
};
const colours = (grid: Sym[][]) =>
	grid.map((column) => column.map((symbol) => COLOUR[symbol]));

/** What the board shows once the top row has been taken away and the rest has fallen. */
const FALLEN = tumble(LANDED, TAKEN, (reel) => [...DROPS[reel]]).grid;

test.describe.configure({ mode: "serial" });

let served: Awaited<ReturnType<typeof serveClient>>;

test.beforeAll(async () => {
	served = await serveClient(
		"src/test/slot-board/client",
		"slot-board",
		4250 + test.info().parallelIndex
	);
});

test.afterAll(async () => {
	await served.stop();
});

/** Opens the page and waits for its stage. */
async function open(page: Page) {
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));

	await page.goto(served.url);
	await expect(page.locator('body[data-ready="true"]')).toBeAttached({
		timeout: 20_000
	});

	return errors;
}

/** Has the page write what it has drawn, and hands it back. */
async function read(page: Page) {
	await page.getByRole("button", { name: "Read" }).click();
	await expect(page.locator("body[data-cells]")).toBeAttached();

	return page.evaluate(() => ({
		cells: JSON.parse(document.body.dataset.cells!) as string[][],
		showing: JSON.parse(document.body.dataset.showing!) as string[][],
		meter: JSON.parse(document.body.dataset.meter!) as string[],
		log: JSON.parse(document.body.dataset.log ?? "[]") as string[],
		stopped: JSON.parse(document.body.dataset.stopped ?? "[]") as string[]
	}));
}

/** Plays the round and waits until it is over. */
async function play(page: Page) {
	await page.getByRole("button", { name: "Play" }).click();
	await expect(page.locator('body[data-played="true"]')).toBeAttached({
		timeout: 10_000
	});
}

test("a round's events are played in order on the board, which lands and falls as they say", async ({
	page
}) => {
	const errors = await open(page);

	// Before anything is played: the grid it was given.
	expect((await read(page)).cells).toEqual(colours(START));

	await play(page);
	const played = await read(page);

	// Each event waited for the pieces: the reels stopped left to right before the spin
	// was over, the win was lit before anything fell, and the total came last.
	expect(played.log).toEqual([
		"spin",
		"stop 0",
		"stop 1",
		"stop 2",
		"landed",
		"wins",
		"fell",
		"total 15000"
	]);

	// What is drawn is what the maths says is left once the win has gone and the rest fallen.
	expect(played.showing).toEqual(FALLEN);
	expect(played.cells).toEqual(colours(FALLEN));

	expect(played.stopped).toEqual([]);
	expect(errors).toEqual([]);
});

test("played with nothing moving, a round ends in the same place", async ({ page }) => {
	const errors = await open(page);

	await page.getByLabel("Instant").check();
	await play(page);
	const played = await read(page);

	expect(played.log).toEqual([
		"spin",
		"stop 0",
		"stop 1",
		"stop 2",
		"landed",
		"wins",
		"fell",
		"total 15000"
	]);
	expect(played.cells).toEqual(colours(FALLEN));
	expect(errors).toEqual([]);
});

test("a win is lit with the rest dimmed, and a meter fills to its figure", async ({
	page
}) => {
	const errors = await open(page);

	// The top row of the grid it began with is lit; the row under it is dimmed.
	await page.getByRole("button", { name: "Wins" }).click();
	const lit = await read(page);

	lit.cells.forEach((column, reel) => {
		expect(column[0]).toBe(COLOUR[START[reel][0]]);
		expect(column[1]).not.toBe(COLOUR[START[reel][1]]);

		// Dimmed, not gone: every part of its colour is lower, none higher.
		const full = COLOUR[START[reel][1]].split(",").map(Number);
		const dimmed = column[1].split(",").map(Number);
		dimmed.forEach((part, index) => expect(part).toBeLessThanOrEqual(full[index]));
	});

	// The meter is empty, then half full.
	expect(new Set(lit.meter).size).toBe(1);
	await page.getByRole("button", { name: "Fill" }).click();
	await expect
		.poll(async () => (await read(page)).meter)
		.toEqual(["255,255,255", lit.meter[1]]);

	expect(errors).toEqual([]);
});

test("a piece held in place keeps its cells while the rest falls past it", async ({
	page
}) => {
	const errors = await open(page);

	for (const instant of [false, true]) {
		if (instant) await page.getByLabel("Instant").check();
		await page.evaluate(() => delete document.body.dataset.held);
		await page.getByRole("button", { name: "Hold" }).click();
		await expect(page.locator('body[data-held="true"]')).toBeAttached({
			timeout: 10_000
		});

		const fallen = await read(page);

		// The piece's cell shows its picture, and what came down the reel landed under it.
		expect(fallen.showing).toEqual(HELD_FALLEN);
		expect(fallen.cells).toEqual(colours(HELD_FALLEN));
	}

	expect(errors).toEqual([]);
});
