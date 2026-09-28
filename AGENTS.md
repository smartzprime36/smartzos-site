# AGENTS.md — SMARTZ Syndicate collaboration contract

This repo is the shared hub between **Kimi** (desk/bridge backend, treasury ops) and **Grok** (site / Mini App UX, content). Read this before touching anything.

## Division of labor

| Area | Owner | Notes |
|---|---|---|
| `edge-functions/tg-desk.ts` | **Kimi** | Live desk backend (v56 as of this sync). Grok: read freely, propose changes via issues/PRs — do not commit directly. |
| `edge-functions/tg-bridge.ts` | **Kimi** | Telegram webhook bridge. Same rule as desk. |
| `index.html`, `desk-app*.html`, `os-*.css/js`, `smc-bundle*` | **Grok** (+ owner site pipeline) | Fetch what's actually served before patching; repo copies may lag the live site. |
| `docs/` | Shared | Loop/flywheel/growth specs. Update with dated entries. |

## Hard rules

1. **Never commit secrets.** Bot tokens, API keys, and wallet material live in local-only files (e.g. `tg_secrets.json`) and are injected at deploy time. If you find a secret in a file, flag it in NOTES.md immediately — don't push it.
2. **Desk version bumps require TWO edits** — the header comment AND the `fn:` string in the GET ping handler. Forgetting the second one has caused false "old version" alarms twice.
3. **Deploy command (Kimi only):** `python sb_deploy.py tg-desk tg-desk_index.ts false` — the trailing `false` (verify_jwt=false) is non-negotiable; the Telegram webhook can't send an auth header.
4. **Live state reads:** via the desk helper (`from desk_halt import sql`) or Supabase SQL. Treasury, faucet, check-in, and P2P tables are the source of truth — never infer user balances from chat logs.
5. **Anti-spam directive (owner):** no automated mass-posting to Telegram groups, channels, or X. All outbound drops are capped and logged. When in doubt, draft — don't send.

## Hive mind (shared brain)

Three layers, full protocol in **[HIVE.md](HIVE.md)**: palace (semantic memory — recall before builds, file durable outcomes), logstream (agent-to-agent coordination on stream `project/smartz`, room `hive` — identity + cursor discipline), NOTES.md (this file's sibling — chronological, human-visible). `mempalace rules --agent <you>` renders your own rules block when you join.

## Sync protocol

- Backend source-of-truth files on Kimi's side: `tg-desk_index.ts`, `tg_bridge_index.ts` (note the underscore). Repo copies are synced when one side asks — always say so in NOTES.md.
- Grok appends to `NOTES.md` with dated entries: what changed, what was checked, what's next.
- Non-trivial cross-cutting changes → open an issue, reference it in NOTES.md.
