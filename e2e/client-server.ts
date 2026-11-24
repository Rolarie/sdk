/**
 * A client built and served as the site serves a studio game's: built by the SDK's one
 * build, every file under the policy and headers of the frame (src/frame.ts). For
 * tests of what the SDK gives a client, on pages of the SDK's own.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import { existsSync, readFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { buildClient } from "@rolarie/sdk/client-build";
import { CLIENT_FILE_TYPES, clientHeaders } from "@rolarie/sdk/frame";

/**
 * Builds the client in `folder` and serves it on `port` under `slug`, as the site would.
 * `url` is its page; `stop()` ends it.
 */
export async function serveClient(folder: string, slug: string, port: number) {
	const client = resolve(folder);
	await buildClient(client);

	const origin = `http://localhost:${port}`;
	const prefix = `/studio-frame/${slug}/`;
	const server = Bun.serve({
		port,
		fetch(request) {
			const path = new URL(request.url).pathname;
			const file = join(client, "dist", path.slice(prefix.length) || "index.html");
			const type = CLIENT_FILE_TYPES[extname(file)];

			if (!path.startsWith(prefix) || !type || !existsSync(file))
				return new Response("Not found", { status: 404 });

			return new Response(readFileSync(file), {
				headers: clientHeaders(origin, slug, type, path.slice(prefix.length))
			});
		}
	});

	return {
		// The folder, not its index.html: a page put together in the browser finds itself by its address.
		url: `${origin}${prefix}`,
		stop: () => server.stop(true)
	};
}
