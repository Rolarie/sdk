/**
 * What a board of reels (./Board.svelte) is told beyond a grid: how to pace what moves,
 * and which wins to light.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import type { Cell } from "../slots.ts";

/**
 * How a spin or a fall is paced. With `instant`, nothing moves: it is simply so. The
 * times, in milliseconds, are the board's own unless given here: for a spin played fast.
 */
export interface Pace {
	instant?: boolean;
	spinTime?: number;
	reelDelay?: number;
	fallTime?: number;
	/**
	 * How much longer each reel of a spin takes than it otherwise would, in milliseconds,
	 * by reel: a reel held back comes down slowly, for the suspense of what it may bring.
	 */
	holds?: readonly number[];
}

/** A win to light: its cells, and what to write on one of them. */
export interface LitWin {
	cells: readonly Cell[];
	text?: string;
}

/**
 * Where an amount written on a winning cell goes, and how big, so that all of it is read:
 * an amount wider than `most` is drawn smaller to fit that, and one that would run past
 * an edge of the board (which shows nothing outside itself) is moved in from it.
 *
 * `width` is the amount's width as written, `middle` the middle of its cell, and `board`
 * the board's width, all in the stage's pixels. What comes back is the scale to draw it
 * at and where its middle goes.
 *
 *     fitLabel({ width: 300, middle: 80, board: 800, most: 240 }); // { scale: 0.8, x: 120 }
 */
export function fitLabel(label: {
	width: number;
	middle: number;
	board: number;
	most: number;
}): { scale: number; x: number } {
	const scale = label.width > label.most ? label.most / label.width : 1;
	const half = Math.min(label.width * scale, label.board) / 2;

	return {
		scale,
		x: Math.max(half, Math.min(label.board - half, label.middle))
	};
}

/**
 * How big an amount is as it comes onto its cell, from 0 (it has just come) to 1 (it is
 * there): it starts at half its size, swells a little past it, and settles. That it
 * moves is what draws the eye to it.
 */
export function popScale(share: number): number {
	const back = 1.70158;
	const eased = 1 + (back + 1) * (share - 1) ** 3 + back * (share - 1) ** 2;

	return 0.5 + 0.5 * eased;
}
