/**
 * How every studio game's client is built: one way, owned by the SDK, so that `check`,
 * `dev` and a release all build a client the same way. A studio builds its own client,
 * where its code is, and sends what was built with its release; the site serves those
 * files and never builds or runs a studio's code.
 *
 * The client is a SvelteKit app, built with adapter-static: its page is rendered when it
 * is built, so what the page shows first (its loading screen) is in `index.html` itself,
 * on the screen before any of the game's code has arrived. It is built from
 * `client/src/routes`, with `client/public` copied as it is, into `client/dist`: plain
 * files with relative addresses, so the site can serve them from whatever path it likes.
 * There is no configuration of a studio's own: the page's frame is the SDK's
 * (./client-app.html), and so is every setting here. That frame says the page is dark, as
 * the site is: a browser gives a framed page that differs from the page round it a white
 * ground of its own until it has drawn something, which showed as a white flash before a
 * game's loading screen.
 *
 * SvelteKit's version is exact (package.json), because what it builds is finished here
 * (`finishClient`), and that depends on the shape of what it builds:
 *
 * - SvelteKit starts a page with a script written into it, and the policy a client is
 *   served under (./frame.ts) allows no inline script. That script is moved into a file.
 * - SvelteKit asks its server whether a newer build has replaced the one running, and a
 *   client can make no request. It is answered in the page, so nothing is refused.
 * - The code a game needs is asked for from the start and all at once, and a page with a
 *   loading screen is told each file's size, so that the screen's bar fills as the code
 *   arrives (./loading-first.js).
 *
 * Raise SvelteKit's version on purpose, and run this file's tests when it is raised.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	watch,
	writeFileSync,
	type FSWatcher
} from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import type { InlineConfig, Plugin } from "vite";
import { localResolve } from "./local-packages.ts";
import { PROTOCOL } from "./protocol.ts";

/** A file of the SDK's own, beside this one. */
function ownFile(name: string): string {
	return fileURLToPath(new URL(name, import.meta.url));
}

/** Where SvelteKit keeps what it works out as it builds, inside a client's folder. */
const WORK_FOLDER = ".svelte-kit";

/** Where the build leaves what `finishClient` needs to know of the code it made. */
const CODE_FILE = join(WORK_FOLDER, "rolarie-code.json");

/** The folder of files SvelteKit names by what is in them, in a built client. */
const NAMED = "_app/immutable";

/**
 * The code Pixi asks for only once a stage is being made (./pixi/Stage.svelte, which draws
 * with WebGL): what makes it safe for the frame, the browser's own parts, and the renderer.
 * Each is asked for after the one before has arrived and run, so a game would wait for
 * them one at a time, after all the rest of its code.
 */
const STAGE_MODULES =
	/\/pixi\.js\/lib\/(unsafe-eval\/init|environment-browser\/browserAll|rendering\/renderers\/gl\/WebGLRenderer)\.m?js$/;

/** What every client's build is named. The same every time: see `version` in `clientConfig`. */
const BUILD_NAME = "client";

/**
 * Put before the script a page starts itself with. Whenever a page comes back into view,
 * SvelteKit asks its server whether a newer build has replaced the one running
 * (`_app/version.json`). A client can make no request at all (the frame's policy), so the
 * browser would refuse it and say so in the console each time. It is answered here
 * instead, with no request made: this build is the one it is.
 */
const NOT_REPLACED = `
				{
					const ask = window.fetch;
					window.fetch = (what, how) => {
						const address = typeof what === "string" ? what : what instanceof URL ? what.href : what.url;

						return /\\/_app\\/version\\.json(\\?|$)/.test(address)
							? Promise.resolve(
									new Response(JSON.stringify({ version: "${BUILD_NAME}" }), {
										headers: { "content-type": "application/json" }
									})
								)
							: ask(what, how);
					};
				}
`;

/** One file of a built client's code, as far as finishing the client needs to know it. */
interface CodeFile {
	/** Its place in the built client: `_app/immutable/chunks/BeiYQHnb.js`. */
	file: string;
	bytes: number;
	/** The files it cannot run without. */
	imports: string[];
	/** The files it asks for as it runs. */
	later: string[];
	/** Whether any of it is the studio's own writing (or SvelteKit's, made for this game). */
	own: boolean;
	/** Whether it is code a stage asks for (`STAGE_MODULES`). */
	stage: boolean;
}

