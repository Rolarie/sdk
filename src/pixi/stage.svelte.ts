/**
 * What the pieces of a drawing share: the stage they are drawn on. `Stage.svelte` sets
 * it, a `Container` sets itself as the parent of what is inside it, and every piece adds
 * itself to the parent it finds here, keeps itself up to date from its props, and takes
 * itself away when its component goes.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import { getContext, onDestroy, setContext, untrack } from "svelte";
import type { Application, Container, FederatedPointerEvent, Ticker } from "pixi.js";

const KEY = Symbol("rolarie-pixi-stage");

/** Where a piece is drawn: the application, and the container it goes into. */
export interface StageContext {
	app(): Application;
	parent(): Container;
}

/** Sets where the pieces inside this component are drawn. */
export const setStage = (stage: StageContext): StageContext => setContext(KEY, stage);

/** Where this component is drawn. Throws outside a `Stage`. */
export function getStage(): StageContext {
	const stage = getContext<StageContext | undefined>(KEY);
	if (!stage) throw new Error("This is drawn on a stage: put it inside a <Stage>.");

	return stage;
}

/** What every piece of a drawing can be told: where it is, how it is turned, and what a press does. */
export interface DisplayProps {
	x?: number;
	y?: number;
	/** One figure for both ways, or one each. */
	scale?: number | { x: number; y: number };
	/** In radians. */
	rotation?: number;
	alpha?: number;
	visible?: boolean;
	/**
	 * Which is drawn over which among its siblings: the higher over the lower. Pieces are
	 * otherwise drawn in the order they were added, and one added later (inside an
	 * `{#if}`) goes on top: give pieces that must keep their order a `zIndex`.
	 */
	zIndex?: number;
	/** A name for it, for looking at a drawing in Pixi's tools. */
	label?: string;
	/** Called when it is pressed. A piece with this takes presses; one without lets them through. */
	onpress?: (event: FederatedPointerEvent) => void;
}

/**
 * Puts a Pixi object on the stage for a component: adds it to the parent, keeps it to
 * the component's props as they change, and destroys it with the component.
 */
export function place(object: Container, props: () => DisplayProps): void {
	const parent = getStage().parent();
	parent.addChild(object);

	$effect(() => {
		const { x, y, scale, rotation, alpha, visible, zIndex, label } = props();

		object.position.set(x ?? 0, y ?? 0);
		object.rotation = rotation ?? 0;
		object.alpha = alpha ?? 1;
		object.visible = visible ?? true;
		if (label !== undefined) object.label = label;

		if (typeof scale === "number") object.scale.set(scale);
		else object.scale.set(scale?.x ?? 1, scale?.y ?? 1);

		if (zIndex !== undefined) {
			parent.sortableChildren = true;
			object.zIndex = zIndex;
		}
	});

	$effect(() => {
		const press = props().onpress;
		if (!press) {
			object.eventMode = "auto";
			object.cursor = "auto";

			return;
		}

		object.eventMode = "static";
		object.cursor = "pointer";
		object.on("pointertap", press);

		return () => object.off("pointertap", press);
	});

	onDestroy(() => {
		// The stage may have gone first, and taken everything on it.
		if (object.destroyed) return;

		object.removeFromParent();
		object.destroy();
	});
}

/**
 * Calls `tick` every frame while the component is on the stage, with the stage's ticker:
 * `ticker.deltaMS` is the time since the frame before.
 */
export function onTick(tick: (ticker: Ticker) => void): void {
	const { app } = getStage();

	$effect(() => {
		const application = app();
		const ticker = application.ticker;
		const run = () => tick(ticker);

		ticker.add(run);

		// A stage taken away with its pieces (a view given way to another) has destroyed its
		// ticker before the pieces are told: there is nothing left to be taken off.
		return () => {
			if (untrack(app) === application) ticker.remove(run);
		};
	});
}
