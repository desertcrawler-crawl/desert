import { routesFor, shadeFor, WORLD } from "@desert/sim";
import { createGameServer, restoreSessions } from "./app.ts";

const port = Number(process.env.PORT ?? 2567);
const host = process.env.HOST ?? "0.0.0.0";

// Build the map's shade grid and route table before anyone joins, so the first join is instant.
const t0 = performance.now();
shadeFor(WORLD);
routesFor(WORLD);
console.log(`Map ${WORLD.name} ready in ${Math.round(performance.now() - t0)} ms`);

const server = createGameServer();
await server.listen(port, host);
console.log(`Desert server listening on http://localhost:${port}`);
const restored = await restoreSessions();
if (restored) console.log(`Restored ${restored} saved session(s)`);
