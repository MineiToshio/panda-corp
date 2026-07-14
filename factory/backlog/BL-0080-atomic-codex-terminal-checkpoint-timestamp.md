---
id: BL-0080
type: bug
area: build-engine
title: "Make Codex terminal checkpoints use one atomic timestamp"
status: done
severity: p1
opened: 2026-07-14
closed: 2026-07-14
source: "R10-K Stage 2 certification finding"
closes: "Plugin 9.95.8 atomic Codex terminal checkpoint invariant"
links: [DR-113]
---

## Problem

The Codex executor writes a terminal checkpoint whose `terminal_at` and `updated_at` can differ by one
or more milliseconds. In `plugin/runtime/codex/executor.mjs`, `terminal()` obtains a timestamp for
`terminal_at`, then `checkpoint()` independently obtains another timestamp for `updated_at`. R10-K
Stage 2 exposed the mismatch in certification evidence. A terminal transition is one atomic fact, so
the receipt, checkpoint and supervisor must observe one terminal instant; a nondeterministic mismatch
can reject an otherwise correct cold-continuation run and makes the evidence internally inconsistent.

## Root cause

The checkpoint writer owns `updated_at`, but its caller independently owns `terminal_at`. There is no
single transition timestamp passed through both fields, and the current tests do not force the clock
to tick between the two calls.

## Fix plan

1. Change `plugin/runtime/codex/executor.mjs` so one timestamp is captured for a terminal transition
   and reused for both `terminal_at` and checkpoint `updated_at`.
2. Add a deterministic regression in `plugin/scripts/test-codex-executor.mjs` that forces consecutive
   clock reads to differ and proves terminal equality rather than relying on same-millisecond execution.
3. Audit the Codex supervisor, certification receipt and unattended-evidence readers for assumptions
   about terminal checkpoint time, and add assertions where the atomic instant crosses those seams.
4. Update the runtime-portability contract and the Mission Control Manual only where this observable
   evidence invariant is documented, plus the plugin decision log.

## Tests (prove the fix — TDD, RED → GREEN)

- `node plugin/scripts/test-codex-executor.mjs` includes a clock-tick regression that is RED before the
  production fix and asserts `terminal_at === updated_at` for every terminal reason exercised.
- The supervisor/receipt seam tests assert that their terminal observation remains consistent with the
  checkpoint's single instant.
- Run the Codex executor, unattended, runtime-switch, manifest/derived-source, Manual and complete
  plugin verification corpus; all must pass.

## Done when

- Every executor terminal checkpoint derives `terminal_at` and `updated_at` from one captured instant.
- A deterministic test fails against the pre-fix two-read implementation even on a fast machine.
- Related supervisor/receipt writers and readers have been audited and their consistency is covered.
- Runtime documentation and decision history describe the atomic terminal-checkpoint invariant.
- Plugin version is `9.95.8`; overlay version changes only if a propagated template changes.
- All targeted and full verification gates pass.

## Out of scope

Changing the meaning of terminal reasons, retry policy, lease fencing, R10-K fixture pins or any Claude
Dynamic Workflow behavior.
