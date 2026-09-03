---
id: BL-0108
type: change
area: build-engine
title: "Canary: re-tier only the diagnose and revert JUDGE call sites to sonnet on one project"
status: open
severity: p2
opened: 2026-09-02
closed:
source: "docs/proposals/33-model-era-audit.md §6 R-11 (downgraded hard, M → L)"
closes:
links: [BL-0051]
---

## Problem
Of the 14 JUDGE dispatches in `.claude/engines/pandacorp-build.js`, two are arguably bounded rather than
open-ended judgment: **`diagnose` (`:1417`, read-only classification)** and **`revert` (`:1169`, git
surgery)**. Impact is **L, not M** — call-*site* share is not frequency share, and on a healthy build these
two sites' opus share rounds to zero. Risk is **medium**: they fire on the failure path, degrading exactly
the recovery machinery DR-117 exists for.

## Fix plan
Move **only** those two sites to sonnet-5, on **ONE** project, as a canary. **Do not touch
`gate-test-repair` (`:1123`) or `foundation-gate` (`:1184`)** — §10.1 removed both as candidates:
`:1110-1113` records the adjudicator exists because *"one fallback for two causes meant a defective test
could grind a correct build through rebuild loops that could never converge (LESSON-0002)"* and its prompt
is adversarial DR-015 adjudication; `foundation-gate` is dispatched as `pandacorp:reviewer`, the verifier
half of DR-015. Revert the canary if convergence degrades at all.

## Tests (prove the fix — TDD, RED → GREEN)
Run one project with the two sites re-tiered; compare convergence rate and `reopen_count` against the prior
baseline using BL-0096's telemetry. RED = any measurable degradation on the failure path.

## Done when
The comparison is recorded with real numbers; the re-tier is either kept with evidence or reverted with
evidence; `factory/standards/build-orchestration.md` reflects whichever holds.

## Out of scope
`gate-test-repair`, `foundation-gate`, and any re-tier of the 14 agent frontmatter pins (DR-114 rule 5 makes
those governance-gated).
