---
id: BL-0327
type: bug
area: build-engine
title: "Repair blocked work-order allowlists through an owner-approved architect unit"
status: done
severity: p1
opened: 2026-11-16
closed: 2026-11-16
source: "Owner incident: funko-tracker br-2026-11-16-01, u-build-wo-12-003, journal seq 121-124"
closes: "Plugin 10.13.6; BUILD-15 and CLI 3.14c; 540 passing build-v2 checks"
links: [DR-034, DR-103, DR-133]
---

## Problem

The run stopped with no_progress after WO-12-003 reported a blocked static gate: two Contact exports in
src/lib/contact/visitor.ts and 13 obsolete Cache-Control assertions in src/lib/_tests/launchIntegration.test.ts
were outside artifacts. The worker labeled the blocker dependency, but described an ownership gap, not a missing
secret/account/service. The only unblock command lifts env-infra; the card architect cannot amend claimed WOs.
incremental.mjs:41 forbids amendment of a claimed WO. The build therefore has no supported continuation despite the owner approving the necessary bounded repair.
Source project and its git/state are strictly read-only for this factory change.

## Root cause

Pre-fix report.mjs:376 applyFailure forwarded report.diagnosis unchanged; status blocked used report_failed with worker_blocked.
failure/policy.mjs:87 decideFailure mapped every dependency cause to dependency_missing before the override could matter.
Neither diagnosis.detail nor pending affected classification. failure/handbackText.mjs rendered dependency_missing as
missing infrastructure. units/workOrders.mjs correctly reads artifacts from the base commit, so merely changing the
integration WO cannot fix an already preserved builder checkout. Preserve that security boundary with a pinned revision.

## Fix plan

Normalize explicit scope evidence in report.mjs / scope.mjs, preserving true dependencies and protected test disputes.
Add a fenced owner-approved scope-repair CLI command that queues a bounded architect docs unit. Restrict its report
contract to approved artifact and safe dependency additions on its blocked WO. On integration, next re-admits the
preserved builder and same-hand-back dependents without spending attempts. Extend unit/journal schemas; preserve
scope_revision and dependency edges in replay. Keep plain unblock restricted. Update CLI policy, Manual and logs.

## Tests (prove the fix — TDD, RED → GREEN)

TMPDIR=/private/tmp node plugin/scripts/test-build-v2-scope.mjs uses the real sanitized report fixture under
fixtures/build-v2/bl-0327. Before the fix its assertion expected scope but received dependency (0 passed, 1 failed).
Cover legacy hand-back, owner decision, architect report/integration, unchanged dirty checkout/branch/attempt, pinned
artifact consumption, replay, idempotence, stale epoch, path/approval/claim refusals, dependency validation, protected
hash precedence and existing dispute/doubt opening. Run relevant report/unblock/state/next/CLI/failure/integrate/
planner/incremental-design/answer/drive/e2e suites with TMPDIR=/private/tmp. Validate backlog and derived artifacts.

## Done when

Regression and relevant suites are green; build-engine.md and build-engine-cli.md document the repair; Manual reflects
it; exact incident resume/owner decision/handoff commands are supplied. Plugin PATCH 10.13.6 manifests are regenerated
and check-derived-drift.sh passes. No source-project writes, factory git writes, add or commit occur.

## Out of scope

Running or modifying funko-tracker, changing production code or acceptance contracts, replacing protected oracles,
new run scope, unconditional unblock, attempt escalation, factory git commits and plugin installation changes.

## Verification evidence (2026-11-16)

The final loop exited 0 on the completed code: scope 9, report 46, unblock 13, state 76, next 68, CLI 36,
failure 32, integrate 25, planner 30, incremental-design 13, answer 32, drive 45 and e2e 115: **540 passed, 0 failed**.
The scope fixture was first observed RED before the fix (dependency instead of scope); the completed regression also
exercises next's automatic settlement and preserves a dependent's later authoritative hand-back.

```bash
for s in scope report unblock state next cli failure integrate planner incremental-design answer drive e2e; do TMPDIR=/private/tmp node "plugin/scripts/test-build-v2-$s.mjs" || exit; done
```

Manifest generation, check-derived-drift.sh, validate-backlog.sh, JavaScript syntax, new-file formatting and git diff
--check pass. The attempted optional `claude plugin validate plugin/` was rejected by automatic execution review:
this environment prohibits invoking/steering the Claude runtime. No installation/update or source-project commands
were run. Exact coordinator commands are in build-engine-cli.md, section 3.14c; owner approval is already granted.
