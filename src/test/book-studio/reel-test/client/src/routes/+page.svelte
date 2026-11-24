<!--
Reel Test: the client's page. It decides nothing. A spin is a row the site drew from
the game's book, and comes back through the SDK already settled; the game only plays it
out (../Game.svelte), then tells the site it has been shown.

The SDK's page does what every game's page does: the loading screen from the first moment,
the site's answer, and the game's own code asked for once the page is in a browser. A game
says only what is its own: its name, its logo, how its loading screen looks, and where
its root component is.

Author: dwclake
Created: 2026-11-18
-->
<script lang="ts">
	import GamePage from "@rolarie/sdk/page";
	import "../style.css";
</script>

<!-- On the evening the game opens on (style.css's ground), so that when the loading screen
     leaves only what is in front changes, with the studio's logo over the name. -->
<GamePage
	title="Reel Test"
	logo="./loading-logo.svg"
	look={{
		surface: "radial-gradient(circle at 50% 20%, #24546a, #173341 55%, #0f2530)",
		ink: "#f4efe6",
		track: "#1d4152",
		fill: "#ffd56b",
		titleCase: "uppercase",
		titleSpacing: "0.14em",
		logoWidth: 96
	}}
	game={() => import("../Game.svelte")}
/>
