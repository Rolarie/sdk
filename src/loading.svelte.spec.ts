/**
 * What a loading screen says when a game does not come: that it has stalled once nothing
 * has arrived for long enough, that it cannot load once it is told so, and neither once
 * the game is ready. In a browser, since it is the screen's own elements that say it.
 *
 * Author: dwclake
 * Created: 2026-11-23
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLoading } from "./loading.ts";

/** A loading screen's elements, as the component writes them. */
function screenElement(): HTMLElement {
	const screen = document.createElement("div");

	screen.className = "sdk-loading";
	screen.setAttribute("data-waiting", "");
	screen.innerHTML = `
		<div class="sdk-loading-bar"><div class="sdk-loading-fill"></div></div>
		<div class="sdk-loading-trouble">
			<p class="sdk-loading-problem" role="status"></p>
			<button type="button" class="sdk-loading-again">Try again</button>
		</div>`;
	document.body.append(screen);

	return screen;
}

const words = (screen: HTMLElement) =>
	screen.querySelector(".sdk-loading-problem")!.textContent;

describe("a loading screen whose game does not come", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		document.body.replaceChildren();
	});

	it("says it has stalled once nothing has arrived for twenty seconds, and takes it back when something does", async () => {
		const screen = screenElement();
		const loading = createLoading();
		let arrive!: () => void;

		loading.screen(screen);
		void loading.track(new Promise<void>((resolve) => (arrive = resolve)));
		void loading.track(new Promise<void>(() => {}));

		await vi.advanceTimersByTimeAsync(19_000);
		expect(screen.dataset.problem).toBeUndefined();

		await vi.advanceTimersByTimeAsync(1_500);
		expect(screen.dataset.problem).toBe("stalled");
		expect(words(screen)).toBe("This is taking longer than usual.");

		// Something arrives: it is coming after all, and the wait starts again.
		arrive();
		await vi.advanceTimersByTimeAsync(10);
		expect(screen.dataset.problem).toBeUndefined();
		await vi.advanceTimersByTimeAsync(20_500);
		expect(screen.dataset.problem).toBe("stalled");
	});

	it("says the game cannot load once it is told so, and keeps saying it", async () => {
		const screen = screenElement();
		const loading = createLoading();

		loading.screen(screen);
		loading.fail(new Error("no picture"));
		expect(screen.dataset.problem).toBe("failed");
		expect(words(screen)).toBe("The game did not finish loading.");

		// Nothing that settles afterwards, and no wait, changes what it says.
		void loading.track(Promise.resolve());
		await vi.advanceTimersByTimeAsync(30_000);
		expect(screen.dataset.problem).toBe("failed");
	});

	it("says a failure that came before the screen did", () => {
		const screen = screenElement();
		const loading = createLoading();

		loading.fail("early");
		loading.screen(screen);
		expect(screen.dataset.problem).toBe("failed");
	});

	it("says nothing once the game is ready, however long it has been", async () => {
		const screen = screenElement();
		const loading = createLoading();

		loading.screen(screen);
		await vi.advanceTimersByTimeAsync(21_000);
		expect(screen.dataset.problem).toBe("stalled");

		const done = loading.done();
		expect(screen.dataset.problem).toBeUndefined();
		await vi.advanceTimersByTimeAsync(2_000);
		await done;
		await vi.advanceTimersByTimeAsync(60_000);
		expect(screen.dataset.problem).toBeUndefined();
		expect(screen.hidden).toBe(true);
	});
});
