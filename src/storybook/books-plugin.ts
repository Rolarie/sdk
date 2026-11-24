/**
 * Rounds from a game's real books, for stories. Storybook runs in a browser, and a book
 * is files; while Storybook is running, this answers a story's request for a round by
 * playing one from the studio's books as the site would (../book-game.ts), and for the
 * list of the studio's games that have books.
 *
 * It is part of the SDK's Storybook, on the studio's machine: the site has no such door.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { loadBookGame, readGameManifest } from "../book-files.ts";
import type { BookGame, BookState } from "../book-game.ts";
import { createRng } from "../rng.ts";
import type { StoryGames, StoryRound, StoryRoundRequest } from "../stories.ts";
import { STORY_BOOKS } from "../stories.ts";
import { readManifest } from "../studio-folder.ts";

/** The studio's book games, opened as they are first asked for, and kept open. */
export function createStoryBooks(root: string) {
	const studio = readManifest(root);
	const opened = new Map<string, BookGame>();

	/** Whether a game of the studio's is played from books. */
	const hasBooks = (slug: string) => existsSync(join(root, slug, "game.json"));

	/** A game by its slug, its books opened. Throws if the studio has no such game. */
	function gameOf(slug: string): BookGame {
		if (!studio.games.includes(slug) || !hasBooks(slug))
			throw new Error(`The studio has no game "${slug}" played from books.`);

		let game = opened.get(slug);

		if (!game) {
			game = loadBookGame(join(root, slug), studio.id ?? "studio");
			opened.set(slug, game);
		}

		return game;
	}

	return {
		/** The studio's games that are played from books, with their modes as they list them. */
		games(): StoryGames {
			return {
				games: studio.games.filter(hasBooks).map((slug) => {
					const { name, modes } = readGameManifest(join(root, slug));

					return {
						slug,
						name,
						modes: modes.map((mode) => ({ id: mode.id, name: mode.name }))
					};
				})
			};
		},

		/** Plays a round from the game's books, as far as the choices given take it. */
		round(request: StoryRoundRequest): StoryRound {
			const game = gameOf(request.slug);
			const seed = request.seed ?? Math.random().toString(36).slice(2);
			// The stream is made afresh for each question, as the site makes it for a bet.
			const rng = () => createRng("storybook", seed, 0);
			const mode =
				request.mode ?? readGameManifest(join(root, request.slug)).modes[0].id;

			let state: BookState = game.start({ mode }, rng(), request.held);

			for (const choose of request.choices ?? []) {
				const next = game.act(state, { choose }, rng());
				if ("problem" in next) throw new Error(next.problem);

				state = next.state;
			}

			return { view: game.view(state, rng()), seed };
		}
	};
}

/** The Vite plugin that puts the door in Storybook's own server. */
export function storyBooksPlugin(root: string): Plugin {
	return {
		name: "rolarie-story-books",
		configureServer(server) {
			let books: ReturnType<typeof createStoryBooks> | undefined;

			server.middlewares.use(STORY_BOOKS, (request, response) => {
				/** Answers, as JSON. */
				const send = (status: number, body: unknown) => {
					response.statusCode = status;
					response.setHeader("content-type", "application/json");
					response.end(JSON.stringify(body));
				};

				try {
					books ??= createStoryBooks(root);

					const url = new URL(request.url ?? "/", "http://localhost");
					if (url.pathname === "/games") return send(200, books.games());

					if (url.pathname === "/round") {
						const asked = JSON.parse(url.searchParams.get("request") ?? "{}");

						return send(200, books.round(asked as StoryRoundRequest));
					}

					send(404, { problem: "Stories ask for /games or /round." });
				} catch (error) {
					send(400, {
						problem: error instanceof Error ? error.message : String(error)
					});
				}
			});
		}
	};
}
