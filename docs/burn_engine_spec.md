# Burn Engine — $SMRT/$SMF Buyback-and-Burn Module Spec

Status: SPEC (not live) · drafted 2026-09-11 · reviewed against real liquidity

## Purpose
Close the loop between the earn loop and token utility: a fixed share of loop
profits is used to buy SMRT/SMF from the open market and burn what it buys,
with every transaction hash logged into the weekly treasury report.

## Funding rule
- **Source:** 10% of every SOL sweep (the amount that leaves AltQuick for the
  agent wallet), not of trading principal. Skim → SOL accumulates → sweep →
  10% of the swept SOL goes to the burn budget.
- **Accumulation:** burn budget accrues in the ledger (`burn_budget_sol` in
  loop_ledger.jsonl events of type `burn_accrual`) until it crosses the
  execution floor (below).

## Hard constraints (these are not optional)

1. **Price impact cap: max 1% per execution.** SMRT liquidity is ~$165 and SMF
   ~$83 (verified 2026-09-11). At those depths even a $0.50 buy moves the
   price visibly. Every execution gets a live Jupiter quote first; if quoted
   impact > 1%, the execution is split into smaller slices across cycles or
   deferred. No exceptions — a visible self-buy that wrecks the chart is
   worse than no buy.
2. **Liquidity gate:** if token liquidity < $500 (the desk's existing gate),
   executions are capped at $1 USD-equivalent per slice and at most one slice
   per day per token. Above $500, the cap scales to 0.5% of pool liquidity
   per day.
3. **Real open-market buys only.** The burn wallet buys through Jupiter like
   any other taker. No paired sell, no self-trading, no wash structure. The
   buy and the burn are both public on-chain and we publish the hashes.
4. **Burn is real:** bought tokens go to the canonical Solana burn address
   (`1nc1nerator11111111111111111111111111111111`). No "sent to treasury"
   substitutes.
5. **Human confirmation per execution.** The module prepares the plan (token,
   size, quoted impact, expected hash trail); a human approves before
  broadcast. Automation prepares, human signs — same rule as live desk trades.

## Execution flow

```
sweep happens (human-approved)
  └─> accrue 10% of swept SOL -> burn_budget_sol (ledger event)
        └─> each desk cycle, if budget >= floor:
              quote SOL->SMRT and SOL->SMF (Jupiter, live)
              if impact <= 1%: prepare plan -> await human confirm -> execute
                -> log {type:"burn_exec", token, sol_spent, tokens_bought,
                        buy_sig, burn_sig, post_liquidity}
              else: defer, log {type:"burn_deferred", reason:"impact"}
weekly report reads burn_exec events -> prints hashes + running burned totals
```

## Floor
Execution floor: **0.05 SOL** budget (≈$5 at current prices — roughly one
$1-slice per day for 5 days at current liquidity). Below the floor the budget
keeps accruing. The floor re-checks automatically as liquidity grows.

## Reporting
- Every `burn_exec` appears in the weekly treasury report: token, SOL spent,
  tokens bought, buy tx hash, burn tx hash, tokens burned all-time.
- Monthly: one TG post "Burn Receipt" with the cumulative hashes. Burning is
  promotion when the receipts are public.

## Anti-inflation honesty
This module creates real buy pressure but at current scale it is symbolic
(dollars per week, not hundreds). The report must present it as what it is:
proof-of-intent with public hashes, not a supply shock. Overclaiming burn
mechanics is how projects lose rooms.

## Open dependency
Executions need the live path (funded agent wallet + SMARTZ_LIVE=1). Until the
wallet is funded the module runs in **accrual-only mode**: budgets build,
plans are drafted, nothing broadcasts. That is by design.
