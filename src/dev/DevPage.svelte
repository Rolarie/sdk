<!--
The page round a game in `rolarie-studio dev`: a thin wrapper round the engine, which is
what runs the game here exactly as it does on a site (its `GameFrame`: the sandboxed frame,
the checks on every message, the choice of view, a result held back until it is shown).
Bets are played by the engine's stand-in on the dev server, the same bet pipeline a site
plays them by.

What is this page's own is what helps while a game is made: the room the game is given
(wide, or a phone's), the pretend balance and a way to set it, the seeds and a way to give
them up, what the game announced for a screen reader, and a log of every message,
including those a host ignores and why.

Author: dwclake
Created: 2026-11-19
-->
<script lang="ts">
	import GameFrame from "#engine/GameFrame.svelte";
	import { addFrames, type FrameSummary } from "#engine/frame-rate";
	import type { GameSite, SiteReply } from "#engine/bridge.svelte";
	import type { HistoryBet, RoundMessage } from "#engine/protocol";
	import type { Shape } from "#engine/shapes";
	import { formatCoins, parseCoins } from "../coins.ts";

	/** What the dev server says of the game and of how things stand. */
	interface State {
		game: {
			slug: string;
			name: string;
			category: string;
			shapes: Shape[];
			minStake?: number;
			maxStake?: number;
			rtpBp: number;
			volatility: number;
		};
		boot: string;
		balance: number;
		limits: { minStake: number; maxStake: number };
		fairness: { serverSeedHash: string; clientSeed: string; nonce: number };
		guideProblem: string | null;
		/** A round left open, for the game to pick back up. */
		round: RoundMessage | null;
	}

	let { start }: { start: State } = $props();

	/** Kept from one visit to the next, where the browser allows. */
	const remember = {
		get(key: string): string | null {
			try {
				return localStorage.getItem(`rolarie-dev:${key}`);
			} catch {
				return null;
			}
		},
		set(key: string, value: string) {
			try {
				localStorage.setItem(`rolarie-dev:${key}`, value);
			} catch {
				// Not kept: the page works the same without.
			}
		}
	};

	// svelte-ignore state_referenced_locally
	let stands = $state.raw(start);
	/** The balance shown: what the stand-in holds, held back while a result is being shown. */
	// svelte-ignore state_referenced_locally
	let shown = $state(start.balance);
	let held = $state(false);
	let reducedMotion = $state(remember.get("reduced-motion") === "true");
	/** The room the game is given: a wide one, or a phone's. The engine chooses the view from it. */
	let room = $state<"wide" | "phone">(
		remember.get("shape") === "phone" ? "phone" : "wide"
	);
	/** The game is made again when this changes: a reload. */
	let loaded = $state(0);
	let drawn = $state<{ view: Shape; width: number; height: number } | null>(null);
	/** How smoothly the game is drawn, as it reports it: counted since it was last loaded. */
	let frames = $state.raw<FrameSummary | null>(null);
	let problem = $state<string | null>(null);
	let newBalance = $state("");
	let balanceProblem = $state("");

	interface Entry {
		id: number;
		kind: "in" | "out" | "info" | "warn";
		time: string;
		who: string;
		text: string;
	}
	let entries = $state.raw<Entry[]>([]);
	let made = 0;

	/** Adds a line to the log, and keeps the latest few hundred. */
	function log(kind: Entry["kind"], who: string, text: string) {
		const time = new Date().toLocaleTimeString("en", { hour12: false });
		entries = [...entries, { id: ++made, kind, time, who, text }].slice(-300);
	}

	/** Asks the dev server, which holds the stand-in. */
	async function api<Answer>(path: string, body?: unknown): Promise<Answer> {
		const response = await fetch(path, {
			method: body === undefined ? "GET" : "POST",
			headers: body === undefined ? {} : { "Content-Type": "application/json" },
			body: body === undefined ? undefined : JSON.stringify(body)
		});
		const answer = await response.json();
		if (!response.ok) throw new Error(answer.error ?? "The dev server refused that.");

		return answer as Answer;
	}

	/** A round opened or moved in: the stand-in's answer, and how things stand after it. */
	async function round(path: string, body: unknown): Promise<SiteReply> {
		const answer = await api<{ reply: SiteReply; state: State }>(path, body);
		stands = answer.state;
		// The stake is seen to leave at once; a result is held until the game has shown it.
		if (answer.reply.ok && !answer.reply.round.open) held = true;
		else shown = stands.balance;

		return answer.reply;
	}

	/** The stand-in on the dev server, as the engine's bridge reaches it. */
	const site: GameSite = {
		open: (bet, params) => round("/api/open", { bet, params }),
		act: (action) => round("/api/act", { action }),
		progress: async (bet) =>
			(await api<{ progress: unknown }>("/api/progress", { bet })).progress,
		history: async () => (await api<{ bets: HistoryBet[] }>("/api/history")).bets,
		staked: () => (shown = stands.balance),
		revealed() {
			held = false;
			shown = stands.balance;
		}
	};

	/** Shows the game again from the start, as a page loaded again would. */
	async function reload() {
		stands = await api<State>("/api/stands");
		held = false;
		shown = stands.balance;
		loaded += 1;
		frames = null;
	}

	async function setBalance(event: SubmitEvent) {
		event.preventDefault();

		const cents = parseCoins(newBalance);
		if (cents === null) {
			balanceProblem = "An amount, like 25.00.";

			return;
		}

		try {
			stands = (await api<{ state: State }>("/api/balance", { balance: cents }))
				.state;
			shown = stands.balance;
			held = false;
			newBalance = "";
			balanceProblem = "";
		} catch (error) {
			balanceProblem = error instanceof Error ? error.message : String(error);
		}
	}

	async function rotateSeeds() {
		try {
			const answer = await api<{ revealed: string; state: State }>(
				"/api/seeds",
				{}
			);
			stands = answer.state;
			log("info", "seeds", `New seeds. The old server seed was ${answer.revealed}`);
		} catch (error) {
			log("warn", "seeds", error instanceof Error ? error.message : String(error));
		}
	}

	/** Follows the dev server: the game's client built again, or the server started again. */
	function follow() {
		const events = new EventSource("/events");

		events.addEventListener("boot", async (event) => {
			if ((event as MessageEvent).data === stands.boot) return;

			log("info", "dev", "The maths changed: the game is loaded again.");
			await reload();
		});
		events.addEventListener("reload", async () => {
			log("info", "dev", "The client was built again: the game is loaded again.");
			await reload();
		});

		return () => events.close();
	}
</script>

<svelte:head><title>{stands.game.name}: rolarie-studio dev</title></svelte:head>

<div class="page" {@attach follow}>
	<header>
		<h1>{stands.game.name}</h1>
		<p class="about">
			{stands.game.category}, returns {(stands.game.rtpBp / 100).toFixed(2)}%,
			volatility
			{stands.game.volatility.toFixed(2)}
		</p>
	</header>

	<div class="controls">
		<div class="segmented" role="group" aria-label="Shape">
			{#each [["wide", "16 by 10"], ["phone", "Phone, 9 by 16"]] as const as [value, label] (value)}
				<button
					type="button"
					aria-pressed={room === value}
					onclick={() => {
						room = value;
						remember.set("shape", value);
					}}
				>
					{label}
				</button>
			{/each}
		</div>
		<label class="check">
			<input
				type="checkbox"
				bind:checked={reducedMotion}
				onchange={() => {
					remember.set("reduced-motion", String(reducedMotion));
					loaded += 1;
					frames = null;
				}}
			/>
			Less motion
		</label>
		<button type="button" class="quiet" onclick={reload}>Reload the game</button>
		<span class="size">
			{#if drawn}
				{drawn.view} view, {Math.round(drawn.width)} by {Math.round(drawn.height)}
			{/if}
		</span>
		<span class="size frames">
			{#if frames}
				{frames.now.toFixed(0)} frames a second, {frames.lowest.toFixed(0)} at the fewest,
				the longest wait {frames.longest} ms
			{/if}
		</span>
	</div>

	<div class="stage" data-room={room}>
		{#key `${loaded} ${reducedMotion}`}
			<GameFrame
				game={stands.game}
				src="/studio-frame/{stands.game.slug}/index.html?t={loaded}"
				{site}
				initial={stands.round}
				balance={stands.balance}
				sound={!navigator.userAgent.includes("Firefox")}
				{reducedMotion}
				heard={(kind, message, why) =>
					kind === "ignored"
						? log(
								"warn",
								"game",
								`${JSON.stringify(message)}: ignored, as the site would (${why})`
							)
						: log(
								kind,
								kind === "in" ? "game" : "site",
								JSON.stringify(message)
							)}
				onroom={(now) => (drawn = now)}
				onframes={(report) => (frames = addFrames(frames, report))}
				bind:problem
			/>
		{/key}
	</div>

	<aside>
		<section>
			<h2>Balance</h2>
			<strong class="figure">{formatCoins(shown)}</strong>
			<span class="note">
				{#if held}{formatCoins(stands.balance)} once the game says the result was shown{/if}
			</span>
			<form class="row" onsubmit={setBalance}>
				<input
					type="text"
					inputmode="decimal"
					aria-label="New balance"
					placeholder="25.00"
					bind:value={newBalance}
				/>
				<button type="submit" class="quiet">Set</button>
			</form>
			{#if balanceProblem}<p class="warn">{balanceProblem}</p>{/if}
		</section>

		<section>
			<h2>Fairness</h2>
			<dl class="seeds">
				<dt>Server seed (hashed)</dt>
				<dd>{stands.fairness.serverSeedHash}</dd>
				<dt>Client seed</dt>
				<dd>{stands.fairness.clientSeed}</dd>
				<dt>Bets on these seeds</dt>
				<dd>{stands.fairness.nonce}</dd>
				<dt>Bets taken</dt>
				<dd>
					{formatCoins(stands.limits.minStake)} to {formatCoins(
						stands.limits.maxStake
					)}
				</dd>
			</dl>
			<button type="button" class="quiet" onclick={rotateSeeds}>
				Reveal the seed and get new ones
			</button>
		</section>

		{#if problem}<p class="warn" role="alert">{problem}</p>{/if}
		{#if stands.guideProblem}
			<p class="warn">
				Its guide is not one the site can show: {stands.guideProblem}
			</p>
		{/if}
	</aside>

	<section class="messages">
		<div class="row">
			<h2>Messages</h2>
			<button type="button" class="quiet" onclick={() => (entries = [])}>
				Clear
			</button>
		</div>
		<ol class="log">
			{#each entries as entry (entry.id)}
				<li class={entry.kind}>
					<span class="time">{entry.time}</span>
					<span class="who">{entry.who}</span>
					<span class="text">{entry.text}</span>
				</li>
			{/each}
		</ol>
	</section>
</div>

<style>
	:global(body) {
		margin: 0;
		background: #17111a;
		color: #f2f2f2;
		font:
			15px/1.5 system-ui,
			sans-serif;
		color-scheme: dark;
	}

	.page {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 22rem;
		grid-template-areas:
			"head head"
			"controls controls"
			"stage side"
			"messages messages";
		gap: 1rem 1.5rem;
		max-width: 96rem;
		margin: 0 auto;
		padding: 1rem 1.5rem 2rem;
	}

	header {
		grid-area: head;
		display: flex;
		align-items: baseline;
		gap: 1rem;
	}

	h1 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 500;
	}

	h2 {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #b4b6ba;
	}

	.about,
	.note,
	.size {
		margin: 0;
		color: #b4b6ba;
		font-size: 0.875rem;
	}

	.controls {
		grid-area: controls;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1rem;
	}

	/* The room the game is given. The engine chooses the view from it, and sizes the game. */
	.stage {
		grid-area: stage;
		--game-frame-ground: #0d090f;
	}

	.stage[data-room="phone"] {
		width: 24.375rem;
		margin-inline: auto;
		--game-room-height: 46rem;
	}

	aside {
		grid-area: side;
		display: grid;
		align-content: start;
		gap: 1.5rem;
	}

	section {
		display: grid;
		gap: 0.5rem;
	}

	.figure {
		font-size: 1.75rem;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	input[type="text"] {
		width: 8rem;
		padding: 0.375rem 0;
		border: 0;
		border-bottom: 1px solid #5a4a50;
		background: none;
		color: inherit;
		font: inherit;
	}

	button {
		font: inherit;
		color: inherit;
		background: none;
		border: 0;
		cursor: pointer;
	}

	.quiet {
		padding: 0;
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	.segmented {
		display: flex;
		border-bottom: 1px solid #3a2f33;
	}

	.segmented button {
		padding: 0.375rem 0.75rem;
		color: #b4b6ba;
	}

	.segmented button[aria-pressed="true"] {
		color: #f2f2f2;
		box-shadow: inset 0 -2px 0 #e86a8c;
	}

	.check {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.seeds {
		display: grid;
		gap: 0.125rem;
		margin: 0;
	}

	dt {
		color: #b4b6ba;
		font-size: 0.8125rem;
	}

	dd {
		margin: 0 0 0.5rem;
		overflow-wrap: anywhere;
		font-family: ui-monospace, monospace;
		font-size: 0.8125rem;
	}

	.warn {
		margin: 0;
		color: #f0a3a3;
	}

	.messages {
		grid-area: messages;
	}

	.log {
		max-height: 18rem;
		margin: 0;
		padding: 0;
		overflow: auto;
		list-style: none;
		border-top: 1px solid #3a2f33;
		font-family: ui-monospace, monospace;
		font-size: 0.8125rem;
	}

	.log li {
		display: grid;
		grid-template-columns: 5rem 3.5rem minmax(0, 1fr);
		gap: 0.75rem;
		padding: 0.25rem 0;
		border-bottom: 1px solid #2a2126;
	}

	.log .time,
	.log .who {
		color: #b4b6ba;
	}

	.log .text {
		overflow-wrap: anywhere;
	}

	.log .warn .text {
		color: #f0a3a3;
	}

	.log .info .text {
		color: #9fd3a8;
	}

	@media (max-width: 60rem) {
		.page {
			grid-template-columns: minmax(0, 1fr);
			grid-template-areas: "head" "controls" "stage" "side" "messages";
		}
	}
</style>
