/**
 * A story of Gem Drop's own: the test studio's, to show that a studio's stories are found
 * beside its game's client and shown with the SDK's.
 *
 * Author: dwclake
 * Created: 2026-11-17
 */

import type { Meta, StoryObj } from "@rolarie/sdk/stories";
import GemsStory from "./GemsStory.svelte";

const meta = {
	title: "Gem Drop/Gem meter",
	component: GemsStory,
	argTypes: { gems: { control: { type: "range", min: 0, max: 10 } } }
} satisfies Meta<typeof GemsStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PartFull: Story = {};

export const Full: Story = { args: { gems: 10 } };
