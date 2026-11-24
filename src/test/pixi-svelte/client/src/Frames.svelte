<!--
Counts the frames drawn while it is on the stage, to show that a piece can follow the ticker.

Author: dwclake
Created: 2026-11-17
-->
<script lang="ts">
	import { onTick } from "@rolarie/sdk/pixi";

	let { onframe }: { onframe: () => void } = $props();

	onTick(() => onframe());
</script>
