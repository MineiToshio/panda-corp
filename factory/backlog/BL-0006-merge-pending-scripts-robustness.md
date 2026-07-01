---
id: BL-0006
type: bug
area: templates
title: pending-work.sh builds JSON unescaped; merge-queue.sh checks ff only after rebase+verify
status: open
severity: p2
opened: 2026-06-30
closed:
source: docs/proposals/19-factory-flow-audit-2026-06-30.md (P2 — Merge/Pending Work Scripts Robustness)
closes:
links: [DR-096]
---

**Problem:** `pending-work.sh --json` builds JSON manually without escaping branch/path values → unusual
branch/path names can produce invalid JSON. `merge-queue.sh` checks whether main can fast-forward only
AFTER rebase and verify → a busy main checkout wastes time before failing.

**Fix plan:**
1. Emit JSON with `jq` or a safe emitter in `pending-work.sh`.
2. Preflight main-checkout cleanliness in `merge-queue.sh` before long integration work, while still
   re-checking ff right before the merge.
Files: `plugin/templates/shared/.pandacorp/pending-work.sh`,
`plugin/templates/shared/.pandacorp/merge-queue.sh`.

**Done when:** `pending-work.sh --json` produces valid JSON for a branch with spaces/quotes; `merge-queue.sh`
fails fast on a busy main before rebasing; `OVERLAY_VERSION` bumped (overlay scripts changed).
