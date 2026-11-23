/**
 * How an amount written on a winning cell is fitted to the board, and how it comes on.
 *
 * Author: dwclake
 * Created: 2026-11-23
 */

import { describe, expect, it } from "vitest";
import { fitLabel, popScale } from "./board.ts";

describe("an amount on a winning cell", () => {
	it("is left as written, on the middle of its cell, where it fits", () => {
		expect(fitLabel({ width: 120, middle: 400, board: 800, most: 300 })).toEqual({
			scale: 1,
			x: 400
		});
	});

	it("is drawn smaller where it is wider than it may be", () => {
		expect(fitLabel({ width: 600, middle: 400, board: 800, most: 300 }).scale).toBe(
			0.5
		);
	});

	it("is moved in from an edge of the board it would run past", () => {
		expect(fitLabel({ width: 200, middle: 80, board: 800, most: 300 }).x).toBe(100);
		expect(fitLabel({ width: 200, middle: 720, board: 800, most: 300 }).x).toBe(700);
		// Drawn smaller first, then kept in by what is left of its width.
		expect(fitLabel({ width: 300, middle: 80, board: 800, most: 240 })).toEqual({
			scale: 0.8,
			x: 120
		});
	});

	it("is never placed outside a board narrower than it", () => {
		expect(fitLabel({ width: 500, middle: 10, board: 200, most: 900 }).x).toBe(100);
	});

	it("comes on at half its size, swells past it, and settles at it", () => {
		expect(popScale(0)).toBeCloseTo(0.5);
		expect(popScale(1)).toBeCloseTo(1);
		expect(Math.max(...[0.5, 0.6, 0.7, 0.8, 0.9].map(popScale))).toBeGreaterThan(1);
		expect(popScale(0.7)).toBeLessThan(1.1);
	});
});
