---
id: BL-0134
type: bug
area: build-engine
title: "classify-change.sh scores every factory/** path as critical (S7), flagging append-only bookkeeping writes as false positives"
status: open
severity: p2
opened: 2026-09-22
closed:
source: "docs/proposals/37-fast-change-path-and-implement-cost.md (speed sprint, package F1 'f1-classify-change') — 600-commit backtest scratchpad f1-backtest.tsv"
closes:
links: [DR-069]
---

## Problem
`plugin/scripts/classify-change.sh`'s signal S7 (or its equivalent path-based critical-surface rule)
scores ANY path under `factory/**` as `critical`, with no distinction between the factory's DATA trees
(gitignored-adjacent bookkeeping that is append-only and self-correcting by construction) and its
MACHINERY trees (code/config that actually executes or ships). A 600-commit backtest against the real
history (scratchpad `f1-backtest.tsv`, the F1 report) shows roughly **15 commits** that are pure
bookkeeping appends — `factory/memory/*` lesson harvests, `factory/backlog/*` status/frontmatter edits
(the same class this very change belongs to), `factory/ideas/*` card updates, `factory/inbox/*` drains,
and `factory/portfolio.md` rollups — mis-scored `critical` (S7) when a `low`/`normal` rigor tier would
have been correct and cheaper (fewer gates, no forced full-repo re-verify). This is exactly the kind of
false positive the speed-sprint's rigor-tier classifier (Fase 3 §A.2, "17 señales, sin preguntar al
owner") is supposed to avoid — S7 over-fires specifically on the tree that changes most often.

## Root cause
S7 treats `factory/**` as one undifferentiated surface. In reality the tree has two structurally
different regions (this same split factory/backlog/README.md itself documents for the three-plane
model): **data** subtrees that are appended to by routine harvest/backlog/portfolio jobs and carry no
execution risk if malformed (a bad row degrades one read, never the pipeline), and **machinery**
subtrees (`factory/standards/`, `factory/decisions/`, `factory/templates/`, plus all of `plugin/**`)
that are load-bearing — a bad edit there changes behavior for every future project. One path-prefix rule
can't express that distinction, so it collapses to the conservative (and here, wrong) answer for the
data half.

## Fix plan
1. Split `classify-change.sh`'s `factory/**` handling into two explicit path groups: DATA
   (`factory/memory/**`, `factory/backlog/**`, `factory/ideas/**`, `factory/inbox/**`,
   `factory/portfolio.md`) stays at its otherwise-computed tier (do not force `critical` via S7 alone);
   MACHINERY (`factory/standards/**`, `factory/decisions/**`, `factory/templates/**`, all of `plugin/**`)
   keeps the existing `critical` force.
2. Re-run the 600-commit backtest (`f1-backtest.tsv`'s methodology) against the split rule BEFORE
   shipping it as the default — the backtest is the acceptance gate here, not a one-off sanity check
   (this item's own "Done when" requires the delta, not just the code change).
3. Confirm no machinery-tree commit in the backtest corpus DROPS out of `critical` as a side effect of
   the split (a false negative would be worse than the false positives this fixes).

## Tests (prove the fix — TDD, RED → GREEN)
Extend `classify-change.sh`'s test harness with fixtures for each data subtree (a `factory/memory/`
lesson append, a `factory/backlog/BL-*.md` status flip, a `factory/ideas/*.md` card edit, a
`factory/inbox/*` drain, a `factory/portfolio.md` rollup) asserting NOT-critical, plus control fixtures
for each machinery subtree asserting STILL-critical. RED = today's S7 scores every one of the data
fixtures critical. GREEN = only the machinery fixtures stay critical. Re-run against the real
`f1-backtest.tsv` corpus and confirm the ~15 known false positives clear while the corpus's genuine
machinery-critical commits are unchanged.

## Done when
The data/machinery split ships in `classify-change.sh`; the fixture suite above is green; the backtest
delta (false positives cleared, zero new false negatives) is recorded in `plugin/docs/decision-log.md`
citing the F1 report; plugin version bumped per DR-034.

## Out of scope
Redesigning the other 16 classification signals (S1-S6, S8-S17) — this item is scoped to S7's
`factory/**` path rule only.
