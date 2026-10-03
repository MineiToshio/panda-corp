---
id: BL-0219
type: bug
area: build-engine
title: "usage-rollup excludes cache-creation cost from cost_usd_total, under-reporting a run by ~20-25% (A-1: ≈23 USD reported vs ≈25-31 USD with cache writes)"
status: done
severity: p2
opened: 2026-10-01
closed: 2026-10-03
source: "pandacorp-bench-form benchmark 2026-10-01 audit of run A-1 (runs/A-1/*.rollup.json)"
closes: "plugin/docs/decision-log.md Unreleased (bench follow-ups) BL-0219; factory/standards/build-orchestration.md rollup section; usage-rollup.mjs cost_usd_excl_cache_write"
links: [BL-0156, BL-0181]
---

## Problem
plugin/scripts/usage-rollup.mjs counts cache_creation_input_tokens but leaves them out of cost_usd (comment near the
PRICING table: cache-write pricing not in the audited table). In the benchmark's run A-1 the rollup total was ≈23 USD,
while pricing cache writes at 1.25× input gives ≈25 USD (orchestrator recomputation) to ≈31 USD (auditor
recomputation). Every speed/cost canary since BL-0181 compares numbers that omit a large, model-dependent term.

## Evidence update (2026-10-01, same day)
The headless CLI's own `total_cost_usd` for two pure-vanilla runs (bench B-3/B-4, `runs/B-*/stream.jsonl` result events)
back-solves to cache writes priced at **2× input** — Claude Code uses the 1-hour TTL (`ephemeral_1h_input_tokens`), not
the 5-minute 1.25× tier: B-4 (sonnet-5-5, in 24 / out 17,215 / cacheRead 708,699 / cacheWrite 79,366) = 0.631 USD exactly
at $2/$10/$0.20 + 2× write. B-3 (in 64 / out 33,904 / cacheRead 2,901,821 / cacheWrite 130,927) = 2.165 USD, which matches
only $3/$15/$0.30 + 2× write — a higher (likely long-context) tier, NOT VERIFIED. With 2× writes the bench A-1 run is
≈29.8 USD (vs the rollup's ≈23).

## Fix plan
Add a verified cache-write rate per family (5-minute and 1-hour TTL tiers from the pricing page) and include it in
cost_usd; keep the old figure as `cost_usd_excl_cache_write` for comparability with past canaries.

## Tests (prove the fix — TDD, RED → GREEN)
Fixture transcript with known cache_creation tokens → cost_usd includes them; the excl field equals today's value.

## Done when
Test green; decision-log entry noting the comparability break with earlier canaries.
