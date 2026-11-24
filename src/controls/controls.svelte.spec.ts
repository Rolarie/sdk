/**
 * The control bar and the SDK's controls as Svelte components
 * (`@rolarie/sdk/controls`), in a real browser: that the component is the SDK's
 * bar, that it is made once and then kept to its props,
 * that what the player sets comes back, and that what is written inside it for the menu
 * lies in the bar's menu. The rules a bar is held to are in bar-rules.svelte.spec.ts:
 * there is one bar, and this holds the component to being it.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import { createRawSnippet, flushSync, mount, unmount } from "svelte";
import { afterEach, describe, expect, it } from "vitest";
import type { BarHandle as Bar } from "../bar.ts";
import { ControlBar, Field, Menu, Switch } from "./index.ts";

let game: HTMLElement;
let mounted: Record<string, unknown>[] = [];

/** A positioned box the size of a game, for a bar to be placed in. */
function room(): HTMLElement {
	game = document.createElement("div");
	// A bar is placed in its game's view.
	game.className = "sdk-view";
	game.style.cssText = "position: relative; width: 1000px; height: 600px;";
	document.body.append(game);

	return game;
}

const settle = () =>
	new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
const button = (name: string) =>
	game.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
const readout = (segment: string) =>
	game.querySelector(`[data-segment="${segment}"] output`)!.textContent;
const segments = (within: HTMLElement) =>
	[...within.querySelectorAll<HTMLElement>(".sdk-bar-segment")]
		.filter((segment) => !segment.hidden)
		.map((segment) => [
			segment.dataset.segment,
			Math.round(
				segment.getBoundingClientRect().left - within.getBoundingClientRect().left
			),
			Math.round(segment.getBoundingClientRect().width)
		]);

const config = {
	bets: [10, 20, 50, 100],
	startBet: 20,
	limits: { minStake: 10, maxStake: 100 },
	play: { label: "Spin", symbol: "spin" } as const
};

/** Mounts the bar in a fresh room with these props, which may then be changed. */
function bar(more: Record<string, unknown> = {}) {
	const props = $state({
		...config,
		balance: 25_00,
		onplay: () => {},
		...more
	});
	mounted.push(mount(ControlBar, { target: room(), props }));
	flushSync();

	return props as typeof props & Record<string, unknown>;
}

afterEach(() => {
	for (const component of mounted) void unmount(component);
	mounted = [];
	game?.remove();
});

describe("the control bar as a component", () => {
	it("is the SDK's bar: its items in its order", async () => {
		bar({
			autoplay: {
				counts: [10],
				noun: ["spin", "spins"],
				onstart: () => {},
				onstop: () => {}
			}
		});

		await document.fonts.ready;
		await settle();

		expect(segments(game).map((segment) => segment[0])).toEqual([
			"menu",
			"balance",
			"bet",
			"play",
			"autoplay",
			"speed",
			"win"
		]);
	});

	it("shows what its props say, as they change", async () => {
		const props = bar({ win: 0, busy: false });
		await settle();

		expect(readout("balance")).toContain("25.00");

		props.balance = 31_50;
		props.win = 6_50;
		flushSync();
		expect(readout("balance")).toContain("31.50");
		expect(readout("win")).toContain("6.50");

		props.busy = true;
		flushSync();
		expect(button("Spin").disabled).toBe(true);
		expect(button("Raise the bet").disabled).toBe(true);

		props.busy = false;
		flushSync();
		expect(button("Spin").disabled).toBe(false);
	});

	it("is made once: a prop that changes does not undo what the player set", async () => {
		let bet: number | undefined;
		let made: Bar | undefined;
		// What the bar hands back is bound, as a page binds it: props it may set.
		const props = $state({ balance: 25_00 });
		mounted.push(
			mount(ControlBar, {
				target: room(),
				props: {
					...config,
					onplay: () => {},
					get balance() {
						return props.balance;
					},
					get bet() {
						return bet;
					},
					set bet(next: number | undefined) {
						bet = next;
					},
					get bar() {
						return made;
					},
					set bar(next: Bar | undefined) {
						made = next;
					}
				}
			})
		);
		flushSync();
		await settle();
		const element = game.querySelector(".sdk-bar");

		expect(bet).toBe(20);
		button("Raise the bet").click();
		expect(bet).toBe(50);
		expect(made?.bet).toBe(50);

		// The balance changes, as it does after every play: the same bar, the same bet.
		props.balance = 10_00;
		flushSync();
		expect(game.querySelector(".sdk-bar")).toBe(element);
		expect(made?.bet).toBe(50);
		expect(readout("balance")).toContain("10.00");
	});

	it("tells the game of a press on play, and of a bet changed", async () => {
		const heard: string[] = [];
		bar({
			onplay: () => heard.push("play"),
			onbet: (bet: number) => heard.push(`bet ${bet}`)
		});
		await settle();

		button("Spin").click();
		button("Lower the bet").click();

		expect(heard).toEqual(["play", "bet 10"]);
	});

	it("puts what is written for its menu in the bar's menu, and keeps it up to date there", async () => {
		const state = $state({ rounds: 3 });
		bar({
			menu: createRawSnippet(() => ({
				render: () => `<p class="rounds"></p>`,
				setup(node: Element) {
					$effect(() => {
						node.textContent = `${state.rounds} rounds played`;
					});
				}
			}))
		});
		await settle();

		const written = game.querySelector(".rounds")!;
		expect(written.textContent).toBe("3 rounds played");
		// In the bar, in the popup its Menu button opens, under the volume.
		expect(written.closest(".sdk-bar")).not.toBeNull();
		expect(written.closest(".sdk-popup-panel, [role=dialog]")).not.toBeNull();

		state.rounds = 4;
		flushSync();
		expect(written.textContent).toBe("4 rounds played");
	});

	it("is sized anew when its scale changes, and refuses to leave out what a player needs", async () => {
		const props = bar({ scale: 1 });
		await settle();
		const before = game.querySelector(".sdk-bar")!.getBoundingClientRect().height;

		props.scale = 1.4;
		flushSync();
		await settle();
		expect(
			game.querySelector(".sdk-bar")!.getBoundingClientRect().height
		).toBeGreaterThan(before * 1.2);

		// The bet is not a studio's to hide.
		expect(() => {
			bar({ hide: ["bet"] });
			flushSync();
		}).toThrow(/cannot be hidden/);
	});

	it("does not read the balance while it is being set up, only once it is in the page", async () => {
		// The site hands the bar a balance its layout is still waiting for. Read before it
		// had come, it stopped the whole page being drawn: every game with autoplay.
		let arrived = false;
		const made = mount(ControlBar, {
			target: room(),
			props: {
				...config,
				onplay: () => {},
				get balance() {
					if (!arrived)
						throw new Error("The balance was read before it had come.");

					return 31_50;
				}
			}
		});
		mounted.push(made);

		arrived = true;
		flushSync();
		await settle();
		expect(readout("balance")).toContain("31.50");
	});

	it("takes itself out of the page with its component", async () => {
		bar();
		await settle();
		expect(game.querySelector(".sdk-bar")).not.toBeNull();

		void unmount(mounted.pop()!);
		flushSync();
		expect(game.querySelector(".sdk-bar")).toBeNull();
	});
});

