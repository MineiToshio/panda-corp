---
id: BL-0320
type: change
area: build-engine
title: "Quota conserve (<15 % left): reviews stay in the author's company, no deferred cross-company re-review"
status: done
severity: p1
opened: 2026-11-13
closed: 2026-11-13
source: "owner decision 2026-11-13 (option A), funko-tracker run br-2026-11-14-01 with Claude nearly out of quota"
closes: "plugin 10.5.0 — DR-161: quota_conserve 85, conserve availability, on_conserve cells, deferred re-review skipped"
links: [DR-161, DR-152, BUILD-10, BUILD-11]
---

## Problem
With Claude nearly out of quota (but under the 90 % stop), a Codex-labelled build still sent every review of
Codex-authored work to Claude (BUILD-10: the other company reviews), and every degraded review queued a deferred
cross-company re-review. Both spend the scarce company exactly when it should be saved; the owner wanted Claude kept
for its own session.

## Change (DR-161)
`model-tiers.json` `thresholds.quota_conserve: 85`. `quota.policy()` adds `claude_conserve` / `codex_conserve`
(known reading >= 85 % and < quota_stop, 5-hour or weekly; unknown is never conserved). Routing availability gains
`conserve`: the provider still takes units of its own run label, but reviews of the other company's work stay in the
author's company with a different model (Sol/Luna-built -> Astra high, Astra-built -> Sol high, r1 Sol xhigh, via the
`on_conserve` cells of rows 12/13; Claude-built -> the existing quota fallback), `degraded: conserve`, no deferred
entry. `review-record` does not queue a deferred re-review while the company it needs is conserved (output
`deferred_skipped`). Deferred entries are not scheduled while their company is conserved, and the Claude-pinned
security audit waits in the deferred ledger instead of running on a conserved Claude. Landing is never blocked.

## Verification
`test-build-v2-conserve.mjs` (thresholds 84/85/89/90, unknown, availability mapping, Sol/Astra/r1 cells, controls,
symmetry, builds, audit), `test-build-v2-review.mjs` DR-161 cases (red on the previous review.mjs).
