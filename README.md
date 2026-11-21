# Desert Survival

A browser-based multiplayer survival game: crawl through a hot desert, find single-use water wells before other players do, and try not to die. See the design spec and the architecture proposal for the full picture.

**Status: milestone M0 (foundation).** You can open the game, enter a name, and crawl around a small greybox desert with other players in the same session. There is no health, water or death yet; those arrive in M1.

## Run it on your computer

You need [Node.js 22](https://nodejs.org/) and pnpm (`corepack enable` turns pnpm on).

```bash
pnpm install
pnpm dev
```

Then open http://localhost:5173 in two browser tabs, enter a name in each, and press Play. Both crawlers are in the same desert.

Controls (placeholders until the M1 control test): **W/S** crawl forward/back, **A/D** turn, **drag the mouse** to look around, **mouse wheel** to zoom.

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
