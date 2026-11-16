---
id: BL-0329
type: bug
area: build-engine
title: "Repair literal Next paths and chained work-order scope gaps"
status: done
severity: p1
opened: 2026-11-16
closed: 2026-11-16
source: "Owner incident: funko-tracker br-2026-11-16-01 u-build-wo-12-004; BL-0327 follow-up"
closes: "Plugin 10.13.8; literal Next paths, selected chained WO ownership and protected dispute entry"
links: [BL-0327, DR-034, DR-103, DR-133]
---

## Problem

The saved blocked report needs discoveryBuild.test.ts (async enumeration) and the protected
src/app/(catalog)/piece/[id]/_tests/publicPrerender.test.tsx (empty-only-sentinel approved in d-0001).
The unit owns wo-12-004, wo-12-005 and wo-12-007. scope-repair rejects literal brackets as globs,
and rejects the chained unit before it can record the approved correction. The source project is read-only.

## Root cause

approvalFiles rejects brackets even though artifact matching and Git use literal paths. scopeRepairCommand
requires exactly one WO; validation and settlement always read the target's first WO. Mixed file approval
selects only the dispute branch, silently discarding the ordinary artifact repair.

## Fix plan

Accept literal brackets while rejecting star/question wildcards. Add optional --wo, defaulting to the unit's
first WO; isolate the architect to that WO through report and settlement. Retain protected precedence:
protected-only requests open the existing dispute; mixed requests first integrate ordinary artifacts,
then open that dispute without changing protected hashes. Document d-0001 as evidence and owner answer
registration, update the Manual, decision logs and PATCH manifests.

## Tests

TMPDIR=/private/tmp node plugin/scripts/test-build-v2-scope.mjs with sanitized incident fixture bl-0329:
first observed RED (8 passing, 5 failing) on absent --wo validation, multi-WO refusal and literal brackets.
Verify explicit/default WO ownership through report/integration/replay, invalid WO/wildcards, protected-only
and mixed disputes, protected hash invariance and same-attempt continuation. Run relevant build-v2 suites,
validate-backlog.sh, generate-plugin-manifests.mjs and check-derived-drift.sh.

## Done when

All regressions and relevant suites pass; exact Claude coordinator resume/scope-repair/handoff commands
and doubt-answer instructions are documented; PATCH manifests and Manual match. No writes to factory .git
or funko-tracker; no installation, commit or product execution.

## Out of scope

Product edits, resetting the run, changing attempts or run scope, direct protected oracle/hash replacement,
new acceptance contracts, Git mutations in the factory and plugin installation.

## Verification evidence (2026-11-16)

The final relevant build-v2 suites are green: scope 13, independent scope-adversarial 5,
report 61, unblock 13, state 76, next 68, CLI 36, failure 32, integrate 25, planner 30,
incremental-design 13, answer 32, drive 45, e2e 115 and hardening 38: **602 passed, 0 failed**.
Independent review found and closed two recovery gaps: mixed unblock writes reported directly inside
planUnblock (no builder-ready queued window), and the existing doubt_opened event after its precise
unblocked event prevents reopening an old dispute during a later reported execution. The real next
integration test asserts doubt opening before planning/dispatch, retained input of a subsequent doubt,
unchanged attempt and immutable protected hashes.

```bash
for s in report unblock state next cli failure integrate planner incremental-design answer drive e2e; do TMPDIR=/private/tmp node "plugin/scripts/test-build-v2-$s.mjs" || exit; done
TMPDIR=/private/tmp node plugin/scripts/test-build-v2-scope.mjs
TMPDIR=/private/tmp node plugin/scripts/test-build-v2-scope-adversarial.mjs
TMPDIR=/private/tmp node plugin/scripts/test-build-v2-hardening.mjs
node plugin/scripts/generate-plugin-manifests.mjs
bash plugin/scripts/check-derived-drift.sh /Users/Shared/Proyectos/panda-corp
bash plugin/scripts/validate-backlog.sh
```

JavaScript syntax checks, changed/new scope file formatting and git diff --check pass. The original
incident run, state, handback and d-0001 were inspected read-only: stopped, epoch 50, d-0001 decided by
owner as empty-only-sentinel. Exact Claude coordinator commands and conditional parked-dispute answers
are in CLI section 3.14c. No factory Git mutation, product execution, product writes or plugin install/update.
Protected-only process loss before opening still needs the documented doubt-open recovery command;
mixed requests recover automatically from integrated docs and journal. The existing dispute records a
decision but does not implement protected-oracle replacement: product repair is not certified here.