describe("the controls as components", () => {
	it("a switch turns, says which way it is, and can be turned from outside", () => {
		const props = $state({ label: "Boost", checked: false, disabled: false });
		mounted.push(mount(Switch, { target: room(), props }));
		flushSync();
		const control = game.querySelector<HTMLButtonElement>('[role="switch"]')!;

		expect(control.getAttribute("aria-checked")).toBe("false");

		props.checked = true;
		flushSync();
		expect(control.getAttribute("aria-checked")).toBe("true");

		props.disabled = true;
		flushSync();
		expect(control.disabled).toBe(true);
	});

	it("a switch pressed tells the game", () => {
		const heard: boolean[] = [];
		const props = $state({
			label: "Boost",
			onchange: (checked: boolean) => heard.push(checked)
		});
		mounted.push(mount(Switch, { target: room(), props }));
		flushSync();

		game.querySelector<HTMLButtonElement>('[role="switch"]')!.click();
		expect(heard).toEqual([true]);
	});

	it("a menu shows the option its value names, and is not made again when that changes", () => {
		const props = $state({
			label: "Risk",
			options: [
				{ value: "low", label: "Low" },
				{ value: "high", label: "High" }
			],
			value: "low"
		});
		mounted.push(mount(Menu, { target: room(), props }));
		flushSync();
		const element = game.querySelector(".sdk-menu")!;

		expect(element.textContent).toContain("Low");

		props.value = "high";
		flushSync();
		expect(game.querySelector(".sdk-menu")).toBe(element);
		expect(element.querySelector("button")!.textContent).toContain("High");
	});

	it("a field keeps what is typed while a note under it changes", () => {
		const props = $state({ label: "Target", value: "2.00", note: "" });
		mounted.push(mount(Field, { target: room(), props }));
		flushSync();
		const input = game.querySelector<HTMLInputElement>("input")!;

		input.focus();
		input.value = "2.5";
		input.dispatchEvent(new Event("input", { bubbles: true }));
		props.note = "Pays 2.50x";
		flushSync();

		// The same field, still holding the keyboard and what was typed.
		expect(game.querySelector("input")).toBe(input);
		expect(document.activeElement).toBe(input);
		expect(input.value).toBe("2.5");
		expect(game.textContent).toContain("Pays 2.50x");
	});
});

