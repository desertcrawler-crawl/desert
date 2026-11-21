/**
 * Load test: N bot players join the running server and crawl, walk, turn,
 * slap and chat at random, like a busy session. Prints the server's /stats
 * every 10 seconds.
 *
 *   pnpm --filter @desert/server loadtest            # 30 bots for 2 minutes
 *   BOTS=60 MINUTES=5 SERVER=http://localhost:2567 pnpm --filter @desert/server loadtest
 */
import { Client, type Room } from "@colyseus/sdk";

const SERVER = process.env.SERVER ?? "http://localhost:2567";
const BOTS = Number(process.env.BOTS ?? 30);
const MINUTES = Number(process.env.MINUTES ?? 2);

const rooms: Room[] = [];
let failed = 0;
for (let i = 0; i < BOTS; i++) {
  try {
    const room = await new Client(SERVER).joinOrCreate("desert", { name: `bot${i}` });
    for (const type of ["chat", "chatHistory", "fx"]) room.onMessage(type, () => undefined);
    rooms.push(room);
  } catch (err) {
    failed++;
    console.error(`bot${i} could not join:`, (err as Error).message);
  }
}
console.log(`${rooms.length} bots joined (${failed} failed), across ${new Set(rooms.map((r) => r.roomId)).size} session(s)`);

const pick = <T>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)]!;
const timer = setInterval(() => {
  for (const r of rooms) {
    if (Math.random() < 0.3) r.send("input", { forward: pick([1, 1, 1, 0, -1]), turn: pick([0, 0, 0, 1, -1]) });
    if (Math.random() < 0.01) r.send("posture", pick(["walk", "crawl"]));
    if (Math.random() < 0.02) r.send("slap");
    if (Math.random() < 0.005) r.send("chat", "water?");
    if (Math.random() < 0.02) r.send("rejoin");
  }
}, 250);

const report = setInterval(async () => {
  try {
    console.log(JSON.stringify(await (await fetch(`${SERVER}/stats`)).json()));
  } catch (err) {
    console.error("stats unavailable:", (err as Error).message);
  }
}, 10_000);

setTimeout(async () => {
  clearInterval(timer);
  clearInterval(report);
  console.log("final:", JSON.stringify(await (await fetch(`${SERVER}/stats`)).json()));
  await Promise.all(rooms.map((r) => r.leave().catch(() => undefined)));
  process.exit(0);
}, MINUTES * 60_000);