/** Notes the code the browser's side of the build made, for `finishClient`. */
function noteCode(client: string): Plugin {
	return {
		name: "rolarie-note-code",
		apply: "build",

		generateBundle(_options, bundle) {
			// SvelteKit builds twice: once for the page as it is rendered here, once for the browser.
			if (this.environment.name !== "client") return;

			const files: CodeFile[] = Object.values(bundle)
				.filter((file) => file.type === "chunk")
				.map((chunk) => ({
					file: chunk.fileName,
					bytes: Buffer.byteLength(chunk.code),
					imports: chunk.imports,
					later: chunk.dynamicImports,
					own: chunk.moduleIds.some((id) => !id.includes("/node_modules/")),
					stage:
						STAGE_MODULES.test(chunk.facadeModuleId ?? "") ||
						chunk.moduleIds.some((id) => STAGE_MODULES.test(id))
				}));

			mkdirSync(join(client, WORK_FOLDER), { recursive: true });
			writeFileSync(join(client, CODE_FILE), JSON.stringify(files));
		}
	};
}

/** Where the SDK is, as it is found on disk. */
const SDK_FOLDER = realpathSync(dirname(fileURLToPath(import.meta.url)));

/**
 * The folder two folders are both in: the nearest one. A client and the SDK it is built
 * with are both under the studio's repository, wherever that is on a machine, so a file
 * named from here is named the same on every machine.
 */
export function sharedFolder(one: string, other: string): string {
	const first = realpathSync(one).split(sep);
	const second = realpathSync(other).split(sep);
	let same = 0;

	while (same < first.length && same < second.length && first[same] === second[same])
		same += 1;

	return first.slice(0, same).join(sep) || sep;
}

/** Every setting of a client's build. `folder` is the client's own. */
export function clientConfig(folder: string): InlineConfig {
	const client = resolve(folder);

	return {
		// Built as it will be served, whatever this was run from (a test, a development server).
		mode: "production",
		configFile: false,
		envDir: false,
		root: client,
		logLevel: "warn",
		clearScreen: false,
		...localResolve(),
		plugins: [
			sveltekit({
				compilerOptions: {
					runes: true,
					// A component's styles are kept to it by a name made from what they say, not
					// from where its file is: Svelte's own is made from the file's whole path, for
					// a file outside the client's folder (the SDK's), so the same source built
					// another client on another machine, and no record of it held anywhere else.
					cssHash: ({ hash, css }) => `svelte-${hash(css)}`,
					// The same for a component's name, which Svelte writes into what it builds
					// (a page's `<svelte:head>` is marked with it): told where the client and the
					// SDK both are, it names each file from there, and not from the machine's root.
					rootDir: sharedFolder(client, SDK_FOLDER)
				},
				adapter: adapter({ pages: "dist", assets: "dist", strict: true }),
				outDir: WORK_FOLDER,
				// A game's own files where they have always been, and the page's frame the SDK's.
				files: { assets: "public", appTemplate: ownFile("./client-app.html") },
				// Served from whatever folder the site likes.
				paths: { relative: true },
				// The same every time: SvelteKit would name each build by the moment it was made,
				// for a page to find it has been replaced, and a client's files are held to the
				// record of them (./client-record.ts), so the same source must build the same files.
				version: { name: BUILD_NAME }
			}),
			noteCode(client)
		]
	};
}

/** The code a game needs before it can be played, each file once, the page's own first. */
function codeToLoad(files: CodeFile[], first: string[]): CodeFile[] {
	const byName = new Map(files.map((file) => [file.file, file]));
	const found = new Map<string, CodeFile>();

	const follow = (name: string) => {
		const file = byName.get(name);
		if (!file || found.has(name)) return;

		found.set(name, file);
		file.imports.forEach(follow);
		// What the studio's own code asks for as it runs is the game itself, kept out of the
		// page that is rendered when it is built. What a library asks for later may never be
		// wanted (a renderer for another kind of screen), and is left to it.
		if (file.own) file.later.forEach(follow);
	};

	first.forEach(follow);
	for (const file of files) if (file.stage) follow(file.file);

	return [...found.values()];
}

/** The first eight letters of a digest of some text: a name by what is in it. */
function named(text: string): string {
	return createHash("sha256").update(text).digest("base64url").slice(0, 8);
}

/**
 * Finishes a client SvelteKit has built into `client/dist`, for the frame it is played
 * in. Throws if the page is not as this version of SvelteKit builds one: that is a
 * change in SvelteKit to be met here, never guessed at.
 */
