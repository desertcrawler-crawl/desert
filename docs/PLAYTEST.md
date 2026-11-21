# Playtesting online for free

No paid hosting is needed until a public launch. The same server runs everywhere; only where it runs changes.

## 1. On your own computer

```bash
pnpm install
pnpm build
pnpm start
```

Open http://localhost:2567. Other computers on your Wi-Fi can join at `http://<your computer's local IP>:2567`.

## 2. With friends over the internet (free, no account)

Keep `pnpm start` running, install [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/), and in a second terminal run:

```bash
cloudflared tunnel --url http://localhost:2567
```

It prints a public `https://….trycloudflare.com` link. Send it to friends. Limits: the link only works while your computer runs both commands, and it changes every time.

## 3. Always online, still free

The repository has a `Dockerfile`, so any host that runs containers can run the game. The best free fit today is a small always-free virtual machine (Oracle Cloud "Always Free" is the usual choice), because it doesn't sleep and has a real disk for saved sessions. Free container hosts (Render, Koyeb and similar) work too, but they usually sleep when idle and wipe their disk on redeploy, which ends the sessions. Free-tier terms change often, so check the provider's current page before signing up.

On a Linux VM with Docker installed:

```bash
git clone https://github.com/desertcrawler-crawl/desert.git && cd desert
docker build -t desert .
docker run -d --restart unless-stopped -p 80:2567 -v desert-data:/data --name desert desert
```

Players then open `http://<the VM's public IP>`. For `https` and a nicer address, run `cloudflared tunnel --url http://localhost:80` on the VM (free), or point a domain at it later.

Updating to a new version:

```bash
git pull && docker build -t desert . && docker stop desert && docker rm desert
docker run -d --restart unless-stopped -p 80:2567 -v desert-data:/data --name desert desert
```

## Sessions survive restarts

Each running session is saved every 10 seconds, and again when the server shuts down normally. The save is one file per session in `DATA_DIR/sessions` (default `apps/server/data`, `/data` in Docker). On start, the server brings the sessions back with their skeletons, crosses, wells, chat and characters. Each browser keeps a private token, so a returning player gets their own character back at the same spot with the same health. A session that stays empty for 10 minutes ends, and its file is deleted.

## Watching a playtest

- `/health` answers `{"ok":true}` when the server is up. Free uptime monitors (for example UptimeRobot) can ping it and email you if it goes down.
- `/stats` shows sessions, players per session, how long each simulation tick takes against its 50 ms budget, memory, and totals for joins, deaths, drinks and chat lines.

## Load test

With the server running, this joins 30 bot players that crawl, walk, slap and chat at random for 2 minutes, printing `/stats` every 10 seconds:

```bash
pnpm --filter @desert/server loadtest
BOTS=60 MINUTES=5 pnpm --filter @desert/server loadtest   # bigger
```

Measured here, 45 bots made 2 sessions (30 + 15). The average tick took 0.1 ms and the slowest about 3 ms, so one small free machine has plenty of room.
