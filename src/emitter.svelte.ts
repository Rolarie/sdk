/**
 * An emitter (./events.ts), tied to Svelte components: a game's root component provides
 * one, and a piece listens on it for as long as the piece is there.
 *
 *   // in the game's root
 *   const emitter = provideEmitter<StageEvents>();
 *
 *   // in a piece
 *   onEvent(getEmitter<StageEvents>(), "reelsSpin", (event) => board.spin(event.grid));
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import { getContext, setContext } from "svelte";
import { createEmitter, type Emitter, type Listener, type Typed } from "./events.ts";

const KEY = Symbol("rolarie-emitter");

export type { Emitter };

/** Makes the game's emitter and gives it to every component inside this one. */
export function provideEmitter<Events extends Typed>(
	emitter: Emitter<Events> = createEmitter<Events>()
): Emitter<Events> {
	return setContext(KEY, emitter);
}

/** The game's emitter. Throws where no component above provided one. */
export function getEmitter<Events extends Typed>(): Emitter<Events> {
	const emitter = getContext<Emitter<Events> | undefined>(KEY);
	if (!emitter)
		throw new Error(
			"No emitter was provided: call provideEmitter() in the game's root."
		);

	return emitter;
}

/** Listens for one kind of thing for as long as the component calling this is there. */
export function onEvent<Events extends Typed, Type extends Events["type"]>(
	emitter: Emitter<Events>,
	type: Type,
	listener: Listener<Extract<Events, { type: Type }>>
): void {
	$effect(() => emitter.on(type, listener));
}