describe("a look", () => {
	it("dresses the bar and its items through the bar's props, and follows them as they change", async () => {
		const props = bar({
			look: {
				surface: "rgb(15, 37, 48)",
				lineStrong: "#fff",
				segment: { radius: "12px" },
				segments: { play: { surface: "rgb(1, 2, 3)" } }
			}
		});
		await settle();

		const drawn = game.querySelector<HTMLElement>(".sdk-bar-frame")!;
		expect(drawn.style.getPropertyValue("--bar-surface")).toBe("rgb(15, 37, 48)");
		expect(drawn.style.getPropertyValue("--bar-line-strong")).toBe("#fff");
		expect(drawn.style.getPropertyValue("--bar-segment-radius")).toBe("12px");
		expect(getComputedStyle(game.querySelector(".sdk-bar")!).backgroundColor).toBe(
			"rgb(15, 37, 48)"
		);
		const play = game.querySelector<HTMLElement>('[data-segment="play"]')!;
		expect(play.style.getPropertyValue("--bar-segment-surface")).toBe("rgb(1, 2, 3)");
		// Where it is and how big are still the bar's own to set, on the same element.
		expect(drawn.style.getPropertyValue("--bar-s")).not.toBe("");

		props.look = { surface: "rgb(9, 9, 9)" };
		flushSync();
		expect(drawn.style.getPropertyValue("--bar-surface")).toBe("rgb(9, 9, 9)");
		expect(drawn.style.getPropertyValue("--bar-line-strong")).toBe("");
		expect(play.style.getPropertyValue("--bar-segment-surface")).toBe("");
		expect(drawn.style.getPropertyValue("--bar-s")).not.toBe("");
	});

	it("dresses a control through its own props", () => {
		mounted.push(
			mount(Switch, {
				target: room(),
				props: {
					label: "Sound",
					on: false,
					look: { accent: "#fc0", onAccent: "#210" }
				}
			})
		);
		flushSync();

		const control = game.querySelector<HTMLElement>(".sdk-switch")!;
		expect(control.style.getPropertyValue("--sdk-accent")).toBe("#fc0");
		expect(control.style.getPropertyValue("--sdk-on-accent")).toBe("#210");
	});

	it("keeps the last win in view: green while it is the last play's, greyed after", async () => {
		const props = bar({ win: 0 });
		await settle();

		const win = () => game.querySelector<HTMLElement>(".sdk-bar-win")!;
		expect(win().hasAttribute("data-fresh")).toBe(false);

		props.win = 6_50;
		flushSync();
		expect(readout("win")).toContain("6.50");
		expect(win().hasAttribute("data-fresh")).toBe(true);

		// The next play starts, and wins nothing: the amount stays, greyed.
		props.win = 0;
		flushSync();
		expect(readout("win")).toContain("6.50");
		expect(win().hasAttribute("data-fresh")).toBe(false);
		const greyed = getComputedStyle(win().querySelector("output")!).color;

		props.win = 2_00;
		flushSync();
		expect(readout("win")).toContain("2.00");
		expect(win().hasAttribute("data-fresh")).toBe(true);
		expect(getComputedStyle(win().querySelector("output")!).color).not.toBe(greyed);
	});

	it("never takes a typed bet: the bet is one of those on offer", async () => {
		bar();
		await settle();
		expect(game.querySelector(".sdk-bar-betvalue")!.tagName).toBe("DIV");
		expect(game.querySelector("input")).toBeNull();
		expect(readout("bet")).toContain("0.20");
	});

	it("offers autoplay ten to a hundred in a grid, which a choice closes", async () => {
		bar({
			autoplay: { noun: ["spin", "spins"], onstart: () => {}, onstop: () => {} }
		});
		await settle();

		button("Auto").click();
		flushSync();

		const choices = [...game.querySelectorAll<HTMLButtonElement>(".sdk-choice")];
		expect(choices.map((choice) => choice.textContent?.trim())).toEqual([
			"Off",
			...Array.from({ length: 10 }, (_, index) => String((index + 1) * 10))
		]);
		// Off over two lines of five.
		const tops = new Set(
			choices.map((choice) => Math.round(choice.getBoundingClientRect().top))
		);
		expect(tops.size).toBe(3);

		choices[3].click();
		flushSync();
		expect(
			game
				.querySelector('[data-segment="autoplay"] .sdk-popup-button')!
				.getAttribute("aria-expanded")
		).toBe("false");
		expect(button("Start autoplay, 30 spins")).not.toBeNull();
	});

	it("says how long play should take at each speed, a bonus left alone when fast", async () => {
		let made: Bar | undefined;
		bar({ onready: (handle: Bar) => (made = handle) });
		await settle();

		expect([made!.pace(), made!.pace(true)]).toEqual([1, 1]);

		button("Speed: normal").click();
		flushSync();
		expect([made!.pace(), made!.pace(true)]).toEqual([0.7, 1]);

		button("Speed: fast").click();
		flushSync();
		expect([made!.pace(), made!.pace(true)]).toEqual([0.5, 0.5]);
	});
});
