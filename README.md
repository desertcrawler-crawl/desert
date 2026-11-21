# Desert Survival

A browser-based multiplayer survival game: crawl through a hot desert, find single-use water wells before other players do, and try not to die. See the design spec and the architecture proposal for the full picture.

**Status: milestone M3 (first draft of the real map).** Every confirmed rule in the spec works, now on a 1.2 km × 0.9 km oval desert built from the spec's map working proposal: Crescent Crest, Twin Teeth Ridge, Split Spire Flats, the Buried Gate ruins, Fallen Dome and Long Shadow Basin, with 14 spawns, 50 authored well sites, 18 boundary scorpions and an invisible oval limit hidden in haze. Automated map checks (`packages/sim/test/map.test.ts`) confirm every spawn has a fair crawling route to water. The small greybox map (`packages/sim/src/greybox.ts`) stays for tests; `packages/sim/src/world.ts` picks the live map. All balance numbers are placeholders in `packages/sim/src/tuning.ts`.

To try dying without waiting, start the server with low starting health: `DESERT_START_HEALTH=12 pnpm dev`.

## Run it on your computer

You need [Node.js 22](https://nodejs.org/) and pnpm (`corepack enable` turns pnpm on).

```bash
pnpm install
pnpm dev
```

Then open http://localhost:5173 in two browser tabs, enter a name in each, and press Play. Both crawlers are in the same desert.

Controls (placeholders until the controls are confirmed): **W/S** forward/back, **A/D** turn, **Space** get up and walk, **C** or **Ctrl** get down and crawl, **F** slap, **Enter** chat, **drag the mouse** to look around, **mouse wheel** to zoom. (Holding Ctrl while pressing W closes the tab in most browsers, which is why C also works.)

## Other commands

| Command | What it does |
| --- | --- |
| `pnpm test` | Runs all automated tests (rules and multiplayer) |
| `pnpm typecheck` | Checks TypeScript in every package |
| `pnpm build` | Builds the browser game into `apps/client/dist` |
| `pnpm start` | Runs the server in production mode, serving the built game on port 2567 |

## How the code is organised

| Folder | Contents |
| --- | --- |
| `packages/sim` | All game rules as plain TypeScript, shared by server and browser. Every tuning number is in `src/tuning.ts`. |
| `apps/server` | The authoritative game server (Colyseus). One room is one desert session of up to 30 players. |
| `apps/client` | The browser game (Three.js): scene, camera, characters, HUD. |
| `apps/client/src/art` | The art slots and placeholders. See [docs/ART_PIPELINE.md](docs/ART_PIPELINE.md). |
| `docs/` | How to swap in art and how to playtest online for free. |

The server owns every result. The browser only sends what the player is trying to do (for example "crawl forward"), never positions or health.
