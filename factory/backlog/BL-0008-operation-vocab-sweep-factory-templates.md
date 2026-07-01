---
id: BL-0008
type: bug
area: templates
title: Old `operation` lifecycle vocabulary still in factory templates (DR-085 removed the phase)
status: open
severity: p1
opened: 2026-06-30
closed:
source: docs/proposals/19-factory-flow-audit-2026-06-30.md (P0 — Lifecycle Vocabulary Drift: operation)
closes:
links: [DR-085]
---

**Problem:** DR-085 folded the old `operation` phase into `release` (launched/terminal), but current-state
factory templates/docs still carry `operation` vocabulary — e.g. `plugin/templates/shared/.pandacorp/status.yaml.tpl`
and mentions in `factory/standards/build-orchestration.md`. New projects can inherit stale phase comments.
(The Mission-Control-side `operation` drift — its FRD/blueprint/api docs — is a PROJECT concern and routes to
MC's own change queue, not here.)

**Fix plan:**
1. Sweep `operation` from factory templates + canonical factory standards where it refers to the old phase
   model (preserve historical decision-log mentions as history).
2. Add a **doc-lint rule** for forbidden current-state lifecycle vocabulary (`operation` as a phase) outside
   decision logs/reviews. File: `plugin/templates/shared/.pandacorp/doc-lint.sh`.

**Done when:** `grep` for `operation` (as a phase) in factory templates/standards is clean; the doc-lint rule
flags a reintroduction; `OVERLAY_VERSION` bumped if the status template changed.
