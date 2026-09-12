# SMARTZ Syndicate Flywheel — Earn + Promote Master Plan

As of 2026-09-11 · integrates: trading system, AltQuick→SOL loop, Just-Dice invest,
Telegram growth plan, smc.kimi.page, JD chat, Moltbook, memory web.

## The core insight

We have two loops that each make the other stronger:
- **Earn loop:** books → profits → BTC → SOL → live desk → (reverse) → CLAM → invest
- **Promote loop:** receipts → content → members → attention → deposits/volume → bigger books

The flywheel: **every earn-loop event is promotion content, and every promotion win feeds the earn loop.** One ledger feeds both.

## The flywheel

```
                    ┌──────────────────────────────────────────────┐
                    │                                              │
                    ▼                                              │
   ┌────────────────────────┐      daily receipts      ┌───────────┴────────┐
   │  EARN LOOP (agent-run) │ ───────────────────────► │  PROMOTE LOOP      │
   │  CLAM/DOGE books       │  desk logs, fills,       │  TG channel        │
   │  → BTC → SOL → desk    │  investor yield, gates   │  smc.kimi.page     │
   │  → JD invest → yield   │                          │  JD chat (brucie)  │
   └───────────┬────────────┘                          │  Moltbook (zoran)  │
               │ BTC skim / SOL sweeps                 └───────────┬────────┘
               ▼                                                    │ members,
        member-visible treasury                             deposits, referrals
        (honest, weekly)                                            ▼
               │                              ┌────────────────────────────┐
               └───────────────────────────── │  AltQuick volume + JD      │
                  bigger books, more trades   │  bankroll growth = faster  │
                                              │  loop for EVERYONE holding │
                                              └────────────────────────────┘
```

## Layer 1 — Make every earn event publishable (automation, no extra work)

One ledger (`loop_ledger.jsonl`) is the single source of truth. From it, auto-generate:
1. **Daily desk line** (TG): cycles, signals, fills, SOL/USDC level, watchlist gate status.
2. **Weekly treasury report** (TG + site): CLAM invested + JD yield, BTC skimmed, SOL accumulated, desk P&L. The "receipts" post — the most forwardable content we have.
3. **Gate-watching content** (occasional): "SMRT liquidity $165 vs $500 gate — here's what happens when it clears" turns our own constraint into a story and sets up the future launch honestly.

## Layer 2 — Promotion converts attention into loop fuel

1. **TG → deposits:** the channel's CTA is not "buy our token" (they're dormant) — it's "watch the agent work, bring your DOGE/CLAM to the books we trade." Every active member with coins is potential volume.
2. **Referral links with receipts:** AltQuick/Trojan referral links live on smc.kimi.page (not spammed in chat). TG posts that mention tools include the site link, so referrals compound quietly.
3. **The site as the hub:** stats strip (live SMRT/SMF from Dexscreener), treasury widget (weekly numbers from the ledger), TG join panel. One URL to rule all promotion.
4. **Cross-channel seeding:** brucie (JD chat) and zoranmesh (Moltbook) each carry the "agent-run syndicate with public receipts" pitch to two more ponds, linking the site.

## Layer 3 — Reinvestment rules keep the flywheel honest

Unchanged from the sub-plans (they interlock):
- +5 CLAM watermark → 2 CLAM to JD invest (standing).
- Remainder → BTC skim → SOL (limit-only, 0.00125–0.00140 band, ≤0.05 SOL slices).
- SOL sweep to agent wallet at **0.25+ SOL** (0.01 SOL fee each way — confirmed).
- Live desk gated: SMARTZ_LIVE=1 + funded keypair + per-trade approval.
- TG growth: daily receipts, weekly treasury, Friday activation, never bought members, never promised returns.

## What "success" looks like at each stage

| Stage | Signal | What it unlocks |
|---|---|---|
| 1. Loop running | daily receipts post exists, ledger clean | credibility baseline |
| 2. TG active | 10+ regular commenters, forwards > joins | organic reach without ads |
| 3. SOL funded | wallet ≥ 0.25 SOL from loop alone | live desk activated (gated) |
| 4. Live receipts | real swap P&L in weekly report | the story no copycat channel has |
| 5. Token gate clears | SMRT or SMF liquidity ≥ $500 sustained | desk trades our own tokens, live, in public |

## This week's build list (me)
1. `loop_ledger.jsonl` + skim helper in the AltQuick trader (BTC conversion at bid, logged).
2. `receipts.py` — renders the daily desk line + weekly treasury from ledger + trader state (paste-ready for TG).
3. Memory-web node for the fee fact + flywheel plan.

## Your moves (parallel)
- TG structure per the growth plan (title/desc/pins/bot).
- Fund the agent wallet when ready (any SOL amount — the loop will add to it).
- DOGE deposit when ready — it's the accelerant.
