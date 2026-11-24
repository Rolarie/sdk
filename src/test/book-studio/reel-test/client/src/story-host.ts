/**
 * Reel Test in a story: something to play the game against in the site's place. It
 * is the SDK's stand-in for stories, which plays rounds from the game's real book: this
 * says only which game, and which rounds a story is of.
 *
 * Author: dwclake
 * Created: 2026-11-18
 */

import type { GameHost } from "@rolarie/sdk/client";
import { createStoryHost } from "@rolarie/sdk/stories";
import type { RoundView } from "./round.ts";

/** A stand-in for the site, for stories. With `winning`, every spin is one that pays. */
export function storyHost(
	winning = false,
	onannounce?: (text: string) => void
): GameHost<RoundView, null> {
	return createStoryHost<RoundView, null>({
		slug: "reel-test",
		name: "Reel Test",
		balance: 100_00,
		limits: { minStake: 10, maxStake: 100_00 },
		want: winning ? (view) => view.payoutBp > 0 : undefined,
		onannounce
	});
}
