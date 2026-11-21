import { createGameServer } from "./app.ts";

const port = Number(process.env.PORT ?? 2567);
const host = process.env.HOST ?? "0.0.0.0";

const server = createGameServer();
await server.listen(port, host);
console.log(`Desert server listening on http://localhost:${port}`);
