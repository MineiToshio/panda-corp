---
id: BL-0006
type: bug
area: templates
title: "pending-work.sh builds JSON unescaped; merge-queue.sh checks ff only after rebase+verify"
status: done
severity: p2
opened: 2026-06-30
closed: 2026-07-03
source: "docs/proposals/19-factory-flow-audit-2026-06-30.md (P2 — Merge/Pending Work Scripts Robustness)"
closes: "Duplicate of a fix already shipped in commit 0fc6e22 (2026-06-30, plugin v9.30.0, OVERLAY_VERSION 8.47.0→8.48.0), which resolved this exact P2-14 finding from the same audit doc before this item was actioned. pending-work.sh --json already emits via jq (with an escaping fallback) and merge-queue.sh already preflights main-checkout cleanliness before rebase (exit 12). Re-verified on 2026-07-03 with script assertions: a branch name containing a double-quote + a worktree path containing a space round-trip through `jq .` cleanly, and merge-queue.sh exits 12 at the preflight (before rebase) when main is dirty. No code change was needed; OVERLAY_VERSION is already well past the required bump (currently 8.58.0)."
links: [DR-096]
---

## Problem
Two overlay scripts are fragile. (1) `pending-work.sh --json` builds JSON manually without escaping
branch/path values, so unusual branch/path names (spaces, quotes, backslashes) can produce invalid JSON that
breaks any consumer that parses it. (2) `merge-queue.sh` checks whether main can fast-forward only AFTER
rebase and verify, so when the main checkout is busy/dirty the script wastes a full rebase+verify cycle before
failing. Found in the 2026-06-30 factory-flow audit (P2). Impact: brittle automation output and wasted
integration time under contention.

## Root cause
`pending-work.sh` string-concatenates JSON instead of using a safe emitter, so any value containing a JSON
metacharacter escapes the structure. `merge-queue.sh` orders its preconditions wrong — the cheap, likely-to-
fail check (can main fast-forward / is the checkout clean) runs last instead of first.

## Fix plan
1. Emit JSON with `jq` (or a safe emitter) in `pending-work.sh` so all values are escaped.
2. Preflight main-checkout cleanliness / ff-ability in `merge-queue.sh` BEFORE the long integration work, while
   still re-checking ff right before the actual merge (the late check stays; a cheap early one is added).
Files: `plugin/templates/shared/.pandacorp/pending-work.sh`,
`plugin/templates/shared/.pandacorp/merge-queue.sh`.

## Tests (prove the fix — TDD, RED → GREEN)
- **JSON escaping (script assertion):** run `pending-work.sh --json` against a fixture branch named with a
  space and a `"` quote and pipe the output through `jq .` — it must parse (exit 0). Today the raw string form
  produces invalid JSON and `jq` errors.
- **Fail-fast preflight (script assertion):** with a deliberately dirty/behind main checkout, `merge-queue.sh`
  must exit non-zero at the preflight BEFORE any rebase/verify runs (assert via a marker/log or timing that the
  rebase step was not reached). Today it only fails after the full cycle.

## Done when
`pending-work.sh --json` produces `jq`-valid JSON for a branch with spaces/quotes; `merge-queue.sh` fails fast
on a busy/behind main before rebasing (both proven by the script assertions above); `OVERLAY_VERSION` bumped
(overlay scripts changed).

## Out of scope
Reworking the merge-queue's rebase/verify strategy itself; changing the `pending-work.sh` output schema — only
its encoding safety.
