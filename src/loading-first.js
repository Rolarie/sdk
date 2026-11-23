/*
 * The first of a game's loading: fills the loading screen in a client's page
 * (./LoadingScreen.svelte, rendered when the client is built) while the game's code is
 * still arriving, by how many bytes of it have. The page names each file of that code and
 * its size (`data-code`, written by ./client-build.ts); the browser says when each has
 * arrived. Once the game's own code runs it takes the screen over (./loading.ts, which
 * removes `data-waiting`) and fills what is left of the bar from what the game tracks, and
 * this has nothing left to fill.
 *
 * If none of the code arrives for twenty seconds it has the screen say so and offer to try
 * again: a game whose code never comes has nothing else that could.
 *
 * It also tells the site the page has something to show (`drawn`, ./protocol.ts): a
 * browser gives a frame a white ground until its page has drawn, so the site keeps the
 * frame out of sight until then. `__PROTOCOL__` is written in by the build.
 *
 * A file of its own, plain and unbundled: the policy a client is served under allows no
 * inline script, and this must run before any of the game's code has arrived.
 *
 * Author: dwclake
 * Created: 2026-11-18
 */
(() => {
	/** How much of the bar the code's arrival fills. The rest is the game's own to track. */
	const CODE_SHARE = 0.85;

	const screen = document.querySelector(".sdk-loading[data-waiting]");
	if (!screen) return;

	// The page is here, with its styles and its loading screen: the site, which has kept the
	// frame out of sight until there was something in it to see, is told so. Said again
	// until the game's own code takes over, in case the site was not yet listening.
	const drawn = () => {
		if (!screen.hasAttribute("data-waiting")) return;

		window.parent.postMessage({ protocol: "__PROTOCOL__", type: "drawn" }, "*");
		setTimeout(drawn, 250);
	};
	drawn();

	/** How long nothing may arrive before the screen offers to try again, in milliseconds (./loading.ts has the same). */
	const STALLED_MS = 20_000;

	// The way to try again loads the page anew, whoever shows it: this, or the game's own
	// code once it runs (./loading.ts).
	screen
		.querySelector(".sdk-loading-again")
		?.addEventListener("click", () => location.reload());

	let stalling;

	/**
	 * Starts the wait again: some of the game's code has arrived. If none of it does for
	 * long enough, and the game's own code has still not run (it may never have come, and
	 * then nothing but this could say so), the screen offers to try again.
	 */
	const stillComing = () => {
		clearTimeout(stalling);
		stalling = setTimeout(() => {
			if (!screen.hasAttribute("data-waiting")) return;

			screen.dataset.problem = "stalled";
			const words = screen.querySelector(".sdk-loading-problem");
			if (words) words.textContent = "This is taking longer than usual.";
		}, STALLED_MS);
	};
	stillComing();

	// Each file of the game's code by its whole address, as the browser reports it, and its size.
	const sizes = new Map();
	for (const entry of (screen.dataset.code ?? "").split(",")) {
		const [file, size] = entry.split(":");
		if (file && Number(size) > 0)
			sizes.set(new URL(file, location.href).href, Number(size));
	}

	let wanted = 0;
	for (const size of sizes.values()) wanted += size;
	if (wanted === 0) return;

	const arrived = new Set();

	/** Draws the bar as full as the code that has arrived makes it. */
	function fill() {
		// The game's code is running, and the screen is its own now.
		if (!screen.hasAttribute("data-waiting")) return;

		let bytes = 0;
		for (const file of arrived) bytes += sizes.get(file);

		const share = (bytes / wanted) * CODE_SHARE;
		screen.dataset.shown = String(share);
		screen
			.querySelector(".sdk-loading-bar")
			?.setAttribute("aria-valuenow", String(Math.round(share * 100)));
		screen
			.querySelector(".sdk-loading-fill")
			?.style.setProperty("transform", `scaleX(${share})`);
	}

	// Every file the page asks for, as each one finishes, including any already done.
	new PerformanceObserver((list) => {
		for (const entry of list.getEntries()) {
			if (sizes.has(entry.name)) arrived.add(entry.name);
		}

		stillComing();
		fill();
	}).observe({ type: "resource", buffered: true });
})();
