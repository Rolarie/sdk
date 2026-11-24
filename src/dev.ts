/// <reference types="bun" />
/**
 * `rolarie-studio dev <slug>`: a game played in a browser, run by the engine as a site runs it,
 * against the engine's stand-in for a site.
 *
 * Two processes. This one, the supervisor, keeps the client built (./client-build.ts) and runs
 * the server, starting it again whenever the maths or the guide changes, since a module once
 * imported cannot be imported afresh. The server serves:
 *
 *   /                          the page around the game (./dev/DevPage.svelte), in place of the site's
 *   /studio-frame/<slug>/...   the built client, with the site's own policy (./frame.ts)
 *   /api/...                   the stand-in for the site (./stand-in.ts), which plays the maths
 *   /events                    word to the page that the client was rebuilt, or the server started
 *
 * The client runs in a frame sandboxed as on the site, and talks to the page around it with
 * the same messages, checked the same way (./host.ts). A game that plays here plays there.
 */
import { existsSync, watch, type FSWatcher } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { checkGuide } from "./guide.ts";
import { clientHeaders, CLIENT_FILE_TYPES } from "./frame.ts";
import { watchClient } from "./client-build.ts";
import { localResolve } from "./local-packages.ts";
import { createStandIn } from "./stand-in.ts";
import { loadGame, loadGuide, type GameFolder } from "./studio-folder.ts";

interface Options {
	root: string;
	folder: GameFolder;
	port: number;
	balance: number;
}

/** Calls `then` once a burst of changes has stopped. */
function settleThen(then: () => void, ms = 150) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	return () => {
		clearTimeout(timer);
		timer = setTimeout(then, ms);
	};
}

/** Keeps the client built and the server running, and starts the server again when the maths changes. */
export async function supervise(options: Options & { cli: string }): Promise<number> {
	const { root, folder, port, balance, cli } = options;
	if (!existsSync(join(folder.client, "src", "routes"))) {
		console.error(`${folder.slug} has no client/src/routes to build.`);
		return 1;
	}

	const client = await watchClient(folder.client, {
		error: (error) =>
			console.error(
				`The client did not build: ${error instanceof Error ? error.message : String(error)}`
			)
	});

	let server: ReturnType<typeof Bun.spawn> | null = null;
	let stopping = false;
	const start = () => {
		server = Bun.spawn(
			[
				process.execPath,
				cli,
				"dev-serve",
				folder.slug,
				"--root",
				root,
				"--port",
				String(port),
				"--balance",
				(balance / 100).toFixed(2)
			],
			{ stdio: ["ignore", "inherit", "inherit"] }
		);
	};
	const restart = settleThen(async () => {
		if (stopping) return;
		console.log(
			"The maths or the guide changed: starting again. The pretend balance starts afresh."
		);
		server?.kill();
		await server?.exited;
		start();
	});

	const watchers: FSWatcher[] = [watch(folder.maths, { recursive: true }, restart)];
	if (existsSync(folder.guide)) watchers.push(watch(folder.guide, restart));
	start();

	const stop = async () => {
		stopping = true;
		for (const watcher of watchers) watcher.close();
		server?.kill();
		// Gone before this is, so that whatever started `dev` can have the port again at once.
		await Promise.all([server?.exited, client.close()]);
		process.exit(0);
	};
	process.on("SIGINT", stop);
	process.on("SIGTERM", stop);
	return -1;
}

/**
 * The page round the game (./dev/DevPage.svelte), built: its script and its styles. It is
 * a small Svelte page on the engine's `GameFrame`, so it is built as a game's client is,
 * with Vite, and kept in memory.
 */
async function hostPage(): Promise<{ script: string; style: string }> {
	const { build } = await import("vite");
	const { svelte } = await import("@sveltejs/vite-plugin-svelte");

	const built = await build({
		configFile: false,
		envDir: false,
		logLevel: "error",
		root: join(import.meta.dir, "dev"),
		...localResolve(),
		plugins: [svelte({ configFile: false, compilerOptions: { runes: true } })],
		build: {
			write: false,
			minify: false,
			cssCodeSplit: false,
			target: "esnext",
			rollupOptions: {
				input: join(import.meta.dir, "dev", "main.ts"),
				// One file: the page is small, and is kept in memory.
				output: { format: "es", codeSplitting: false }
			}
		}
	});

	const { output } = Array.isArray(built) ? built[0] : (built as { output: unknown[] });
	let script = "";
	let style = "";
	for (const file of output as {
		type: string;
		code?: string;
		source?: unknown;
		fileName: string;
	}[]) {
		if (file.type === "chunk") script += file.code ?? "";
		else if (file.fileName.endsWith(".css")) style += String(file.source ?? "");
	}
	if (!script) throw new Error("The page around the game did not build.");

	return { script, style };
}

