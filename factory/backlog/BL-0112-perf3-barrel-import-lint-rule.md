---
id: BL-0112
type: change
area: standards
title: "Wire PERF-3 — the last aspirational SHOULD — as a Biome/import-graph rule for barrel imports in hot paths"
status: open
severity: p2
opened: 2026-09-02
closed:
source: "docs/proposals/33-model-era-audit.md §6 R-42"
closes:
links: []
---

## Problem
`factory/standards/rule-registry.md:69` marks `PERF-3` `review-only | aspirational` — the sole surviving
aspirational SHOULD in a 137-rule registry — and `:157` self-diagnoses the fix: *"candidate for a future
lint pass"*. Impact: L on its own, but it is the registry's own named loose end, and it is mechanically
checkable.

## Fix plan
Add a Biome (or import-graph) rule flagging barrel imports in hot paths, wire it into the stack templates'
lint config so violations are caught by `verify.sh`, and flip `PERF-3`'s registry row from `aspirational` to
`wired`. Bump `plugin/templates/OVERLAY_VERSION` so `/pandacorp:upgrade` carries it into existing projects
(DR-051 — a standard that is not injected is dead on arrival).

## Tests (prove the fix — TDD, RED → GREEN)
The lint rule fires on a seeded barrel import in a hot path and stays silent on a legitimate one;
`check-standards.sh` shows zero aspirational rows afterwards.

## Done when
`PERF-3` is `wired` in the registry with a real checker behind it; `OVERLAY_VERSION` bumped; plugin version
bumped; `factory/decision-log.md` noted.

## Out of scope
Introducing it as a `MUST` — new MUSTs that could break in-flight projects start as SHOULD/warning
(`learn`'s own rule).
