/**
 * The round the test page plays: one row, as a game's books would hold it, and what the
 * pieces of the page are told as it is played.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import type { Cell, Grid } from "@rolarie/sdk/slots";

export type Sym = "a" | "b" | "c" | "d";

/** What a row holds, in the order it happened. */
export type RowEvent =
	| { type: "spin"; grid: Grid<Sym> }
	| { type: "win"; wins: { cells: Cell[]; amountBp: number }[] }
	| { type: "tumble"; taken: Cell[]; drops: Sym[][] }
	| { type: "total"; payoutBp: number };

/** What the pieces on the stage are told to do. */
export type StageEvent =
	| { type: "reelsShow"; grid: Grid<Sym> }
	| { type: "reelsSpin"; grid: Grid<Sym>; instant: boolean }
	| { type: "reelsWins"; wins: { cells: Cell[]; text: string }[] }
	| {
			type: "reelsFall";
			taken: Cell[];
			drops: Sym[][];
			held?: { cells: Cell[]; symbol: Sym };
			instant: boolean;
	  }
	| { type: "reelsRead" };

/** What the board shows before anything is played: three reels of two. */
export const START: Grid<Sym> = [
	["a", "b"],
	["c", "d"],
	["b", "a"]
];

/** Where the reels land: three `a` along the top. */
export const LANDED: Grid<Sym> = [
	["a", "c"],
	["a", "d"],
	["a", "b"]
];

/** The top row wins, is taken away, and what is under it falls with new symbols above. */
export const TAKEN: Cell[] = [
	[0, 0],
	[1, 0],
	[2, 0]
];
export const DROPS: Sym[][] = [["d"], ["b"], ["c"]];

export const ROW: { events: RowEvent[] } = {
	events: [
		{ type: "spin", grid: LANDED },
		{ type: "win", wins: [{ cells: TAKEN, amountBp: 15_000 }] },
		{ type: "tumble", taken: TAKEN, drops: DROPS },
		{ type: "total", payoutBp: 15_000 }
	]
};

/**
 * A fall with a piece held in place, from the grid the board starts on: the piece takes
 * the top of the first reel and shows `d`; what was in that reel goes, and the one symbol
 * that comes down lands under the piece, not in it. The second reel falls as any does.
 */
export const HELD_FALL = {
	taken: [
		[0, 0],
		[0, 1],
		[1, 1]
	] as Cell[],
	drops: [["c"], ["b"], []] as Sym[][],
	held: { cells: [[0, 0]] as Cell[], symbol: "d" as Sym }
};

/** What the board shows after it. */
export const HELD_FALLEN: Grid<Sym> = [
	["d", "c"],
	["b", "c"],
	["b", "a"]
];
