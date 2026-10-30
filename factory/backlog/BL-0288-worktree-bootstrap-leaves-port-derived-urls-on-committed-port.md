---
id: BL-0288
type: bug
area: templates
title: "Gate committed server-env on the serialized merge queue; restore local PORT on exit"
status: done
severity: p1
opened: 2026-10-29
closed: 2026-10-29
source: "funko-tracker merge-queue landing 2026-10-29 — three red queue runs (12-15 e2e failures); lesson in funko-tracker .pandacorp/run/lessons.md"
closes: "plugin 9.145.2 / overlay 8.114.1 — worktree-bootstrap.sh PORT-only + merge-queue.sh gates on the committed e2e/server-env.json (exit 14 on a busy port, EXIT-trap restore)"
links: [BL-0154]
---

## Problem
A worktree-derived PORT cannot safely drive funko-tracker's integration gate against its shared
gate DB. Rewriting URLs broke 26 media e2e tests; preserving media URLs while moving auth violates
the localFixture same-origin invariant. The owner chose the Pareto option on 2026-10-29:
gate the committed config under the queue lock, without per-worktree databases or URL rewriting.

## Root cause
ORACLE_MEDIA_BASE_URL is data identity: 400 media rows were seeded at :4037 in the shared gate DB.
Changing its origin made 0/400 images resolve; moving only bare auth origins still separates auth
and media. Bootstrap is appropriate for local PORT allocation, but the serialized integration gate
needs the complete committed environment. Tracked skip-worktree overrides also block rebase when
main changes those files; cleanup must restore local config on every nonzero post-restore outcome.

## Fix plan
1. Bootstrap step 2b returns to BL-0154 PORT-only behavior, supporting numeric PORT with tostring.
   Preserve every URL, remove HEAD/old-port matching, clean temporary files on jq failure.
   Retain skip-worktree on server-env.json and tracked root .claude/launch.json.
2. Keep the queue's top clean-tree check; clear/restore only bootstrap-owned skip-worktree paths.
   After successful rebase, assert project-relative e2e/server-env.json matches HEAD, without
   re-bootstrap. Read committed PORT with jq tostring; probe 127.0.0.1 via /dev/tcp before verify.
   A busy port hands back exit 14 with instructions to stop the dev server / other gate and retry.
   Projects without the file skip this check. The shared queue lock serializes shared-DB gates.
3. Arm EXIT cleanup before restoring overrides: re-run executable project-relative bootstrap,
   release the queue lock first, warn on failure and preserve the original nonzero exit status.
   Cover red, port busy, exit 21, ff-merge failure, push failure and rebase abort; skip exit 0.
4. Keep plugin 9.144.2 / overlay 8.114.1 updates already present. Copy only bootstrap to Mission
   Control byte-for-byte; its diverged merge-queue remains untouched. Document the final design.
5. BL-0288 review: scope root launch/project-prefixed env only; preserve user/sparse skips; missing jq → 20; unlock before failure-only bootstrap, warn without masking status, never recreate a successful merge manifest.

## Tests
- Bootstrap section (f): all bare/path/query/other-port/remote URLs unchanged, derived PORT,
  numeric nested PORT, no temp leftovers, jq-failure cleanup, tracked launch autoPort and clean status.
- Queue fixtures: verify records a probed free high committed PORT and asserts HEAD equality; local
  PORT 3964 returns after launched exit 21, red exit 11 and busy exit 14; exit 0 keeps committed config.
  Busy listener prevents verify from running and produces actionable instructions.
  Preserve main-changes-server-env, nested invocation, dirty WIP exit 20 and conflict abort exit 10.
- Final-design tests before implementation: bootstrap RED 46/5; queue RED 45/11.
  After implementation: bootstrap GREEN 51/0; queue GREEN 56/0.
- BL-0288 review: ephemeral busy listener; user skip-worktree bytes/bit survive; exit 0 leaves no manifest/lock; exits 14/11 release locks; queue 76/0, bootstrap 51/0, batch integration and template syntax pass.
- Run both template bash syntax checks, bootstrap cmp and git diff checks.

## Done when
- [x] `test-worktree-bootstrap.sh` 51/0, `test-merge-queue-release-gate.sh` 76/0, `test-batch-integration.sh` green; `bash -n` clean; bootstrap template and Mission Control copy byte-identical.
- [x] Plugin 9.145.2 + OVERLAY_VERSION 8.114.1; plugin decision-log entry.
- [x] Live proof in funko-tracker (branch `chore/overlay-8.114.1`, fresh worktree, no manual edit of `e2e/server-env.json`; worktree PORT 3952): the queue's gate ran on the committed :4037 file — unit 3169/3169, e2e 460/462; afterwards the worktree was back on 3952 with skip-worktree and a clean tree. The 2 e2e reds are not BL-0288: `contact.spec.ts:11` passed 6/6 when re-run alone (flake); `personal-controls-motion.spec.ts:5` fails 6/6 on funko-tracker's untouched main checkout (pre-existing project defect, for that project's change flow). Not landed on funko-tracker main (production; owner's order required).

## Out of scope
Per-worktree DBs, rewriting URLs, changing Playwright readers, changing the main checkout's port,
copying merge-queue to Mission Control, production release, and running funko-tracker's live gate.
