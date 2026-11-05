---
id: BL-0304
type: bug
area: build-engine
title: "Make implementation teardown reclaim session-owned disk safely"
status: doing
severity: p1
opened: 2026-11-05
closed:
source: "Owner request 2026-11-05; 17 GB worktrees and 3.5 GB temporary residue"
closes:
links: [DR-135, DR-145]
---

## Problem
Implementation close-out leaves dependencies, Next build caches and temporary repo copies on disk. The owner reported 17 GiB free. Source evidence and a read-only inventory are in docs/research/worktree-cleanup-2026-11-05.md.

## Root cause
DR-135's explicit sweep is not a shared teardown; activity/cwd protections defer removal, unsafe force-removal advice exists in the overlay, sandbox workers cannot write shared git metadata, and blocking deletion can outlive tool calls.

## Fix plan
Add session-cleanup.mjs and real-Git regression tests; register session ownership at worktree bootstrap; wire skill close-outs and an automatic command wrapper; replace unsafe fallback advice; codify BUILD-5/DR-145, propagate through managed guide/rules/overlay and update the Manual. Do not change sandbox permissions or erase locks.

## Tests
Run test-session-cleanup.mjs, independent adversarial tests, test-worktree-sweep.mjs and affected hook/overlay tests; run factory standards, backlog and generated-drift validators and plugin validation. Prove complete deletion only in disposable fixtures, including ignored caches, and preservation of unmerged, dirty, locked, active and foreign worktrees.

## Done when
The tests and catalogs are green, plugin/overlay versions and logs are updated, and the report distinguishes shipped source from uninstalled project overlays. No real worktree is deleted and no commit is made in this session, by explicit owner instruction.

## Out of scope
Current worktree deletion; changing runtime sandbox permissions; shared-cache sweeps; production deployment; deleting owner state.
