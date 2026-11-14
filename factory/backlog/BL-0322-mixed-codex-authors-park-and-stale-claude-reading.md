---
id: BL-0322
type: bug
area: build-engine
title: "Sol+Astra-authored FRD parks with Claude out; an expired 91 % Claude reading routes reviews back to Claude"
status: done
severity: p0
opened: 2026-11-13
closed: 2026-11-13
source: "funko-tracker run br-2026-11-14-01 on plugin 10.6.0 (epochs 31-32)"
closes: "plugin 10.7.0 — strongest-author cell for an all-Codex mixed diff; sticky Claude reading >= 85 % until resets_at"
links: [DR-161, BL-0321, BUILD-10, BUILD-11]
---

## Problem
1. The FRD re-review after a reopen covers the build (Sol) and the patch (Astra). With Claude out, Sol-authored lines
   route to Astra and Astra-authored lines to Sol; each candidate authored part of the diff, so the mixed-author rule
   parked the review `no_reviewer` and the run stopped `no_progress`.
2. The Claude reading older than 10 min became `unknown`, which counts as available, so the same review was first
   dispatched to Claude opus xhigh although the last known reading was 91 % weekly.

## Fix
`reviewCell`: when no mixed-author candidate is clean, all authors are one company and the other is conserved or out,
use the cell of the strongest author (Astra → Sol), `degraded: same_model`, no deferred, never parked; unreachable still
parks. `quota.effective`: a stale Claude window at or above `quota_conserve` with a future `resets_at` stays known.

## Verification
`test-build-v2-conserve.mjs` BL-0322 cases (both author orders, quota/conserve/unreachable/ok, sticky reading with
future/past/missing reset and below 85 %); all `test-build-v2-*` suites.
