/**
 * Pixi under the policy a studio game's client is served with (the SDK's frame.ts): a
 * page that draws a shape, a picture loaded from its own folder and a word, and then
 * says what it drew and what the policy stopped. `e2e/pixi-frame.e2e.ts` opens it three
 * ways: with the two settings that need nothing of the policy loosened, as Pixi is by
 * default (`?mode=default`), and with only the first of the two (`?mode=eval-only`).
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import { Application, Assets, Graphics, Rectangle, Sprite, Text } from "pixi.js";

const mode = new URLSearchParams(location.search).get("mode");
/** Whether Pixi is kept from `new Function`, and whether pictures are loaded without a request. */
const noEval = mode !== "default";
const noRequests = mode !== "default" && mode !== "eval-only";

// Everything the policy stops is kept, for the test to read.
const stopped: string[] = [];
document.addEventListener("securitypolicyviolation", (event) => {
	stopped.push(`${event.effectiveDirective} ${event.blockedURI}`);
});

/** One pixel of what was drawn, as "red,green,blue". */
function pixelAt(app: Application, x: number, y: number): string {
	const { pixels } = app.renderer.extract.pixels({
		target: app.stage,
		frame: new Rectangle(x, y, 1, 1)
	});

	return [pixels[0], pixels[1], pixels[2]].join(",");
}

try {
	// Pixi builds its shader plumbing with `new Function` unless this is loaded first.
	if (noEval) await import("pixi.js/unsafe-eval");

	const app = new Application();
	await app.init({
		width: 200,
		height: 100,
		background: 0x000000,
		preference: "webgl"
	});
	document.body.append(app.canvas);

	// By default a picture is fetched and decoded in a worker made from a blob. The policy
	// allows no requests and no such worker; an image element needs neither.
	if (noRequests)
		await Assets.init({
			preferences: { preferWorkers: false, preferCreateImageBitmap: false }
		});

	const shape = new Graphics().rect(0, 0, 50, 50).fill(0xff0000);
	// A picture the policy stops is never refused: it simply never comes.
	const loaded = await Promise.race([
		Assets.load("./tile.png"),
		new Promise<never>((_, never) =>
			setTimeout(() => never(new Error("The picture never loaded.")), 3_000)
		)
	]);
	const picture = new Sprite(loaded);
	picture.position.set(100, 0);
	picture.setSize(50, 50);

	const word = new Text({ text: "RC", style: { fill: 0xffffff, fontSize: 24 } });
	word.position.set(10, 60);

	app.stage.addChild(shape, picture, word);
	app.render();

	document.body.dataset.shape = pixelAt(app, 25, 25);
	document.body.dataset.picture = pixelAt(app, 125, 25);
	document.body.dataset.ground = pixelAt(app, 75, 25);
	document.body.dataset.renderer = app.renderer.name;
} catch (error) {
	document.body.dataset.failed = error instanceof Error ? error.message : String(error);
}

document.body.dataset.stopped = JSON.stringify(stopped);
document.body.dataset.ready = "true";
