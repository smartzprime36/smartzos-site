# HIVE.md — SMARTZ shared brain protocol

The hive mind has three layers. Every agent (kimi, grok, any future AI) uses all three; each layer has one job.

## Layer 1 — Palace (semantic memory, machine-recall)

- Local MemPalace palace, wing `10_00_16_bd4d4a81` (lives in the ops workspace, 39+ drawers).
- **Recall before builds:** search the palace about past work, decisions, people, or projects before answering or planning. Quote results verbatim; if the palace has nothing, say so — don't guess.
- **File durable outcomes** (decisions, conclusions, learned facts, receipts) — the nightly "Hive Mind Sync" automation mines changed `smartz-*.md` / `token-usecases-*` / `eco*` / `SYSTEM-STATE.md` docs automatically. For one-off facts, mine the file directly (`mempalace mine <file>`) or file a drawer.
- Never file secrets, tokens, or key material.

## Layer 2 — Logstream (coordination bus, agent-to-agent)

- Stream `project/smartz`, room `hive`. CLI: `mempalace logstream append/list/ack`.
- **Identity:** always pass `--from-agent <you>`. Your identity is your signature.
- **Cursor discipline:** track your last processed event **id** (`since_event_id`), never timestamps — events are append-ordered and a peer's event can arrive "older" than a timestamp cursor.
- **Inbox ritual:** list events `to_agent=<you>` (or `*`) at session start. Ack with `logstream ack`.
- **Delegating:** `task.request` with goal + branch + base commit + definition of done + `correlation_id`; wait on the correlation_id for the reply. Claim with `status=claimed`, deliver as patch + reply; blocked → reply `status=blocked` with verbatim notes. Never claim a task and go silent.
- First event: `evt_20260928T175258_e0204a86de8a` (kimi, hive-online).

## Layer 3 — NOTES.md (chronological, human-visible)

- One dated entry per session, newest at top: what changed, what was checked, what's next. This is what the owner reads and what the watch automation monitors — a new commit here pings the owner.

## Cloud functions (Supabase)

- `mesh-bot` — write-only beacon, accepts the desk shared key (`x-desk-key`), fire-and-forget. Use for liveness pings, not data.
- `palace-io` / `embed-cubes` / `arena` — 401 on shared key; sources not in the ops workspace. Cloud semantic memory is parked until someone recovers or rebuilds these.

## Rendering your own rules

`mempalace rules --agent <you>` outputs the canonical shared-brain block for your system prompt. Run it once when you join; the canonical source is the MemPalace repo's `integrations/shared/coordination-protocol.md`.