export function finishClient(folder: string): void {
	const client = resolve(folder);
	const dist = join(client, "dist");
	const page = join(dist, "index.html");
	if (!existsSync(page)) {
		throw new Error(
			`${folder} built no index.html: its page must be rendered when it is built (src/routes/+layout.ts: export const prerender = true).`
		);
	}

	let html = readFileSync(page, "utf8");
	const files: CodeFile[] = JSON.parse(readFileSync(join(client, CODE_FILE), "utf8"));

	// The script the page starts itself with, moved into a file: the policy allows none inline.
	const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
	const [start] = inline;
	if (inline.length !== 1 || !start[1].includes("kit.start(")) {
		throw new Error(
			`${folder}'s page is not as SvelteKit builds one: it should start itself with one script written into it. Was SvelteKit's version changed?`
		);
	}

	// Beside the code it asks for, which it finds from its own address. And before it starts,
	// SvelteKit's one request of its own is answered in the page (`NOT_REPLACED`).
	const script = NOT_REPLACED + start[1].replaceAll(`"./${NAMED}/`, `"./`);
	if (/["']\.\/_app\//.test(script)) {
		throw new Error(
			`${folder}'s page starts itself with an address this does not know how to move.`
		);
	}

	const startFile = `${NAMED}/start.${named(script)}.js`;
	writeFileSync(join(dist, startFile), script);
	// Asked for as another origin's: a sandboxed page's own files are that to it, and a
	// script not asked for so may not ask for more code by address.
	html = html.replace(start[0], `<script crossorigin src="./${startFile}"></script>`);

	// The code the page already asks for, and the rest of what the game needs.
	const asked = [
		...html.matchAll(/<link href="\.\/([^"]+\.js)" rel="modulepreload">/g)
	].map((match) => match[1]);
	const code = codeToLoad(files, asked);
	const more = code
		.filter((file) => !asked.includes(file.file))
		.map((file) => `<link href="./${file.file}" rel="modulepreload">`);

	const head: string[] = [...more];

	// A page with a loading screen (./LoadingScreen.svelte): told the code to wait for, and
	// given the script that fills its bar as that code arrives. First in the page, so it is
	// asked for before the code it watches.
	const waiting = /<div class="sdk-loading[^"]*"[^>]*\bdata-waiting\b/.exec(html);
	if (waiting) {
		const filler = readFileSync(ownFile("./loading-first.js"), "utf8").replaceAll(
			"__PROTOCOL__",
			PROTOCOL
		);
		const fillerFile = `${NAMED}/loading-first.${named(filler)}.js`;
		writeFileSync(join(dist, fillerFile), filler);

		const sizes = code.map((file) => `${file.file}:${file.bytes}`).join(",");
		html = html.replace(waiting[0], `${waiting[0]} data-code="${sizes}"`);
		html = html.replace(
			"<head>",
			`<head>\n\t\t<script defer crossorigin src="./${fillerFile}"></script>`
		);
	}

	html = html.replace(
		"</head>",
		`${head.map((tag) => `\t${tag}\n\t`).join("")}</head>`
	);
	writeFileSync(page, html);
}

/**
 * Builds a game's client into `client/dist`, and finishes it. SvelteKit builds the folder
 * it is run in, so it is run there, by itself (./client-build-run.ts).
 */
export async function buildClient(folder: string): Promise<void> {
	const client = resolve(folder);
	if (!existsSync(join(client, "src", "routes"))) {
		throw new Error(
			`${folder} has no src/routes: a client is a SvelteKit app, its page in src/routes/+page.svelte.`
		);
	}

	const said: Buffer[] = [];
	const status = await new Promise<number | null>((done, failed) => {
		const run = spawn(process.execPath, [ownFile("./client-build-run.ts")], {
			cwd: client,
			env: { ...process.env, NODE_ENV: "production" },
			stdio: ["ignore", "pipe", "pipe"]
		});

		run.stdout.on("data", (chunk: Buffer) => said.push(chunk));
		run.stderr.on("data", (chunk: Buffer) => said.push(chunk));
		run.once("error", failed);
		run.once("close", done);
	});

	if (status !== 0) {
		throw new Error(
			`${folder} did not build:\n${Buffer.concat(said).toString("utf8").trim()}`
		);
	}
}

/**
 * Builds a game's client into `client/dist` and again whenever its source changes, until
 * `close()`. `built` is called after each build, and `error` with what went wrong in one.
 */
export async function watchClient(
	folder: string,
	on: { built?: () => void; error?: (error: unknown) => void } = {}
): Promise<{ close: () => Promise<void> }> {
	const client = resolve(folder);
	let building: Promise<void> | null = null;
	let again = false;
	let timer: ReturnType<typeof setTimeout> | undefined;

	/** One build at a time; a change during one is built after it. */
	const run = async (): Promise<void> => {
		if (building) {
			again = true;

			return building;
		}

		building = buildClient(client)
			.then(() => on.built?.())
			.catch((error: unknown) => on.error?.(error))
			.finally(() => {
				building = null;
				if (again) {
					again = false;
					void run();
				}
			});

		return building;
	};

	await run();

	const watchers: FSWatcher[] = ["src", "public"]
		.map((name) => join(client, name))
		.filter((watched) => existsSync(watched))
		.map((watched) =>
			watch(watched, { recursive: true }, () => {
				// Once a burst of changes has stopped.
				clearTimeout(timer);
				timer = setTimeout(() => void run(), 150);
			})
		);

	return {
		close: async () => {
			clearTimeout(timer);
			for (const watcher of watchers) watcher.close();
			await building;
		}
	};
}
