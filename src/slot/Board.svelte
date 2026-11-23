<!--
The board of a slot: its reels, each a column of symbols. It shows a grid, spins to one,
lets symbols fall when wins are taken away, and lights the cells that won with what each
win paid written on one of its own cells (../labels.ts). It decides nothing: every grid it
shows is handed to it, from a round's events.

A grid is its reels, left to right, each from the top down, as the maths has it
(../slots.ts). Get hold of the board with `bind:this` and call what it exports:

    <Board bind:this={board} reels={5} rows={3} cell={160} texture={(symbol) => symbol} />

    await board.spin(event.grid);
    board.showWins(event.wins.map((win) => ({ cells: win.cells, text: amount(win) })));

The amounts are what a player follows a round by, so they are written large (a third of a
cell, unless `labelStyle` says otherwise) and come on with a swell.

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts" generics="Sym extends string">
	import {
		Container,
		Graphics,
		Sprite,
		Text,
		Texture,
		type TextStyleOptions
	} from "pixi.js";
	import { onDestroy, untrack } from "svelte";
	import { placeLabels } from "../labels.ts";
	import { getStage, place, type DisplayProps } from "../pixi/stage.svelte.ts";
	import type { Cell, Grid } from "../slots.ts";
	import { fitLabel, popScale, type LitWin, type Pace } from "./board.ts";
	import { createTweens, steady } from "./tween.ts";

	interface Props extends DisplayProps {
		reels: number;
		rows: number;
		/** A cell's size on the stage: one figure for a square, or its width and height. */
		cell: number | { width: number; height: number };
		/** The room between cells. */
		gap?: number;
		/** The picture of a symbol: its name as the stage loaded it, or a texture. */
		texture: (symbol: Sym) => string | Texture;
		/** The grid to show to begin with. */
		grid?: Grid<Sym>;
		/** How long a reel spins, and how much later each reel stops than the one before, in milliseconds. */
		spinTime?: number;
		reelDelay?: number;
		/** How long symbols take to fall. */
		fallTime?: number;
		/**
		 * How an amount on a winning cell is set, as Pixi takes it. Left out, it is white with
		 * a dark edge, a third of a cell tall: big enough to be read at a glance, on any symbol.
		 */
		labelStyle?: TextStyleOptions;
		/** Called as each reel stops, for a sound. */
		onstop?: (reel: number) => void;
	}

	let {
		reels,
		rows,
		cell,
		gap = 0,
		texture,
		grid,
		spinTime = 600,
		reelDelay = 120,
		fallTime = 350,
		labelStyle,
		onstop,
		...display
	}: Props = $props();

	/** How dim a cell that did not win is while wins are lit. */
	const DIMMED = 0.3;
	/** How long an amount takes to come onto its winning cell, in milliseconds. */
	const POP = 260;
	/** The most an amount is wide, in cells: a wider one is drawn smaller, to keep clear of its neighbours. */
	const LABEL_CELLS = 1.9;
	/** How many symbols pass before a reel lands, beyond the ones it shows. */
	const PASSING = 6;

	const size = $derived(
		typeof cell === "number" ? { width: cell, height: cell } : cell
	);
	const stepX = $derived(size.width + gap);
	const stepY = $derived(size.height + gap);

	/** How an amount is set where the game does not say. */
	const ownLabelStyle = $derived.by((): TextStyleOptions => {
		const least = Math.min(size.width, size.height);

		return {
			fill: 0xffffff,
			fontSize: least * 0.34,
			fontWeight: "800",
			stroke: { color: 0x101114, width: least * 0.07, join: "round" }
		};
	});

	const root = new Container();
	const symbols = new Container();
	const labels = new Container();
	const window = new Graphics();
	const tweens = createTweens(getStage().app().ticker);

	// What is shown, and the sprite in each cell, by reel and row.
	let shown: Sym[][] = [];
	let sprites: Sprite[][] = [];

	root.addChild(symbols, labels, window);
	root.mask = window;
	place(root, () => display);

	// The board's own outline is all that is drawn of it: nothing shows past its edge.
	$effect(() => {
		window
			.clear()
			.rect(0, 0, reels * stepX - gap, rows * stepY - gap)
			.fill(0xffffff);
	});

	/** A symbol's sprite, the size of a cell. */
	function spriteOf(symbol: Sym): Sprite {
		const picture = texture(symbol);
		const sprite = new Sprite(
			typeof picture === "string" ? Texture.from(picture) : picture
		);

		sprite.setSize(size.width, size.height);

		return sprite;
	}

	/** Puts a reel's symbols in their cells, in place of whatever was there. */
	function setReel(reel: number, column: readonly Sym[]) {
		for (const sprite of sprites[reel] ?? []) sprite.destroy();

		sprites[reel] = column.map((symbol, row) => {
			const sprite = spriteOf(symbol);

			sprite.position.set(reel * stepX, row * stepY);
			symbols.addChild(sprite);

			return sprite;
		});
		shown[reel] = [...column];
	}

	// What a spin or a fall under way has still to do to leave the board whole: a reel to
	// land, a symbol to take away. The next thing the board is told may come before it has
	// finished, and must find the board as it would have been.
	const unfinished = new Set<() => void>();

	/** Ends whatever is moving, at once and where it would have ended. */
	function settle() {
		tweens.finish();
		for (const finish of [...unfinished]) finish();
	}

	/** Something to do when a tween has run, or sooner if the board is told something else first. */
	function once(finish: () => void): () => void {
		const run = () => {
			if (!unfinished.delete(run)) return;

			finish();
		};

		unfinished.add(run);

		return run;
	}

	/** Shows a grid at once, as it is. */
	export function show(next: Grid<Sym>): void {
		settle();
		light(null);
		next.forEach((column, reel) => setReel(reel, column));
	}

	/**
	 * Spins every reel to a grid, each stopping a little after the one before. Settles when
	 * the last has stopped.
	 */
	export async function spin(next: Grid<Sym>, pace: Pace = {}): Promise<void> {
		settle();
		light(null);

		const duration = pace.spinTime ?? spinTime;
		const stagger = pace.reelDelay ?? reelDelay;

		if (pace.instant || duration <= 0) {
			next.forEach((column, reel) => {
				setReel(reel, column);
				onstop?.(reel);
			});

			return;
		}

		// What passes on the way is only for show: any of the symbols in sight will do.
		const pool = [...next.flat(), ...shown.flat()];
		const passing = () => pool[Math.floor(Math.random() * pool.length)];

		await Promise.all(
			next.map(async (column, reel) => {
				// The reel as one strip: where it will land at the top, then what passes, then
				// what it shows now at the foot. It starts showing its foot and runs down to its top.
				const strip = new Container();
				const run = [
					...column,
					...Array.from({ length: PASSING }, passing),
					...(shown[reel] ?? [])
				];

				run.forEach((symbol, index) => {
					const sprite = spriteOf(symbol);

					sprite.y = index * stepY;
					strip.addChild(sprite);
				});

				const from = -(run.length - rows) * stepY;
				strip.position.set(reel * stepX, from);

				for (const sprite of sprites[reel] ?? []) sprite.destroy();
				sprites[reel] = [];
				symbols.addChild(strip);

				/** The reel stops: its strip gives way to the symbols it landed on. */
				const land = once(() => {
					strip.destroy({ children: true });
					setReel(reel, column);
					onstop?.(reel);
				});

				// A reel held back takes that much longer over the same run, so it comes down slowly.
				const held = Math.max(0, pace.holds?.[reel] ?? 0);

				await tweens.run(
					{ duration: duration + held, delay: reel * stagger },
					(share) => {
						strip.y = from * (1 - share);
					}
				);
				land();
			})
		);
	}

	/**
	 * Takes cells away and lets what is above them fall, with `drops` coming down each reel
	 * to fill it, top first: one step of a fall, as the maths records it (`fall` in
	 * ../slots.ts). Settles when everything has landed.
	 *
	 * `held`, if given, is a piece that stays put while the rest falls past it: after the
	 * fall its `cells` each show its `symbol` (a picture of the game's, an empty one if the
	 * piece is drawn some other way), nothing lands in them, and what was in them before is
	 * taken away. `drops` are then what comes down into a reel's other cells.
	 */
	export async function tumble(
		step: {
			taken: readonly Cell[];
			drops: readonly (readonly Sym[])[];
			held?: { cells: readonly Cell[]; symbol: Sym };
		},
		pace: Pace = {}
	): Promise<void> {
		settle();
		light(null);

		const gone = new Set(step.taken.map(([reel, row]) => `${reel}:${row}`));
		const fixed = new Set(
			(step.held?.cells ?? []).map(([reel, row]) => `${reel}:${row}`)
		);
		const falling = pace.fallTime ?? fallTime;
		const instant = pace.instant || falling <= 0;

		// The board is what it will be from the start: what won is set aside to fade, what is
		// left and what comes down are in their cells, and only where they are drawn has to
		// catch up. So whatever the board is told next, it is whole.
		const leaving: Sprite[] = [];
		const moves: { sprite: Sprite; from: number; to: number }[] = [];

		for (let reel = 0; reel < reels; reel++) {
			const fresh = step.drops[reel] ?? [];
			const kept: { symbol: Sym; sprite: Sprite }[] = [];

			(shown[reel] ?? []).forEach((symbol, row) => {
				const sprite = sprites[reel][row];
				const at = `${reel}:${row}`;

				if (gone.has(at) || fixed.has(at)) leaving.push(sprite);
				else kept.push({ symbol, sprite });
			});

			// What comes down starts above the board, in the order it will land.
			const arriving = fresh.map((symbol, index) => {
				const sprite = spriteOf(symbol);

				sprite.position.set(reel * stepX, (index - fresh.length) * stepY);
				symbols.addChild(sprite);

				return { symbol, sprite };
			});
			// What falls lands in the cells the held piece leaves free, top to bottom.
			const column = [...arriving, ...kept];
			const nextSprites: Sprite[] = [];
			const nextShown: Sym[] = [];
			let landing = 0;

			for (let row = 0; row < rows; row++) {
				if (fixed.has(`${reel}:${row}`)) {
					const sprite = spriteOf(step.held!.symbol);

					sprite.position.set(reel * stepX, row * stepY);
					symbols.addChild(sprite);
					nextSprites.push(sprite);
					nextShown.push(step.held!.symbol);
					continue;
				}

				const lands = column[landing++];
				if (!lands) continue;

				moves.push({
					sprite: lands.sprite,
					from: lands.sprite.y,
					to: row * stepY
				});
				nextSprites.push(lands.sprite);
				nextShown.push(lands.symbol);
			}

			sprites[reel] = nextSprites;
			shown[reel] = nextShown;
		}

		/** What won is taken away. */
		const clear = once(() => {
			for (const sprite of leaving) if (!sprite.destroyed) sprite.destroy();
		});
		/** Everything is where it lands. */
		const land = once(() => {
			for (const move of moves) if (!move.sprite.destroyed) move.sprite.y = move.to;
		});

		// What won goes first, then the rest falls.
		if (!instant)
			await tweens.run({ duration: falling / 3, ease: steady }, (share) => {
				for (const sprite of leaving)
					if (!sprite.destroyed) sprite.alpha = 1 - share;
			});
		clear();

		// Told something else while what won was fading: the board has been settled already.
		if (!unfinished.has(land)) return;

		await tweens.run({ duration: instant ? 0 : falling }, (share) => {
			for (const move of moves)
				if (!move.sprite.destroyed)
					move.sprite.y = move.from + (move.to - move.from) * share;
		});
		land();
	}

	/** Lights some cells and dims the rest, or with `null` lights them all again. */
	export function light(cells: readonly Cell[] | null): void {
		const lit = cells && new Set(cells.map(([reel, row]) => `${reel}:${row}`));

		sprites.forEach((column, reel) =>
			column.forEach((sprite, row) => {
				sprite.alpha = !lit || lit.has(`${reel}:${row}`) ? 1 : DIMMED;
			})
		);

		for (const label of labels.removeChildren()) label.destroy();
	}

	/**
	 * Lights the cells of some wins, and writes each win's `text` on one of its own cells,
	 * the cells chosen so that the amounts keep apart. Each amount comes on with a swell,
	 * which is what draws the eye to it (with `instant`, it is simply there), is drawn
	 * smaller where it would be wider than two cells, and is kept inside the board.
	 */
	export function showWins(
		wins: readonly LitWin[],
		{ instant = false }: Pick<Pace, "instant"> = {}
	): void {
		light(wins.flatMap((win) => win.cells));

		const board = reels * stepX - gap;
		const written: { label: Text; scale: number }[] = [];

		placeLabels(wins.map((win) => win.cells)).forEach(([reel, row], index) => {
			const text = wins[index].text;
			if (!text) return;

			const label = new Text({ text, style: labelStyle ?? ownLabelStyle });
			const { scale, x } = fitLabel({
				width: label.width,
				middle: reel * stepX + size.width / 2,
				board,
				most: size.width * LABEL_CELLS
			});

			label.anchor.set(0.5);
			label.position.set(x, row * stepY + size.height / 2);
			label.scale.set(scale);
			labels.addChild(label);
			written.push({ label, scale });
		});

		if (instant || written.length === 0) return;

		// Not waited for: the game holds the wins in view for as long as it means to, and a
		// board told something else meanwhile has taken these amounts away.
		void tweens.run({ duration: POP, ease: steady }, (share) => {
			for (const { label, scale } of written)
				if (!label.destroyed) label.scale.set(scale * popScale(share));
		});
	}

	/** The grid the board shows now. */
	export const showing = (): Grid<Sym> => shown.map((column) => [...column]);

	// The grid it was given to begin with, shown once.
	untrack(() => {
		if (grid) show(grid);
	});

	onDestroy(() => {
		unfinished.clear();
		tweens.finish();
	});
</script>
