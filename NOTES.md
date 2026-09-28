# NOTES.md — running sync log (newest at top)

---

## 2026-09-28 — Kimi: backend source sync + baseline

- Synced live backend sources into repo for the first time: `edge-functions/tg-desk.ts` ← `tg-desk_index.ts` (desk **v56 Genesis Drop**, shipped Sep 17) and `edge-functions/tg-bridge.ts` ← `tg_bridge_index.ts` (bridge webhook mode, polling dormant).
- **Growth baseline after 11 quiet days (Sep 17 → Sep 28):** flat. `faucet_grants` = 0, `checkin_log` = 1 claim (Sep 14), treasury = 489,000 SMC, P2P wallets = 6. Main group grew only +10 organic (179 → 189). Diagnosis: the faucet exists but the funnel pump (promo-group value posts, X cadence) hasn't been running — acquisition is the bottleneck, not product.
- Added this file and `AGENTS.md` as the Grok collaboration contract.
- Pending: desk **v57 "No Spam" throttle** (per-destination outbound caps: 6/day + 2/rolling-hour, state key `outbound_log`) — designed, not yet coded. Full plan in the workspace (`smartz-update-plan.md`).
- Open issues #3–#6 are the Grok backlog candidates (README rewrite, i18n, dashboard, Birdeye, ideas, v14 review).

- Grok onboarding issue opened: #8 'start here' — points to AGENTS.md + this file. A watch automation pings the owner on every new commit touching NOTES.md, so Grok's first entry gets noticed.
## 2026-09-28 ~14:00 — Kimi: hive mind online

- **HIVE.md published** (repo root) — the shared-brain protocol: palace semantic memory / logstream coordination bus / NOTES.md chronological layer. AGENTS.md now points to it.
- **Logstream LIVE**: first event `evt_20260928T175258_e0204a86de8a` (kimi, hive-online, to `*`) on stream `project/smartz`, room `hive`. Grok: list the room to see it; `mempalace rules --agent grok` renders your rules block.
- **Hive Mind Sync automation** (`automation_a5e2b6b4`) — nightly 03:37 ET: mines changed plan/ledger docs into the palace (first run mined 10 docs), posts heartbeat, refreshes `hive/wake-up.md`. Verified end-to-end.
- Embedding model cache was missing (Sep 13 cleanup) — re-downloaded, palace search recall verified working.
- Cloud mesh-bot = write-only beacon (desk key). palace-io/embed-cubes/arena still 401 — parked.

*(Grok: append your entries below, newest at top, same format.)*
