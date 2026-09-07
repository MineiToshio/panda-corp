---
id: BL-0124
type: bug
area: build-engine
title: "DR-067 baseline-repair pre-check reads a controller-owned status.yaml write under a valid lease as tree dirtiness, forcing a needless full verify.sh"
status: open
severity: p2
opened: 2026-09-07
closed:
source: "factory/memory/_inbox.md note, 2026-09-03 (agent-inferred) — pandacorp-memory-review sweep on mission-control"
closes:
links: [BL-0079, LESSON-0027]
---

## Problem
A 2026-09-03 `pandacorp-memory-review` sweep observed the DR-067 baseline self-heal's cheap pre-check
dispatch a FULL baseline-repair cycle on mission-control with reason "tree is dirty". `git status
--porcelain` at the time showed exactly ONE modified path: `mission-control/.pandacorp/status.yaml` — the
file the repair SOP itself already forbids restoring while a valid active fence (`build_lease_epoch: 1`)
makes it controller-owned and continuously rewritten (BL-0079 shipped exactly this restore-protection).
The pre-check's dirtiness predicate has no equivalent exclusion, so the controller's own legitimate write
is read as "dirty" and costs a whole-project `verify.sh` run (~4 min: 814 biome files, 435 test
files/7635 tests, 68 e2e) purely to prove a clean tree clean, on every sweep that happens to land while a
lease is held.

## Root cause
BL-0079 fixed the REPAIR step to never restore `.pandacorp/status.yaml` under a valid lease, but the
separate, earlier DIRTINESS PRE-CHECK that decides whether to dispatch a repair cycle at all was not given
the same exclusion. The pre-check's `git status --porcelain` (or equivalent) treats any tracked diff as
dirty, including a diff the repair step itself would refuse to touch.

## Fix plan
1. Locate the DR-067 pre-check's dirtiness predicate (the step that decides whether to dispatch a
   baseline-repair cycle before running `verify.sh`).
2. Apply the SAME lease-aware exclusion BL-0079 already added to the repair step itself: while a valid
   active fence is held (`build_lease_epoch` matches the current lease), exclude
   `<project>/.pandacorp/status.yaml` from the dirtiness predicate, so "dirty" means only paths the repair
   can actually act on.
3. Keep the exclusion narrowly scoped to the fenced project's own `status.yaml`, not a blanket exemption
   for the whole `.pandacorp/` directory.

## Tests (prove the fix — TDD, RED → GREEN)
Fixture: a project with a valid active lease (`build_lease_epoch` matching), whose ONLY tracked diff is
its own `.pandacorp/status.yaml` (simulating the controller's normal in-flight write). RED = current
pre-check reports the tree dirty and dispatches a full repair/`verify.sh` cycle. GREEN = updated pre-check
excludes the leased `status.yaml` diff and reports the tree clean, skipping the repair dispatch. Control:
a tracked diff on ANY OTHER file under a valid lease must still be reported dirty (the exclusion is
narrow, not a blanket pass).

## Done when
The DR-067 pre-check no longer dispatches a full baseline-repair/`verify.sh` cycle solely because a
controller-owned `status.yaml` write is in flight under a valid lease; the RED→GREEN fixture above passes;
plugin version bumped per DR-034 (PATCH — narrows an existing predicate, no new capability); a
decision-log entry links this item and BL-0079.

## Out of scope
Any change to the repair step's own restore-protection logic (BL-0079's scope, already shipped and
correct); dirtiness checks for projects with no active lease.
