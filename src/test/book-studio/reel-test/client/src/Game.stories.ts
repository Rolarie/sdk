/**
 * Reel Test's stories: the whole game played from its real book, in each of its two
 * views, a spin of any kind and one that pays.
 *
 * Author: dwclake
 * Created: 2026-11-18
 */

import type { Meta, StoryObj } from "@rolarie/sdk/stories";
import GameStory from "./GameStory.svelte";

const meta = {
	title: "Reel Test/The game",
	component: GameStory
} satisfies Meta<typeof GameStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ASpinFromTheBook: Story = {};

export const ASpinThatPays: Story = { args: { winning: true } };

export const TheTallView: Story = { args: { shape: "tall" } };

export const TheTallViewPaying: Story = { args: { shape: "tall", winning: true } };
