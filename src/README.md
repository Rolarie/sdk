# @keros3ne/sdk

Build games for Keros3ne, a social casino played with play money. This is the contract every
studio game is held to, and the tools to build one: how a game's outcomes are made into
books, the client's bridge to the site, the stage, the control bar and controls, Storybook,
the site's own checks, and `keros3ne-studio`, the command line to make a game's books, check
it and play it.

A studio's game can be far richer than the site's own: its own graphics and sound, bonuses
a player takes part in, meters that last between bets, its own controls. It is still held
to every rule of the site, below.

A studio starts from the template repository,
[Keros3ne/game-template](https://github.com/Keros3ne/game-template): a complete small
studio, Studio Name, with one slot, Game Title, and everything a studio sends. Press "Use
this template" there, and the SDK is a dependency of the repository it makes, at a tag. A
studio takes the SDK's updates by naming a newer tag.

## The shape of it

A game has two halves, kept apart on purpose.

| Half       | What it is                                    | Where it runs                                     | What it may do                                                 |
| ---------- | --------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------- |
| **Maths**  | Code that plays rounds, to make books of them | Where its books are made. Never on the site.      | Read the random stream it is handed. Nothing else.             |
| **Client** | The game as the player sees it                | In the player's browser, inside a sandboxed frame | Draw, play sound, and ask the site to act. It decides nothing. |

What the site plays a game from is its **books**: for each way of opening a round, a table
of rows, each with a whole-number weight, what it pays and the events that play it out. The
site draws a row from a bet's seeds. It has none of your code, and runs none.

Your game never touches a balance. The client cannot place a bet: it asks the page around
it, which checks the request and plays the round through the same pipeline as every game.

## A studio's repositories

A studio is known to the site by the name it was registered under and an id the site gave
it then. Its games are in as many repositories as it likes: one game to a repository, or
hundreds together. A site is sent a game, never a repository: each game is packed and
sent by itself, at its own version, so a studio with a hundred games updates one of them
by sending that one, and nothing else is fetched, built or checked again.

```
package.json                the SDK as a dependency, at a tag; your shared packages too
studio.json                 what this repository holds
<slug>/game.json            the game: its version, name, blurb, section, modes and counters
<slug>/guide.json           its rules and paytable, as data
<slug>/maths/index.ts       how each table's rounds play out (exports defineBooks(...))
<slug>/maths/*.spec.ts      your own tests of its rules
<slug>/books/books.json     what each table comes to: commit it
<slug>/books/*.index, *.rows   the books themselves: not committed
<slug>/client/              the client: src/routes/, public/card.svg, client.json
<shared>/                   anything this repository's clients share, named in "shared"
```

The SDK is a dependency (`"@keros3ne/sdk": "github:Keros3ne/sdk#v0.14.0"`), and
`keros3ne-studio` is its command line (`bun x keros3ne-studio check`). The SDK's own
repository is also a studio's repository, with one game, to read or to start from.

`studio.json`:

```json
{
	"sdk": "^0.14.0",
	"games": ["game-title"],
	"packages": { "@studio-name/kit": "https://github.com/studio-name/kit.git#v1.2.0" }
}
```

- `studio.json` is for your own tools: it says what this repository holds, so that
  `keros3ne-studio` knows where your games are. No site reads it, or anything else of
  your repository: a site is sent a game's package and nothing more.
- `sdk` is the version of this SDK you built on, as a range: said for people, and held
  to nothing. You build your client with the SDK you wrote it for, and a site takes it
  whatever SDK the site is on, so long as the two understand each other: your client
  speaks the site's protocol (recorded in `client/client.json` when it is built), and
  your books are in the format the site reads (recorded in `books/books.json`). `check`
  fails a game on either, and says which.
- `games` lists the games in this repository by slug. Each is a folder beside the
  manifest, laid out as above, and its section on the site (Games or Slots) is its
  `game.json`'s `category`. A folder of maths the manifest does not list fails the checks.
  The order says nothing.
- `shared`, if given, names folders beside the games that their clients share: code, art,
  sound.
- `packages`, if given, names what the clients share with your other repositories: see
  below.
- `id`, `name` and `blurb`, if given, are what your own tools call the studio. The site
  does not read them.

### Sharing between repositories: packages

What several games share (a look, sound, a sheet, a way of drawing) is a package: a git
repository of its own, of source (TypeScript, Svelte, styles, art), which each game's
repository depends on at a tag.

- In the game's `package.json` it is an ordinary dependency, which your package manager
  installs: `"@studio-name/kit": "git+https://github.com/studio-name/kit.git#v1.2.0"`.
- In the game's `studio.json` it is named in `packages`, at the same tag, so that `check`
  holds it to the rules a client's source is held to.
- A client imports its files by their paths: `import Sheet from "@studio-name/kit/Sheet.svelte"`.
- The package is held to a client's rules: what it imports by a relative address is its
  own, and it loads nothing from the network. Its `package.json` has no `exports` and no build: say what
  it needs as `peerDependencies` (`@keros3ne/sdk`, `svelte`), so that your package
  manager lets it find them.
- A game is pinned to the tag it names. Releasing the package changes no game until that
  game's repository names the new tag, and the game is built, packed and sent again.

Maths shares nothing: a game's books are made from its own folder alone.

## The game: `game.json`

```json
{
	"slug": "glacier-drop",
	"version": "1.0.0",
	"name": "Glacier Drop",
	"blurb": "Enough of a kind anywhere melts away and more tumbles in.",
	"category": "slots",
	"minStake": 20,
	"modes": [
		{ "id": "spin", "name": "Spin", "costBp": 10000, "table": "spin" },
		{ "id": "thaw", "name": "Buy the Thaw", "costBp": 250000, "table": "thaw" }
	]
}
```

- **`version`** is the game's own, three numbers with points between (`1.0.0`). A game is
  sent by itself at its version, whatever else you make: raise it to send the game again.
  It is no part of how the game plays.
- **Modes** are the ways of opening a round, the ordinary one first: what each costs, as a
  multiple of the bet in basis points (`10000` is one bet; always a whole number of bets,
  so that a cost comes to whole cents at any bet), and the table its row is drawn
  from. A cost is one bet at least and a thousand at most.
- **Every mode returns exactly 96.00% of what it costs.** You declare no return and no
  volatility: the weights make the return so, the site's check sums it exactly, and how
  much a game swings is read from its books (of the first mode: a bought bonus is not
  rated). Players are shown one word for it: low, medium or high.
- `shapes` are the shapes the game has a view for: `["wide", "tall"]` for one drawn for a
  phone too. Left out, wide only ("Draw a view for each shape", below).
- `steps` are what your bar moves the bet by, where they are not the site's own: bands
  from the smallest bets up, `{ "under": 200, "by": 20 }` for "by 0.20 under 2.00", the
  last with no `under`. Give the bar the same (`bets: { steps }`). A studio game's bet is
  never typed, so the site takes only a bet those steps reach, and refuses any other.
- `minStake` and `maxStake`, in cents, narrow the bets the site takes. The bet times a
  mode's cost must come to whole cents, or the site refuses the bet: a mode at a bet and a
  quarter needs a smallest bet of 0.20.
- **A game pays on the bet, never on what a play cost.** The client opens a round with the
  bet (`host.open(bet, { mode })`, never the cost); the site charges the bet times the
  mode's cost, and pays the bet times what the row pays. A game never divides its wins by
  its costs.

### A choice

A row may end in a `choice`: options that each name a table. The round stays open until the
player picks, and a row is then drawn from that option's table. The client sends
`host.act({ choose: id })`. A choice is counted at its best option, so make the options
worth the same.

### Counters: meters between bets

A game may keep meters for a player from one bet to the next:

```json
"counters": [{ "id": "bronze", "full": 55, "worthBp": 2379, "table": "pour-bronze" }],
"fills": [{ "counters": ["bronze", "silver"], "table": "pour-bronze-silver" }]
```

- A row says what it `adds` to them. A counter that reaches `full` gives `full` back, and a
  row is drawn from its `table`, in the same bet.
- `worthBp` is what one unit is worth, in basis points of the bet. The check counts a row
  that adds a unit as paying that much, and holds the counter's table to what `full` units
  were counted at, so the game returns what it says with the meters in it.
- `fills` name one table for several counters that fill on the same row, in place of each
  one's own.
- Counters are kept **separately for each size of bet**. Otherwise a player fills a meter at
  the smallest bet and collects what it pours at the largest.
- **A bonus as a table of its own.** A counter that fills at one (`"full": 1`) is how a row
  leads to another table with nothing held: a spin that lands the scatters adds one, and
  the bonus is drawn from its own table in that same bet. Use it for a bonus too rare or
  too large to be told well by the few spins of a book that land it, and open the same
  table from a mode to sell it.

## The maths

`maths/index.ts` exports, by default, how each table's rounds play out:

```ts
import { defineBooks, type PlayedRow } from "@keros3ne/sdk/book-play";
import { createRound } from "@keros3ne/sdk/slots";

function spin(rng): PlayedRow {
	const round = createRound();
	const played = spinOnce(rng); // your rules

	round.event("spin", { ...played }); // what the client plays, in order
	round.pay(played.bp); // of the bet, in basis points

	return round.row(); // or round.row({ adds }) or round.row({ choice })
}

export default defineBooks({
	seed: 20261117,
	tables: { spin: { rounds: 300_000, play: spin } }
});
```

- **Written with** `@keros3ne/sdk/book-play` and, for a slot,
  `@keros3ne/sdk/slots`: grids from strips or weights, lines, ways, pays anywhere
  and clusters, falls and free spins with their limits, and a recorder for a round's
  events. Keep the rules themselves in a file of their own (`rules.ts`), which the client
  may read to draw what the events say.
- **Pure.** The maths imports those, `@keros3ne/sdk/rng`, `valibot` and its own
  files, and nothing else. No clock, no network, no randomness of its own: a book must come
  out the same each time it is made. The scan (`scanMaths` in `/testing`) fails any file
  that so much as names `Math.random`, `Date.now`, `new Date`, `fetch`, `process`,
  `crypto`, `performance`, timers, `eval`, `new Function`, `Bun`, `self`, `globalThis`,
  `.constructor`, `postMessage`, `addEventListener` or `import.meta`, in code or in a
  comment.
- **Whole numbers decide.** Use `rng.int` and `rng.shuffle`, not comparisons of floats.
- **Limits.** Any loop that follows the reels (tumbles, cascades, respins) needs a hard
  limit. A row pays a whole number of basis points, from nothing up.
- **Play each table near what it must be worth.** A mode's table must be worth 96% of what
  the mode costs; a counter's, what its units were counted at; a choice's, what you say
  (`worthBp`). The weights make it exact, and the report warns when they had to lean far:
  look at the maths before trusting how such a table feels.
- **Shape.** A table may ask that a group of its rows be drawn once in so many rounds
  (`oneIn`), or make up so much of its worth (`share`): how often a bonus starts, say, held
  to what the guide tells a player.
- **A book holds the rounds that were played to make it and no others.** The rarest outcomes
  a game could have are in it only if one of those rounds landed on them. Play enough
  rounds, and give what is rare a table of its own.

`keros3ne-studio books [slug...]` plays the maths into books, weighs them, runs the site's
check and prints what each table holds. Commit `books/books.json`, the record of them.

A player's bet is checked in their own page: that the row it paid is the one its seeds
draw, against the digests of your books that the site's listing published. There is nothing
of yours to replay.

## The guide

A game's rules, and its paytable if it has one, are shown by the site in the window around
the game: its Rules and Paytable buttons. Write them in `guide.json`, as data (`GameGuide`
in `/guide`): headings, paragraphs (with a bold lead if wanted), lists, and tables of words
and figures. Nothing else: no markup, no pictures, no links. The site checks the guide and
draws it in its own type.

- Hold it to the rules with a test of your own, so that it says what the game does and
  changes when the game does (`multiple(bp)` writes a multiple as "1.50x").
- `rules` is how the game is played and what its features and choices mean; `paytable`,
  left out for a game with nothing to add, is what each symbol or outcome pays.

## The client

The client is static files built into `client/dist`: a page, scripts, styles, art, sound.
The site serves them from a folder of their own and shows the page in a frame inside its own
game window. It is written in Svelte and drawn with Pixi.

    client/src/routes/+layout.ts     `export const prerender = true;`
    client/src/routes/+page.svelte   the page: the loading screen, `connect()`, then the game
    client/src/Game.svelte           the game: its stage, its words, its control bar
    client/src/Reels.svelte          a piece on the stage, told what to do
    client/src/*.stories.ts          its stories (below)
    client/public/                   files served as they are: `card.svg`, a logo
    client/client.json               the record of what was built (below)

**How it is built.** A client is a SvelteKit app, built with adapter-static by the SDK
(`keros3ne-studio client`, `buildClient` in `/client-build`): by you, where your code is,
with the SDK you wrote it for. The site never builds your client and never runs your
code; it serves the files you built. There is no build configuration of your own (no
`vite.config`, `svelte.config` or `app.html`: `check` fails a client that has one): the
SDK's is the only one, with SvelteKit at an exact version, because what SvelteKit builds
is finished for the frame afterwards (the script a SvelteKit page starts itself with is
moved into a file, since the frame allows no script written into a page).

**The page is dark until you draw on it.** The SDK's frame for your page declares
`color-scheme: dark`, as the site round it is, so a player sees no white before your
loading screen; give your page a ground of its own colour, a solid colour under any
gradient.

**The page is rendered when it is built.** What `+page.svelte` draws first is in
`index.html` itself, on the screen before any of your code has arrived: that is where
the loading screen comes from. So the page, and whatever it imports at its top, must be
able to render with no browser and no site: no `window`, no `document`, no Pixi, no
`connect()` outside `onMount`. The SDK's page does this for you: `GamePage` (`/page`) is
the whole of a client's page, and a game says only its name, its logo, how its loading
screen looks, and where its root component is
(`<GamePage title="Game Title" game={() => import("../Game.svelte")} />`). It shows the
loading screen, answers the site, asks for the game's code in the browser (the build still
asks for that code from the start, with the rest), and hands the game `host`, `track` and
`onready`.

**What was built is put on record.** `keros3ne-studio client` builds each client into
`client/dist` (not committed) and writes `client/client.json` (committed): the digest of
every file it built. `check` holds the built client to that record, and `pack` packs
exactly that client, with every file's digest in the package for a site to hold it to. The
same source builds the same files, so `check --build` (which builds again first, leaving
the record alone) is how CI holds the record to the source.

Files the build names by what is in them (everything under `_app/immutable/`) are kept
by a player's browser for good; the page itself and what `public` brought are asked for
each time. You build your client, so what it imports by name is yours to choose: the
SDK, Svelte and Pixi (which the SDK brings), and any other package you install. Two
things are held (`check`): a file imported by a relative address is in the game's own
folder or one of your repository's shared folders, and nothing is loaded from the
network, which the frame would refuse anyway.
**Nothing is refused or complained of in the console**: a client that runs cleanly says
nothing there, and SvelteKit's one request of its own (whether a newer build has
replaced it) is answered in the page by the build, since a client can make none.

**What the sandbox means.** The frame has `sandbox="allow-scripts"`, and the files are served
under a policy that enforces the same even if one is opened directly:

- The page has an origin of its own. It cannot read the site's cookies or storage, or reach
  into the page around it.
- Scripts, styles, images, fonts and audio load only from the client's own folder.
- It can make no requests at all: no `fetch`, no WebSocket. Load sound and art with
  elements, or make them in code.
- No inline scripts.
- The files are public: a sandboxed page's requests carry no cookies, so nothing can check
  who asked.

**Talking to the site.** Use `connect()` from `/client`:

```ts
const host = await connect<View, ProgressView>();
host.init; // balance, stake limits, reducedMotion, a round to resume
await host.open(bet, params); // the bet in cents, never the cost; rejects with a Refusal if the site says no
await host.act(action);
host.settled(); // the result has been shown
host.announce(text); // words for screen-reader users
await host.progress(bet); // the player's progress at a bet
await host.history(); // their latest bets on this game
host.onBalance(listener);
```

The messages themselves are in `/protocol`, marked with the protocol's version. The site
ignores anything not from the game's own frame or not of an agreed shape, and refuses a
client built for another version of the protocol.

**Talking to the site.** Use `connect()` from `/client`:

```ts
const host = await connect<RoundView, Progress>();
host.init; // balance, stake limits, reducedMotion, a round to resume
await host.open(bet, { mode }); // the bet in cents, never the cost; rejects with a Refusal if the site says no
await host.act({ choose }); // a choice, where a round waits at one
host.settled(); // the result has been shown
host.announce(text); // words for screen-reader users
await host.progress(bet); // what the player's counters hold at a bet
await host.history(); // their latest bets on this game
host.onBalance(listener);
```

A round comes back as the rows drawn for it: `round.view.steps`, each with the row's
`events`, and `round.view.options` while the round waits at a choice (`BookView` in
`/book-game`). The messages themselves are in `/protocol`, marked with the protocol's
version. The site ignores anything not from the game's own frame or not of an agreed shape,
and refuses a client built for another version of the protocol.

### The pieces

- **The stage** (`/pixi`): `Stage`, and `Container`, `Sprite`, `Text` and `Graphics` on it,
  each a component whose props say where it is and what it shows. The stage is drawn in the
  game's own measure whatever room it has. With `seeThrough` it has no ground of its own,
  and whatever the page has under it shows through. A helper of your own that draws a shape
  for a `Graphics` takes a `Drawing`, and one that sets words a `TextStyleOptions`, both
  types from the same entry. Pixi is made ready for the frame's policy for you. Name the
  pictures to load in `pictures`: files of the client's own, or pictures written out in the
  address itself (`data:`). They are loaded by an image element, since the policy allows no
  request: do not load them with Pixi's `Assets`.
- **Events** (`/events`, `/emitter`): a round is rows, and a row is events in the order they
  happened. `playEvents` plays them through a handler for each kind, each finished before
  the next begins. A handler does not reach into the pieces: it broadcasts what should
  happen on the game's emitter and waits for the pieces that listen. So a piece knows only
  what it listens for, and can be played by itself in a story.
- **What slots share** (`/slot`): a `Board` of reels that shows a grid, spins to one, lets
  symbols fall when wins are taken away and lights wins with their amounts, and a `Meter`.
  Told something new while it is moving, the board ends what it was doing where that would
  have ended. A fall may hold a piece in place (`held`: its cells, and the picture they
  show), and the rest falls past it. A spin may hold reels back (`holds`). With `instant`,
  nothing moves: pass it when `host.init.reducedMotion` is set.
- **The game's views** (`/views`): `WideView` and `TallView`, which a studio draws its game
  in, each a picture of one size scaled as a whole; and `Views`, which shows whichever the
  game is told to. Which that is, is the engine's to say, never the game's.
- **The control bar and controls** (`/controls`): `ControlBar`, and `Menu`, `Choices`,
  `Switch`, `Slider`, `Field`, `Action`, `Popup` and `Autoplay`, as components.
- **The site in a story's place.** Have the game's root take the site as a prop (`host`),
  and a story hands it `createStoryHost({ slug })` (`/stories`): a stand-in that opens
  rounds from the game's real books, charges and pays as the site would, plays on from a
  choice and keeps a game's counters. Say which rounds a story is of with `want` (a spin
  that pays, one that lands the bonus), and what a way of playing costs with `cost`.
  `StoryFrame` (`/story`) is the box a story shows the game in, in either of its shapes,
  with what the game announces written under it.

### What a client must do

1. **Call `settled()` when a result has been shown.** The site learns the result before the
   animation plays, and holds back its own display of the balance, and any card pack that
   dropped, until then. If the game never calls it, the site shows them after five minutes.
2. **Be usable without sight or a mouse.** A canvas says nothing to a screen reader and
   cannot be tabbed to. Put real buttons over or beside it, and `announce` what happens.
   The site's accessibility test runs inside the frame.
3. **Honour `reducedMotion`.**
4. **Resume.** If `init.round` is set, the player has a round open, waiting at a choice,
   from this device or another.
5. **Use the control bar.** Every game is played with the SDK's bar or a bar made of the
   SDK's items, so that a player who knows one game knows what everything is in the next.

    **The SDK's bar** (`ControlBar` in `/controls`) is what a game has unless its studio
    makes another: a dock of frosted glass along the bottom of the game, with round buttons.
    The menu and the balance, the bet with buttons to lower and raise it, play in the bar's
    dead centre, autoplay and the speed of play after it, and the last win. It is laid
    out one way, whatever size the game is shown at: nothing in it measures the screen.
    What suits a view is said by the view, through three props: `betAs="menu"` makes the
    bet one button that opens the bets on offer; `readouts="strip"` puts the balance and
    the last win in a strip along the game's other edge; and `scale` makes it bigger. A
    tall view passes all three (`scale={2}`: it is drawn 900 across and shown on a phone at
    under half that, so its buttons must be twice the size to be pressed with a thumb); a
    wide view none.
    top. What a studio sets on it is simple:
    - `look` (`BarLook` in `/controls`): its colours and typefaces, how round its buttons
      are, and `tint`, a colour its glass is stained with, as stained glass is:
      `look={{ tint: "#6a3df0", accent: "#ffd56b", onAccent: "#0f2530" }}`. One item's own
      ground, edge, corners and padding are `look.segments.play`, and every item's
      `look.segment`.
    - `place`, `bottom` or `top`; `scale`, from 0.8 to 2.5; and `hide`, the menu and the win
      only.

    **A bar of your own** is the same items, placed where you like. Each is a component
    (`/controls`): `BarMenu`, `BarBalance`, `BarBet` (with minus and plus) or `BarBetButton`
    (one button that opens the bets), `BarPlay`, `BarAutoplay`, `BarSpeed` and `BarWin`.
    Write them inside a `BarFrame`, which takes what `ControlBar` takes and holds what the
    items share, in one `BarPart` or several, each placed and dressed by its own props
    (`edge`, `inset` for a part afloat, clear of the game's edges, and `look`: what it is
    drawn on, its edge, corners, padding, shadow and blur). What is inside a part you lay
    out yourself, with elements and styles of your own component:

        <BarFrame {bets} {startBet} {limits} {play} {onplay} {balance} {win} {busy} bind:bet bind:bar>
          {#snippet children(shared)}
            <BarPart edge="top" inset={16} look={{ surface: "#0008", radius: "999px", padding: "8px 20px" }}>
              <div class="readouts"><BarBalance /><BarWin /></div>
            </BarPart>
            <BarPart inset={16} gap={14} look={{ surface: "#0008", radius: "44px" }}>
              <div class="row">
                <BarMenu /><BarBet arrange="column-end" /><BarPlay size={1.3} /><BarAutoplay /><BarSpeed />
              </div>
            </BarPart>
          {/snippet}
        </BarFrame>

    An item takes more through its own props than the SDK's bar offers: `look` (its ground,
    edge, corners, padding, shadow and blur, and its own colours: its ink and label, its
    button's ground and edge, play's colours, the colour of what is switched on, the win's),
    `size` against the rest of the bar (0.5 to 2),
    and what is its own (a readout's `label` and `unit`, the bet's `arrange`, the bet
    button's `columns`). A bar of your own is laid out by what each of your views passes it,
    as the SDK's is, never by the size of the screen. A part says which `edge` of the game it is at, and may
    ask for clear room beyond itself (`gap`, for a bar afloat): the room
    it takes there is what `bar.inset()` reports, and its items' popups open away from it.
    What a bar of your own must still be:
    - Made of the SDK's items. Never draw a bet control, a balance or a play button of
      your own.
    - Complete: the balance, the bet and play are in every bar, and a frame without one of
      them throws. The rest are yours to leave out.

    `bets` is a list, or the steps the bet buttons move by
    (`{ steps: [{ under: 100, by: 10 }, { by: 100 }] }`: by 0.10 under 1.00, then by 1.00).
    The bet is always one of those on offer: a player does not type one. Draw clear of the
    bar with `bar.inset()`, or with `--sdk-bar-top` and `--sdk-bar-bottom` in a style sheet;
    `bar.rect()` says where its bottom part is, to put a button of the game's own beside it.

    What the bar shows is its props: `balance`, `win`, `busy` while a round is played or
    shown, `autoLeft` as autoplay runs. The bet comes back with `bind:bet`, and `bind:bar`
    hands over the bar itself (a `BarHandle`), for `bar.pace()`, `bar.inset()`, `bar.rect()`
    and `bar.focusPlay()`. More for its menu is written inside it (`{#snippet menu()}`).

    Set `win` to 0 when a play starts and to what it won once that has been shown. The bar
    keeps the last win of more than nothing in view: green while it is the last play's own,
    greyed once a later play has started or won nothing, so that a player can tell at a
    glance, at any speed, whether the play just gone won. Since the bar says what a play
    won, a game does not write that total out again somewhere else of its own.

    The balance the bar shows must not give a result away. A round's `balance` is what the
    site holds once the round is paid, known before the game has shown anything: while the
    result plays show `balanceBeforePayout(round)` (`/client`), which has the stake gone and
    the win not yet come, and `round.balance` once the result has been shown.

    The speed button has three settings: the ordinary pace, fast and turbo. A game too quick
    for speed to matter passes `speeds="none"`. Ask `bar.pace(inBonus)` at each step of a
    play and multiply every time by it: it is 1 at the ordinary pace, 0.7 when fast and 0.5
    at turbo. Fast quickens ordinary play only, so pass `true` while free spins or a feature
    are shown, and turbo quickens everything. Set the ordinary pace so that a player new to
    the game can follow all of it; turbo is for one who knows it. The speed is the player's
    choice alone: autoplay never changes it.
    - Dress the SDK's bar and its items through their props (`look`, `size`), and place a
      bar of your own with classes on its parts: never by reaching into an item's markup.
    - What a game adds for itself (a button to buy a bonus) is not one of the bar's items: in
      a bar of your own it goes where you like among them, and with the SDK's bar, above it.
    - Autoplay is chosen in Auto's popup (Off, or a number of plays: ten to a hundred by
      tens unless the game gives `counts` of its own), which closes and only readies it:
      the play button then shows the number over a triangle, and pressing it calls
      `autoplay.onstart(count)`. While the plays run, it shows how many are left over a
      square, and pressing it calls `autoplay.onstop()`; Auto cannot be pressed. Escape over
      the bar puts away plays that are waiting.
    - When the next play costs something other than the bet shown, say what with `cost`.
    - While free spins play, show how many are left on the play button with `freeSpins`, and
      `null` when they are over. The button cannot be pressed meanwhile: free spins are not
      the player's to stop.
    - When the next play is a kind of its own (a boosted spin, a bonus spin), say so over the
      bet with `betLabel`, and `null` for "Bet" again. Name every such kind up front in
      `betLabels`, each at most 10 characters, which are no wider than the amount: the bar
      never changes size. A name not declared throws.
    - A component must not read, while it is being set up, a prop the site may still be
      waiting for. The bar takes its balance once it is in the page.

6. **Use none of the browser's own controls.** `/controls` has replacements, drawn by the
   game, usable from a keyboard and announced properly by a screen reader: `Menu` in place
   of `<select>`, `Popup` for what does not fit in the row of controls, `Switch` in place
   of a checkbox, `Choices` in place of radio buttons, `Action` for a line in a popup that
   does something, `Slider` in place of a range input, and `Field` for a value to type.
   Each takes its colours and corners as a `look` prop (`ControlLook`). `check` fails a client with a
   `<select>` or a checkbox. **Keep the row of controls the same size**: a button that
   appears only while something is running pushes the others about. Put such things in a
   popup, or make one button change what it does.
7. **Put a button where the thing it does is drawn.** When controls sit over a stage, work
   out their place from the same numbers the drawing uses, not from a second set of sizes
   in CSS.
8. **Show a loading screen while the game gets ready.** `GamePage` (`/page`) does: it puts
   the SDK's loading screen in your page and tells it what the game waits for (the site's
   answer, the game's own code, the typefaces in `fonts`). Your game's root tells it of the
   rest through the `track` it is handed (give it to the stage, for its pictures), and
   calls `onready` once it can be played, which takes the screen away. A page of your own
   making does the same with `<LoadingScreen>` and `createLoading()` from `/loading`:
   `loading.track(...)` for each thing waited on, and `loading.done()` once the game under
   the screen has been drawn. It covers the game from the first moment, however
   short the wait, so a player never sees the game being put together: call `done()` only
   when everything is ready to be seen. Because your page is rendered when it is built,
   the screen is in the page itself, and fills as your code arrives.

    **Make it look like your game**, through its props, so that when it leaves only what
    is in front changes:

    ```svelte
    <GamePage
    	title="Game Title"
    	logo="./loading-logo.svg"
    	look={{
    		surface: "linear-gradient(#1b2a5c, #0d1022)",
    		ink: "#eef0ff",
    		fill: "#ffd166",
    		titleCase: "uppercase"
    	}}
    	game={() => import("../Game.svelte")}
    />
    ```

    `logo` is your logo, over the name: a picture in `client/public`, or one your page
    imports. `look` is the screen's ground, the name's colour, typeface, size, weight,
    spacing and case (`showTitle: false` leaves the name out, where the logo says it), the
    bar's colours, size and corners, the logo's size, and the room between them
    (`LoadingLook`). Where the screen is and what it covers are not yours to change.
    Game Title's page, in the template, does all of this.

9. **Show what each win paid, over the reels.** A slot writes the amount of each win where
   it is, not only the total. The `Board` does (`showWins`), choosing a cell of each win so
   that several amounts keep apart; `placeLabels()` in `/ui` is the same choice, for a
   board of your own.
10. **Draw a view for each shape.** A game is drawn twice: `wide`, 16 by 10, which every
    game must have, and `tall`, 9 by 16, for a phone held upright, which is optional. Say
    which you have in `game.json` (`"shapes": ["wide", "tall"]`; left out, wide only). A
    game with no tall view is shown wide everywhere.

    A view is one picture of a fixed size, scaled as a whole to the room the game has:
    **1600 by 1000** for wide, **900 by 1600** for tall. The sizes are not yours to choose.
    You write a view file for each, use the SDK's view component in it, and place your
    game's components inside in the view's own pixels:

        <!-- your WideView.svelte -->
        <script lang="ts">
          import { WideView } from "@keros3ne/sdk/views";
          let { game } = $props();
        </script>

        <WideView>
          <Reels x={700} y={64} size={760} {game} />
          <Bar {game} />
        </WideView>

        <!-- your TallView.svelte -->
        <TallView>
          <Reels x={50} y={330} size={800} {game} />
          <Bar {game} betAs="menu" readouts="strip" scale={2} />
        </TallView>

    The rules that make this work:
    - **Nothing in a game is laid out by the size of the screen.** No media queries, no
      container queries, no `vw` or `vmin`, no measuring the window. A view is the same
      picture at any size.
    - **A shared component never asks which view it is in.** No `tall` flag passed down and
      branched on. What differs between your two views (where a thing is, how large, which
      arrangement of the bar) is passed by each view as props, as above.
    - **A view may still change with the game.** A panel shown only during a bonus, reels
      that slide over to make room for it, a figure that grows with its digits: all fine.
      What does not change is where things are from one screen to another.
    - **You do not switch views.** Keep what the game knows (its round, its balance) in one
      place above them, hand both to `Views`, and it shows the one the game is told:

          <Views {host} wide={WideView} tall={TallView} props={{ game }} />

        The engine chooses, from the room the page gives the game, and a view is made again
        when the other was showing, so nothing of the game may live in a view.

    A canvas in a view must be drawn with as many dots as it is shown with: the SDK's
    `Stage` does this itself, and `getView()` (`/views`) gives the scale to anything else
    that needs it. Give each view a story (`<Views show="tall" ...>` shows one whatever the
    game is told), as Game Title does.

**A package your games share, as you change it.** A studio with several games keeps what
they share in a package of its own (a kit: its bar, its buttons, its sound), at a tag in
each game's `package.json`. To try a change to it without tagging it first, give it a name
in each game's `imports`, with a `local` condition that names its clone beside the game:

    "imports": {
      "#kit/*": { "local": "./local/kit/*", "default": "@studio/kit/*" }
    },
    "scripts": {
      "local": "LOCAL_PACKAGES=1 BUN_OPTIONS=--conditions=local NODE_OPTIONS=--conditions=local bun run"
    }

Import it as `#kit/Bar.svelte` in the game, and link the clone once (`mkdir -p local && ln -s
../../kit local/kit`; keep `local/` out of git). Then `bun run local dev` plays the game on
the kit as it stands in its clone, and `bun run dev`, `bun run client` and a release are on
the kit at its tag, as before. A client built with `local` says so in its `client.json`
(`conditions`), since no tag of the kit made its files: `keros3ne-studio pack` refuses to
pack one, and a site refuses to accept one. Build it again without `local` before a
release.

**The card.** Supply the picture for your game's card: `client/public/card.svg`, upright
(three wide by four high), with nothing important in the bottom third, where the site lays
the game's name over it. It is the only picture of the game the site shows. Do not use emoji
for artwork, in the card or the client: they show as empty boxes where no emoji font is
installed.

What stays the site's: the window around the game, its favourite and full-screen buttons,
and the History and Fairness panels under it. Those are how a player checks the game.

## Stories

`keros3ne-studio stories` opens Storybook on your studio: the stories you have written
beside a game's client, and the SDK's own, of the pieces every game shares. The Storybook
is the SDK's, as the client build is: you bring no configuration for it.

- A story is a `*.stories.ts` file under a game's `client/`, in Storybook's usual form: a
  component and the props to show it with (`Meta` and `StoryObj` come from
  `@keros3ne/sdk/stories`). A piece drawn on a stage needs the stage round
  it, so a story's component is usually a small Svelte file of its own (`ReelsStory.svelte`)
  that puts the piece on a `Stage` with a button or two to work it.
- `roundFromBooks()` (`@keros3ne/sdk/stories`) hands a story a round played from the
  game's real books, as the site would play it. Play it through the game's own handlers
  (`playSteps`), and the story shows what a player will see. A round that stops at a choice
  says what may be picked: ask again with the same `seed` and the choice added.
- "Books" among the SDK's stories plays rounds from any of your games' books and lists the
  events of each row, before any of the client is drawn.
- Stories are never built into a client, and are not held to a client's rules: only
  Storybook loads them.

Make a game's books first (`keros3ne-studio books`): a story cannot play from books that
are not there. `keros3ne-studio dev` is still how a game is played whole, by the site's
rules; stories are for one piece, one event or one kind of round at a time.

## The command line

`keros3ne-studio` is `src/cli.ts`, run with [Bun](https://bun.sh) in your studio's folder
(or pass `--root <folder>`). The repository's scripts run it:

```sh
bun run books [slug...]     # make a game's books from its maths, and say what they hold
bun run check [slug...]     # the site's checks: books, guide, maths, client
bun src/cli.ts dev <slug>   # play it in a browser, run by the engine as a site runs it
bun run stories             # your stories, and the SDK's own, in Storybook
```

- **`books`** plays each table's rounds, on every core, weighs the rows so that each table
  is worth exactly what it must be, runs the site's check, and prints what each table
  holds: how often it pays, its largest win, how its worth is spread, and each mode's
  return and volatility. It fails if the books do not pass.
- **`check`** runs every check of the site's: the manifest, each game's `game.json`, its
  books as they stand (they must be the ones `books.json` records, and pass), its guide,
  its maths' purity, the client's source, and the built client: that it is the one
  `client/client.json` records, and what is in it (`scanClient`). `--build` builds each
  client again first.
- **`client`** builds each game's client into `client/dist` and writes the record of what
  it built, `client/client.json`, to commit.
- **`dev`** builds the client whenever it changes and serves it at
  `http://localhost:4280/`, sandboxed under the site's own policy, in a page that stands in
  for the site. It plays the game from its books by the site's own rules, with a pretend
  balance and a pair of seeds: the same stake limits, refusals and rounding of payouts,
  counters kept for each size of bet. It holds the balance back until the game calls
  `settled()`, as the site does, and says so if the game never does. Beside the game it
  shows the balance, what the game announced, the seeds, and every message both ways,
  including those the site would ignore, and why. It switches between the two shapes and
  reduced motion; it starts again when the maths changes, and reloads the game when the
  client is built again. `--port` and `--balance` change where it serves and the balance
  it starts with. It does not do the site's rewards, rate limits, or History and Fairness
  panels.

## Sending a game

**A game is sent as one file, and nothing else of yours goes with it.** No site sees the
repository a game was made in: `keros3ne-studio pack` writes everything a site needs of
a version of a game into `release/<slug>-<version>.tar.gz`, and that file is what you
send.

```
game-title-1.2.0.tar.gz
  release.json   what the package holds: every file by its place, size and digest
  game.json      the game's manifest
  guide.json     its rules and paytable
  card.svg       the picture a site lists it under (client/public/card.svg)
  client/        the client as you built it: every file of client/dist
  assets/        what else the game is made of, where its folder has an assets/
  maths/         what your maths made: books.json, and each table's .index and .rows
```

It is an ordinary archive, which `tar -xzf` opens, so you can see exactly what you are
sending. The same game packs to the same bytes wherever it is packed, and `pack` says
the file's digest. Nothing in this package reaches GitHub or anywhere else from your
machine: `keros3ne-studio` reads and writes the files of your repository and no more.

1. Change the game, and raise `version` in its `game.json`: a site publishes a version
   once, and the next must come after it.
2. Run `books`, `client`, `check` and your tests. `pack` holds the books to the whole
   check and the built client to its record (`client/client.json`) before it packs
   anything, so commit that record and `books/books.json` with the change.
3. Run `keros3ne-studio pack <slug>`, and send Keros3ne the file.

`keros3ne-studio make <slug>` does the commands of steps 2 and 3 in one: the game's books
made, its client built, the checks run and the game packed, one after another, stopping
at the first that fails with nothing packed. Your own tests are still yours to run, and
the two records still yours to commit.

**Each game is sent by itself**, at its own version, however many games you make.

**An update to a game with counters** must say what becomes of what players hold in
them, if the counters changed. `converts`, in `game.json`, names each counter of the
version before and the one of this version it goes into:

```json
"converts": {
	"from": "1.1.0",
	"counters": { "bronze": { "to": "bronze", "times": 11, "over": 10 } }
}
```

A player holding `u` units of the old `bronze` then holds `u` times 11 over 10, rounded
up, of the new. A unit of a counter is worth its `worthBp` of the bet, and a site takes
the update only if nobody, whatever they held, is left holding less than they held, no
counter is filled by the conversion, and every size of bet the old version offered is
still offered (counters are kept at each). Counters that did not change need nothing
said. `keros3ne-studio check <slug> --follows <the old game.json>` says whether an
update passes, and the most rounding up gives away.

A site installs a package only whole and only as it says it is: every file the one
`release.json` names, and no other. It checks your `game.json` and `guide.json`, which
are data, runs the whole check on your books, and holds your client to the kinds of file
a client may be made of and to the protocol it speaks. People review what you sent, as
it was built: your books, by what they come to (each mode's return, how much it swings,
the most it pays), your guide, and your game, played. Nobody reads your source, because
nobody is sent it. **The site never runs your maths**: the books are the game. **Nor does
it build or run your client's code**: it serves the files you built, sandboxed. A game
earns players rewards (xp, rakeback, card packs) once it is published: its books are what
hold it to its return.

A site keeps every version of a game it has published. A bet records the version it was
played on and is checked against that version's books, so an update leaves past bets as
verifiable as they were. A round a player has open when a game is updated is finished on
the version it was opened on; their next round is on the new one.

## The main entries

| Entry                 | What it is                                                              |
| --------------------- | ----------------------------------------------------------------------- |
| `/book-play`          | `defineBooks`, and what a table's maths is written with                 |
| `/slots`              | grids, lines, ways, clusters, falls, free spins, and a round's recorder |
| `/rng`                | the random stream: the site's from a bet's seeds, and the maths' own    |
| `/game-manifest`      | `game.json`'s shape and check                                           |
| `/guide`              | the shape of a game's rules and paytable, and the site's check of one   |
| `/manifest`           | `studio.json`'s shape and check                                         |
| `/book-game`          | a round as the client is sent it (`BookView`), and how a bet is checked |
| `/protocol`           | the messages the client and the site exchange                           |
| `/client`             | `connect()`, the client's side of those messages                        |
| `/pixi`               | the stage, and what is drawn on it                                      |
| `/events`, `/emitter` | playing a round's events in order, and telling the pieces               |
| `/slot`               | the board of reels and the meter                                        |
| `/controls`           | the control bar and the controls, as components                         |
| `/bar`                | the bar as a game is handed it, and the layout a studio may ask for     |
| `/loading`            | the loading screen                                                      |
| `/stories`            | what a story is written with, and rounds from the books for it          |
| `/client-build`       | how every client is built                                               |
| `/testing`            | the site's own checks: the scans of a game's maths and client           |
| `/stand-in`           | the engine's stand-in for a site: its bet pipeline in memory, for `dev` |
| `/*.css`              | the style sheets of the bar, the controls and the loading screen        |

The protocol's version is part of every message, and goes up when a message changes in a
way the other side would misread. The SDK's own version follows semver.

MIT licensed: see `LICENSE`.
