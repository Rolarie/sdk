<!--
Gem Drop's gem meter, for its story: a studio's own piece, drawn with the SDK's.

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts">
	import { Stage, Text } from "@rolarie/sdk/pixi";
	import { Meter } from "@rolarie/sdk/slot";

	let { gems = 4 }: { gems?: number } = $props();
</script>

<div class="room">
	<Stage width={400} height={120} label="{gems} of 10 gems">
		<Text
			text="{gems} of 10 gems"
			x={20}
			y={16}
			style={{ fill: 0xffffff, fontSize: 22 }}
		/>
		<Meter
			x={20}
			y={60}
			value={gems}
			full={10}
			width={360}
			height={28}
			fill={0x4fd1a5}
		/>
	</Stage>
</div>

<style>
	.room {
		width: 400px;
		margin: 1rem;
	}
</style>
