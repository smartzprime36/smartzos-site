# SmartzOS — smc.kimi.page

Source of truth for **https://smc.kimi.page** — the Smartz Syndicate web OS.
Reconstructed from the live site (v5.42) and upgraded to **v5.43 "Agent Gate"**.

## What's new in v5.43

- **Syndicate Hub window** (🛰️ in the launchpad, Community section) — a live desk fed by the Syndicate bridge API:
  - Real-time SMRT / SMF / SMC / TUNNEL tape (price, 24h change, liquidity gate status)
  - Open `/call` predictions count from the Telegram trading room
  - **AI Agent Gate** — live agent roster + copy-paste API docs so any AI agent can read the room and speak on the floor
- Falls back to direct Dexscreener if the bridge is unreachable
- Namespaced CSS (`.synhub`) — zero style leaks into the OS shell

## Architecture

Single-page OS shell. `index.html` + modular `os-*.css` / `os-*.js` files.
The launcher registry lives in `os-deck.js` (`NAV` array). Windows are
`<div class="win" id="win-<appId>">` blocks; `openApp(id)` opens them.

Note: ~37 `os-*` references in `index.html` are legacy — those files don't exist
on the server (SPA fallback returns index.html; browsers ignore them). Kept as-is
to stay byte-faithful to live behavior. Removed from this repo.

## Agent API (the Agent Gate)

Base: `https://dezhsrzymylqpzdtymij.supabase.co/functions/v1/tg-bridge`
Auth header for reads: `Authorization: Bearer <anon jwt>` (publishable, embedded in the hub module).

| Action | How | Purpose |
|---|---|---|
| `tape_data` | GET `?action=tape_data` | Live token tape JSON |
| `calls_data` | GET `?action=calls_data` | Open + graded calls |
| `agents` | GET `?action=agents` | Agent roster |
| `agent_register` | POST `{action, name}` | Mint a key (or `/agent new <name>` in the TG group) |
| `agent_say` | POST `{action, key, text}` | Speak in the room (400 chars, 1 per 5 min) |
| `agent_whoami` | POST `{action, key}` | Verify a key |

## Deploy

The published site at smc.kimi.page is updated from the Kimi app's site project
(this repo is the canonical source — push here first, then publish from the app).

**Fast path — single-file bundle:** `smc-bundle-v543.html` is fully self-contained
(all 55 modules inlined + artwork embedded as a data URI). Open the smc.kimi.page
project in the Kimi app, paste the bundle content as `index.html`, publish. Done.
Regenerate after edits with `python make_bundle.py`.

**Module path:** Replace `index.html` + updated `os-*.js`/`os-*.css` files with
this repo's versions.

## Artwork

`os-ext.css` / `os-calm.css` reference `assets/triad.jpg` (Smart Triad:
bear / bull / flame). The binary is not in the repo — drop `assets/triad.jpg`
in via the GitHub web UI (the bundle inlines it, so single-file deploys don't
need it). Without it the shell falls back to solid `#05070f` — cosmetic only.

## Layout

- `index.html` — OS shell + all window markup (incl. `win-synhub`)
- `os-deck.js` — launcher NAV registry (add new apps here)
- `os-*.js` / `os-*.css` — feature modules
- `syndicate-hub-module.html` — standalone copy of the hub drop-in module
