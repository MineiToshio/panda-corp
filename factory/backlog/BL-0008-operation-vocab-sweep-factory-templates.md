---
id: BL-0008
type: bug
area: templates
title: "Old `operation` lifecycle vocabulary still in factory templates (DR-085 removed the phase)"
status: done
severity: p1
opened: 2026-06-30
closed: 2026-07-03
source: "docs/proposals/19-factory-flow-audit-2026-06-30.md (P0 — Lifecycle Vocabulary Drift: operation)"
closes: "verified the operation-vocab sweep was already clean (0fc6e22, 2026-06-30) via scoped grep across plugin/templates/ + factory/standards/ (excluding decision logs); added the missing doc-lint reintroduction guard (plugin/templates/shared/.pandacorp/doc-lint.sh) that flags phase: operation or operation in the pipeline enum outside decision-log/reviews, proved RED->GREEN with fixtures; OVERLAY 8.58.0->8.59.0, plugin v9.52.1->v9.53.0"
links: [DR-085]
---

## Problem
DR-085 folded the old `operation` phase into `release` (launched/terminal), but current-state factory
templates/docs still carry `operation` vocabulary — e.g. `plugin/templates/shared/.pandacorp/status.yaml.tpl`
and mentions in `factory/standards/build-orchestration.md`. Found in the 2026-06-30 factory-flow audit (P0).
Impact: new projects can inherit stale phase comments/enums and diverge from the DR-085 lifecycle. (The
Mission-Control-side `operation` drift — its FRD/blueprint/api docs — is a PROJECT concern and routes to MC's
own change queue, not here.)

## Root cause
DR-085 updated the decision + the pipeline narrative but did not sweep every downstream template/standard that
had hard-coded the `operation` phase name, and there is no lint forbidding the retired vocabulary — so it
lingers and can be re-copied into new projects.

## Fix plan
1. Sweep `operation` (as a phase) from factory templates + canonical factory standards where it refers to the
   old phase model — `plugin/templates/shared/.pandacorp/status.yaml.tpl`,
   `factory/standards/build-orchestration.md`, and any sibling template hit (preserve historical decision-log
   mentions as history).
2. Add a **doc-lint rule** for forbidden current-state lifecycle vocabulary (`operation` used as a phase)
   outside decision logs / reviews. File: `plugin/templates/shared/.pandacorp/doc-lint.sh`.

## Tests (prove the fix — TDD, RED → GREEN)
- **Sweep grep (canary):** a scoped grep for `operation` as a phase across factory templates + standards
  (excluding decision logs) must return no hit after the sweep. Today it matches `status.yaml.tpl` and
  `build-orchestration.md`.
- **doc-lint reintroduction guard (`verify.sh --canary`, DR-079):** a fixture doc that reintroduces
  `phase: operation` (or `operation` as a lifecycle phase) outside a decision log must make the new doc-lint
  rule flag it (RED); a compliant fixture stays clean. This proves the class can't silently recur.

## Done when
The scoped `grep` for `operation` (as a phase) in factory templates/standards is clean; the doc-lint rule
flags a reintroduction (canary RED on the bad fixture); `OVERLAY_VERSION` bumped if the status template
changed.

## Out of scope
The Mission Control project's own `operation` drift (its FRD/blueprint/api docs) — that routes to MC's change
queue, not this backlog. Historical decision-log/review mentions of `operation` are left intact as history.
