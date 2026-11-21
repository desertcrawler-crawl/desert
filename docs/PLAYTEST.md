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

## 3. Always online (later)

Render's free web service and Oracle Cloud's Always Free virtual machines can both run `pnpm start`. Free tiers sleep or restart, which wipes sessions; that is fine for testing. Check each provider's current free-tier terms before signing up, as they change often.
