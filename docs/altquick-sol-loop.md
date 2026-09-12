# AltQuick → SOL Full-Loop Plan (SMARTZ Syndicate)

As of 2026-09-11 ~10:20 UTC · verified live against AltQuick public API this session.

## Market facts (verified 2026-09-11)

| Market | Top bid | Top ask | Book depth | 24h vol |
|---|---|---|---|---|
| BTC_CLAM | 98 sat | 104 sat | deep on bids, our trader sells @106 | ~32 CLAM |
| BTC_DOGE | 112 sat | 120 sat | deep both sides (thousands of DOGE) | 0 |
| BTC_SOL | 0.00125001 | 0.00139999 | THIN: ~1.7 SOL within 15% of ask | 0 |

Key consequences:
- **BTC is the hub.** Every pair on AltQuick quotes against BTC. The loop's internal currency is BTC, not USD.
- **BTC_SOL is thin — limit orders only, small slices.** A market buy of even 0.2 SOL would walk the book into 0.005+ BTC prices (4x overpay). Sane liquidity zone: 0.00125–0.00140 BTC/SOL.
- **BTC_DOGE is the real trading book** for the DOGE deposit once it lands — depth for thousands of DOGE on both sides.

## The loop

```
        (your deposits)
        DOGE ───────────────┐
                            ▼
                    ┌───────────────┐   profits skimmed in BTC
                    │ AltQuick desk │──────────────────────┐
                    │ DOGE/BTC book │                      │
                    │ CLAM book     │                      ▼
                    └───────┬───────┘              ┌─────────────┐
                            │ CLAM                   │ BTC balance │
                    +5 CLAM watermark                │  (accumulate)│
                            │                        └──────┬──────┘
                            ▼                               │ threshold:
                    2 CLAM → Just-Dice invest        0.02+ BTC_SOL limit buy
                    (existing rule, unchanged)            ▼
                                                  SOL balance on AltQuick
                                                         │ threshold: 0.1 SOL
                                                         ▼
                                            WITHDRAW → agent wallet
                                            GK7fhXzphJ4PpV6bHAiTRFNpXt7ZTZ5cM2Zw8ZUQ6Ueu
                                                         │
                                            live Solana desk (smartz_trader,
                                            gated: SMARTZ_LIVE=1 + your approval)
                                                         │ live profits
                                                         ▼
                                            reverse path later: SOL → AltQuick
                                            deposit → BTC → CLAM → invest
```

## Rules (layered on top of the existing CLAM rules — those do not change)

1. **Skim, don't churn.** Principal stays working in the CLAM/DOGE books. Only realized profit converts to BTC. Skim ratio: of each +5 CLAM profit unit, after the standing 2 CLAM → Just-Dice invest, convert the remainder (3 CLAM-equivalent) to BTC at the standing bid (market/limit at 98 sat, never below).
2. **BTC → SOL only by limit order** inside the 0.00125–0.00140 band, slices ≤ 0.05 SOL, max one open SOL buy at a time. If the band breaks (price leaves the band for 24h), pause and reassess — a thin book repricing usually means something changed.
3. **Fund the agent wallet at 0.25+ SOL accumulated** (updated for the confirmed 0.01 SOL withdraw fee — withdrawing at 0.1 SOL would burn 10% in fees; at 0.25 SOL the fee is 4%, at 0.5 SOL it's 2%). Withdraw SOL from AltQuick to `GK7fhXzphJ4PpV6bHAiTRFNpXt7ZTZ5cM2Zw8ZUQ6Ueu`. Confirmed 2026-09-11: AltQuick SOL deposit AND withdraw fee = 0.01 SOL flat.
4. **Live Solana trading stays gated** as built: `SMARTZ_LIVE=1` + keypair funded + your explicit per-trade approval. The loop feeds the wallet; it does not auto-enable live mode.
5. **Reverse path (later, when live profits exist):** SOL profit → AltQuick SOL deposit → sell via BTC_SOL limit at the bid → BTC → CLAM at the ask → Just-Dice invest. This closes the circle fully on-chain/off-ramp free.
6. **Ledger everything.** Every conversion logged to `smartz_trades.jsonl`-style records (time, market, price, qty, running BTC/SOL totals) and mirrored into the memory web monthly.

## Realistic pacing (honest math)

- CLAM book profits: ~1–3 CLAM/day when the book trades (historical).
- 3 CLAM ≈ 300 sat ≈ 0.000003 BTC ≈ 0.0024 SOL at 0.00125. So the wallet funds at 0.1 SOL after roughly **40 profit-units** — weeks, not days, at current book activity.
- Lever that speeds it up: your planned DOGE deposits. DOGE book depth means the DOGE→BTC leg can generate BTC far faster than CLAM skim alone. Treat DOGE as the accelerant, CLAM as the steady drip.
- Fee-aware pacing: with the 0.01 SOL withdraw fee, the first wallet funding happens at 0.25 SOL accumulated (4% fee). Reverse-path deposits also cost 0.01 SOL, so the return leg batches too — sweep SOL profits back monthly, not per-trade.
- Nothing here justifies forcing size. The thin SOL book punishes impatience.

## Action list

1. Me: add a `loop_ledger.jsonl` writer + `skim` helper into the existing AltQuick trader module (convert profit CLAM → BTC at bid, log it).
2. ~~You (once): verify SOL withdraw min/fee on AltQuick's withdraw page.~~ DONE 2026-09-11 — fee confirmed 0.01 SOL flat, deposits and withdrawals.
3. When DOGE lands: trade it per the existing rules; skim per rule 1.
4. At 0.1 SOL: I prepare the withdrawal plan (address + amount + fee) for your one-click confirm.

## Risks

- **Thin SOL book** — rule 2 exists because of it. Never market-buy SOL there.
- **Counterparty risk** — balances on AltQuick are custodial; keep only working capital there, sweep SOL out at the 0.1 threshold.
- **Token-stall risk** — if CLAM/DOGE books go quiet, the loop drips slower; nothing to do but wait, do not widen bands to force trades.
