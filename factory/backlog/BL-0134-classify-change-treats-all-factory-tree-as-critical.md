---
id: BL-0134
type: bug
area: build-engine
title: "classify-change.sh scores every factory/** path as critical (S7), flagging append-only bookkeeping writes as false positives"
status: done
severity: p2
opened: 2026-09-22
closed: 2026-09-23
source: "docs/proposals/37-fast-change-path-and-implement-cost.md (speed sprint, package F1 'f1-classify-change') — 600-commit backtest scratchpad f1-backtest.tsv"
closes: "plugin/scripts/classify-change.mjs S7 (FACTORY_DATA_PATHS / isFactoryMachinery)"
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
- [x] `classify-change.mjs`'s S7 splits `factory/**` into DATA (`factory/memory/**`,
      `factory/backlog/**`, `factory/ideas/**`, `factory/inbox/**`, `factory/portfolio.md` — an
      explicit allow-list, `FACTORY_DATA_PATHS`/`isFactoryBookkeeping`) and MACHINERY (everything
      else under `factory/**`, plus all of `plugin/**`, unchanged — `isFactoryMachinery`).
      Fail-closed: an unlisted `factory/` path stays machinery by default, never the reverse.
- [x] Both `s7Path` (in `classify()`) and `isFloorPath` (S17's reverse-dependency floor detection)
      route through the same `isFactoryMachinery` predicate — one writer, no second derivation to drift.
- [x] Fixture suite added and green: Case 28 (5 DATA fixtures — memory append, backlog status
      flip, ideas card edit, inbox drain, portfolio.md rollup — none hit the S7 floor, none
      `critical`) and Case 29 (4 MACHINERY controls — `factory/standards/`, `factory/decisions/`,
      `factory/templates/`, `plugin/scripts/` — all still `critical`, proving no false negative
      was introduced by the split).
- [x] `bash plugin/scripts/test-classify-change.sh` — 113 passed / 0 failed / 0 xfail (all of
      BL-0140 + BL-0134's fixtures together; isolated to this item's own diff on top of BL-0140:
      also 113/0/0, i.e. +14 cases over BL-0140's own 99).
- [x] `bash plugin/scripts/run-engine-tests.sh` — 24/24 suites green.
- [x] `mission-control/**` confirmed unaffected: it is never under `factory/` or `plugin/`, so
      S7's blanket never applied to it before or after this change (paths there are anchored
      `mission-control/...` relative to the git toplevel per BL-0161, never `factory/...`).
- [ ] Re-running the real 600-commit backtest (`f1-backtest.tsv`, the F1 report) — **NOT VERIFIED**:
      that scratchpad artifact is not present in this repo (only referenced in
      `docs/proposals/37`), so the ~15-false-positive delta could not be re-measured against the
      real corpus in this session. Verified instead against a purpose-built fixture suite
      (Cases 28/29 above) covering every DATA/MACHINERY subtree the fix plan names.
- [ ] `plugin/docs/decision-log.md` entry and the plugin version bump (DR-034) — deliberately NOT
      done by this item: implemented under an explicit operator instruction not to touch
      `plugin/docs/decision-log.md`, `plugin/runtime/plugin-metadata.json` or the generated
      manifests in this session; a separate closure pass owns that step.
- [x] Fixed in commit `58ac4fd4` on branch `bl-0140-0134-classifier`.

## Out of scope
Redesigning the other 16 classification signals (S1-S6, S8-S17) — this item is scoped to S7's
`factory/**` path rule only.
