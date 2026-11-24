# Rolarie studio SDK

Build games for Rolarie, a social casino played with play money. This is the SDK
(`src/`): how a game's outcomes are made into books, the client's bridge to the site, the
two views a game is drawn in, the stage, the board, the control bar and controls,
Storybook, the site's own checks, and the command line, `rolarie-studio`.

**Its README, [`src/README.md`](src/README.md), is the contract every game is held to.**

## Starting a game

Start from the template repository,
[Rolarie/game-template](https://github.com/Rolarie/game-template): press "Use this
template" there. It is a complete small studio, Studio Name, with one game, Game Title, a
three-reel slot kept deliberately simple, and its README walks through making it yours,
building it and sending a release. You need [Bun](https://bun.sh).

A studio keeps its games in as many repositories as it likes, one game to each or a few
together, and each depends on the SDK at a tag
(`"@rolarie/sdk": "github:Rolarie/sdk#v0.21.0"`). `bun x rolarie-studio` is the command
line a game's scripts run. This repository is not cloned to make a game: it is the package,
and what a studio needs of it is installed with it.

## Working on the SDK itself

```sh
bun install
bun run books          # make the test studio's books (src/test/book-studio)
bun run test           # the SDK's unit tests and, in a browser, those of its bar and controls
bun run test:browser   # its stage, its board, Storybook and `dev`, in a browser
bun run dev            # the test studio's Reel Test, at http://localhost:4280/
bun run stories        # Storybook: the SDK's own stories, and the test studio's
bun run check          # the site's checks, on the test studio
bun run typecheck
```

The SDK is tested on a small studio of its own, `src/test/book-studio`: Gem Drop, which has
one of everything a game played from books can have, and Reel Test, which has a client.
Neither is an example to start from: that is the template's Game Title. The SDK's version
is in `package.json`, and a release of it is a tag.

### The engine

What plays a game is the engine's (`@rolarie/engine`, a repository of its own that this
one depends on at a tag): the random stream, the books and their checks, the manifest, the
rules of a bet, and the bet pipeline a site plays every bet by. The SDK gives a studio
those under its own names (`/rng`, `/book-play`, `/bets`, ...), so a studio imports
everything it writes a game with from one package, and `rolarie-studio dev` plays a game
on the engine's stand-in: the same pipeline, over a store in memory.

The page `dev` plays a game in says how smoothly it is drawn: frames a second now, the
fewest it has fallen to, and the longest wait between two frames. The game's end of the
conversation counts them inside its frame, for a host that asks; a game does nothing for
it. The page a game is reviewed on asks too, and a game that does not run smoothly there
is not accepted, so watch the figure through the game's heaviest moments (a bonus, a big
win, turbo) before it is submitted.

To change the two together before either is released, clone the engine beside this
repository and link it: `mkdir -p local && ln -s ../../engine local/engine`. Then
`bun run local <script>` runs any script here on that clone (`bun run local test`,
`bun run local test:browser`, `bun run typecheck:local`). The SDK reaches the engine
through `imports` in `package.json` (`#engine/...`), whose `rolarie-dev` condition names the
clone's files; without it, the same imports are the installed package.

MIT licensed: see `LICENSE`.