const page = (name: string) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name.replace(/[<&]/g, "")}: rolarie-studio dev</title>
<link rel="stylesheet" href="/host.css">
</head>
<body>
<div id="host"></div>
<script type="module" src="/host.js"></script>
</body>
</html>
`;

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
	});

/** The server: the page, the client's files, and the stand-in for the site. */
export async function serve(options: Options): Promise<number> {
	const { folder, port } = options;
	const game = await loadGame(folder);
	let guideProblem: string | null = null;
	try {
		checkGuide(folder.slug, await loadGuide(folder));
	} catch (error) {
		guideProblem = error instanceof Error ? error.message : String(error);
	}
	const standIn = createStandIn(game, { balance: options.balance });
	const { script, style } = await hostPage();
	const boot = crypto.randomUUID();
	const dist = resolve(folder.client, "dist");

	// The pages listening for news: the client was rebuilt.
	const listeners = new Set<ReadableStreamDefaultController<string>>();
	const tell = (event: string, data = "") => {
		for (const listener of listeners) {
			try {
				listener.enqueue(`event: ${event}\ndata: ${data}\n\n`);
			} catch {
				listeners.delete(listener);
			}
		}
	};
	// Vite empties dist and writes it again, so the client's folder is watched, not dist.
	const rebuilt = settleThen(() => tell("reload"), 300);
	const watcher = watch(folder.client, { recursive: true }, (_event, name) => {
		if (name && normalize(String(name)).split(sep)[0] === "dist") rebuilt();
	});
	process.on("SIGTERM", () => {
		watcher.close();
		process.exit(0);
	});

	const state = async () => ({
		game: {
			slug: game.slug,
			name: game.name,
			category: game.category,
			shapes: game.shapes ?? ["wide"],
			...(game.minStake !== undefined ? { minStake: game.minStake } : {}),
			...(game.maxStake !== undefined ? { maxStake: game.maxStake } : {}),
			rtpBp: game.rtpBp,
			volatility: game.volatility
		},
		boot,
		balance: standIn.balance,
		limits: standIn.limits,
		fairness: standIn.fairness,
		guideProblem,
		// A round left open, for the game to pick back up.
		round: await standIn.round()
	});

	const server = Bun.serve({
		port,
		idleTimeout: 0,
		async fetch(request) {
			const url = new URL(request.url);
			const path = url.pathname;

			if (path === "/")
				return new Response(page(game.name), {
					headers: { "Content-Type": "text/html; charset=utf-8" }
				});
			if (path === "/host.js")
				return new Response(script, {
					headers: { "Content-Type": "text/javascript; charset=utf-8" }
				});
			if (path === "/host.css")
				return new Response(style, {
					headers: { "Content-Type": "text/css; charset=utf-8" }
				});

			if (path === "/events") {
				let mine: ReadableStreamDefaultController<string>;
				const stream = new ReadableStream<string>({
					start(controller) {
						mine = controller;
						listeners.add(controller);
						controller.enqueue(`event: boot\ndata: ${boot}\n\n`);
					},
					cancel() {
						listeners.delete(mine);
					}
				});
				return new Response(stream, {
					headers: {
						"Content-Type": "text/event-stream",
						"Cache-Control": "no-store"
					}
				});
			}

			const prefix = `/studio-frame/${folder.slug}/`;
			if (path.startsWith(prefix)) {
				const file = resolve(
					join(
						dist,
						normalize(
							decodeURIComponent(path.slice(prefix.length)) || "index.html"
						)
					)
				);
				const type = CLIENT_FILE_TYPES[extname(file).toLowerCase()];
				if (
					!file.startsWith(dist + sep) ||
					!type ||
					!(await Bun.file(file).exists())
				)
					return new Response("Not found", { status: 404 });
				return new Response(Bun.file(file), {
					headers: clientHeaders(
						url.origin,
						folder.slug,
						type,
						decodeURIComponent(path.slice(prefix.length))
					)
				});
			}

			if (path === "/api/state") return json(await state());

			// What the engine's bridge asks of whoever keeps the bets: here, the stand-in.
			if (request.method === "POST" && path === "/api/open") {
				const { bet, params } = (await request.json()) as {
					bet: number;
					params: unknown;
				};

				return json({
					reply: await standIn.open(bet, params),
					state: await state()
				});
			}

			if (request.method === "POST" && path === "/api/act") {
				const { action } = (await request.json()) as { action: unknown };

				return json({ reply: await standIn.act(action), state: await state() });
			}

			if (request.method === "POST" && path === "/api/progress") {
				const { bet } = (await request.json()) as { bet: number };

				return json({ progress: await standIn.progress(bet) });
			}

			if (path === "/api/history") return json({ bets: standIn.history() });

			if (request.method === "POST" && path === "/api/balance") {
				const { balance } = (await request.json()) as { balance: number };
				try {
					standIn.setBalance(balance);
				} catch (error) {
					return json(
						{ error: error instanceof Error ? error.message : String(error) },
						400
					);
				}
				return json({ state: await state() });
			}

			if (request.method === "POST" && path === "/api/seeds") {
				const revealed = standIn.rotateSeeds();
				if (revealed === null)
					return json(
						{ error: "Finish the round first: its seeds are still in use." },
						409
					);
				return json({ revealed, state: await state() });
			}

			return new Response("Not found", { status: 404 });
		}
	});

	console.log(`${game.name}: http://localhost:${server.port}/`);
	if (guideProblem)
		console.warn(`  Its guide is not one the site can show: ${guideProblem}`);
	return -1;
}
