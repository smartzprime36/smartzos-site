# HIVE.md — SMARTZ shared brain protocol (current)

> **Rewritten 2026-10-05 by Zoran-mini.** This replaces the Kimi-era protocol below it (local MemPalace + `mempalace logstream`), which described infrastructure that no longer exists. The old text is preserved at the bottom as history — do not build to it.

## The team

| Worker | Role | DB access | How they sync |
|---|---|---|---|
| smartz | Founder — final approval on everything public, risky, or money | n/a (human) | chat |
| grok | Builder — site, bot, tg-bridge, deploys, migrations | yes | `agent_messages` bus |
| claude | Review — audits, math checks, spec review | no | Google Drive |
| gemini | Drafts — plans, specs, copy | no | Google Drive |
| zoran-mini | Coordinator — roster, handoffs, relay, weekly status | yes | both (router) |

Roster mirror: the `hive_workers` table in Supabase (one row per worker).

## The two surfaces

**Surface 1 — `agent_messages`: the message bus** (Supabase). For workers with DB access (grok, zoran-mini, future DB workers). Real-time channel.

- **recipient**: a worker name or `all` for broadcast. Never blank.
- **kind** vocabulary: `task` (do this, then report) · `question` (reply with `kind=answer`) · `answer` (set `reply_to`) · `fyi` · `blocker` (urgent, coordinator triages) · `alert` (outages, compliance — sparingly) · `note` · `status` (heartbeat).
- **status lifecycle**: `new` → `ack` → `done`. A `blocker` never quietly goes `done` — the resolution gets an `answer` first.
- **Reply SLA**: ack `question`/`task` within 24h.
- ⚠️ Known limitation (2026-10-05): a CHECK constraint hardwires the table to `sender='grok' AND recipient='kimi'`. Until Grok relaxes it to the roster, the bus is read-mostly for everyone else and the coordinator relays via Drive + chat.

**Surface 2 — Google Drive** (shared "Smartz Syndicate Workspace"). For workers without DB access (claude, gemini). Working note + `04 Handoffs` folder hold questions, drafts, and handoffs.

**Zoran-mini is the router.** Nobody else straddles both surfaces. The daily coordinator sweep reads both, cross-posts what matters, nudges anything unacked past 24h, and posts the weekly team status.

## Memory

- **Semantic memory**: Supabase pgvector memory cubes (1,151 as of Oct 2026; design doc: `smartz-syndicate/Documents/MEMORY_PALACE_BLUEPRINT.md`).
- **Decisions**: logged the same day as `agent_messages` notes (recipient=`all`, kind=`note`): decided by / decided / why / ref.
- **Never** file secrets, tokens, or key material anywhere in the hive.

## Compliance spine (non-negotiable, everywhere)

No price talk · no yield/APY/profit language · no buy/sell calls · 18+ where tokens appear · KP has no cash value · never request seed phrases or private keys · no gambling.

---

## HISTORY — Kimi-era protocol (retired, do not use)

*The hive mind has three layers… [original text preserved below for archaeology]*

Layer 1 was the Palace (local MemPalace palace, wing `10_00_16_bd4d4a81`), Layer 2 the Logstream (`mempalace logstream append/list/ack`, stream `project/smartz`), Layer 3 the NOTES.md chronological log. This described the Zo Computer-era local infrastructure (localhost:7071, Ollama `zoran-hive` model). That infrastructure no longer exists in that form. The Supabase bus + Drive surfaces above are the current protocol.
