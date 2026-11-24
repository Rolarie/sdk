/**
 * Reel Test: a round as its client plays it. A round is one row of the game's book:
 * a spin, and what it paid. These are the shapes of what the row holds and of what the
 * reels are told.
 *
 * Author: dwclake
 * Created: 2026-11-18
 */

import type { BookView } from "@rolarie/sdk/book-game";
import type { Spin, SymbolName } from "../../maths/rules";

/** The round as the site reports it. */
export type RoundView = BookView;

/** What a row holds: the maths writes these (../../maths/index.ts). */
export type RowEvent = ({ type: "spin" } & Spin) | { type: "total"; payoutBp: number };

/** What the reels are told to do. */
export type StageEvent =
	| { type: "reelsSpin"; reels: SymbolName[][]; pace: number }
	| { type: "reelsWin"; text: string };
