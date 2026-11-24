/**
 * Drawing a game with Pixi, from Svelte: a stage, and the pieces drawn on it, each a
 * component whose props say where it is and what it shows. A game's client writes what a
 * round looks like, and these keep Pixi to it.
 *
 *   <Stage width={1600} height={1000} pictures={{ lantern: "./art/lantern.png" }}>
 *     <Container x={200} y={100}>
 *       <Sprite texture="lantern" anchor={0.5} />
 *       <Text text="1.50 RC" y={80} style={{ fill: 0xffffff, fontSize: 32 }} />
 *     </Container>
 *   </Stage>
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

export { default as Container } from "./Container.svelte";
export { default as Graphics } from "./Graphics.svelte";
export { default as Sprite } from "./Sprite.svelte";
export { default as Stage } from "./Stage.svelte";
export { default as Text } from "./Text.svelte";
export { loadPictures, preparePixi } from "./prepare.ts";
export {
	getStage,
	onTick,
	type DisplayProps,
	type StageContext
} from "./stage.svelte.ts";

/**
 * What a `Graphics` hands its `draw`, and how a `Text` is set: for a game's own helper
 * that draws a shape or sets words, which would otherwise have no name for them.
 */
export type { Graphics as Drawing, TextStyleOptions } from "pixi.js";
