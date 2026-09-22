---
id: BL-0160
type: bug
area: build-engine
title: "baseline-precheck escalates to a full opus baseline-repair because the lease itself dirties status.yaml (BL-0124 class recurrence), and gate-worktree bootstrap resolves PANDACORP_FACTORY_ROOT to the factory main checkout instead of the canary's own worktree"
status: open
severity: p2
opened: 2026-09-23
closed:
source: "canary-c-forensics.md §2 timeline + §7 'Hallazgos hermanos' — Canary C live run, wf_1cf782d6-2ed, frd-23-materialized-stats-read-model"
closes:
links: [BL-0124]
---

## Problem
Two distinct defects observed in the same Canary C run, both confirmed live against `canary-c-forensics.md`:

**(1) `baseline-precheck` escalation — same symptom class as BL-0124, which is `status: done`/closed.**
The forensic timeline (`canary-c-forensics.md` §2) records, at the very start of the run:
`19:49:48 | 19:51:14 | baseline-precheck | haiku | 19 | escalate:true, dirty:[.pandacorp/status.yaml],
green:false (la propia lease ensucia status.yaml, clase BL-0124)`. This forced a full opus `baseline`
repair pass (112.8s / $0.260089, confirmed in `canary-c-report.md`'s agent table, row 2) purely because
the ACTIVE BUILD'S OWN LEASE had just written to `status.yaml` — the exact mechanism BL-0124's fix
(`WP-04`, "exclude leased status.yaml from baseline precheck dirtiness", plugin 9.103.0) was supposed to
close. `canary-c-forensics.md` §7 names it directly: *"El baseline-precheck escala por el status.yaml sucio
que escribe la propia lease (clase BL-0124): costó un baseline opus."* Since BL-0124 is closed and its fix
is supposedly live on the plugin version(s) this canary ran (9.104.3), this is either a **regression** of
BL-0124's fix, or a **variant trigger** the original fix's dirtiness-exclusion logic does not cover (e.g. a
different write pattern or timing than the one BL-0124's fix targeted). Neither hypothesis is confirmed
here — this item only records the recurrence with its own fresh evidence.

**(2) `gate-worktree` bootstrap resolves `PANDACORP_FACTORY_ROOT` to the wrong checkout.**
`canary-c-forensics.md` §7: *"El bootstrap del gate-worktree apunta `PANDACORP_FACTORY_ROOT` a la fábrica
MAIN, no a canary-c. Sus tests leen datos que otra sesión estaba modificando en paralelo."* Mission
Control's `lib/config.ts` (per `mission-control/CLAUDE.md`) resolves the factory root via
`PANDACORP_FACTORY_ROOT` (default `process.cwd()/..`) to read `factory/ideas/`, `factory/portfolio.md` and
per-project `.pandacorp/status.yaml` files. When the gate worktree's bootstrap leaves this pointing at the
factory's own MAIN checkout (`panda-corp/`) instead of the canary's own worktree
(`panda-corp-canary-c/`), any test or gate step that reads factory-root data is reading state a DIFFERENT,
concurrently-running session may be actively mutating — a cross-session contamination risk distinct from,
but adjacent to, the nested-`package.json` bug BL-0155 already fixed in the same script.

## Root cause
Not fully diagnosed for either sub-defect in this item — both are recorded as confirmed OBSERVATIONS from
the forensic read, not yet traced to an exact `file:line`. Flagged as the first fix-plan step for whoever
picks this item up.

## Fix plan
1. **(1) Baseline-precheck recurrence:** re-read BL-0124's actual shipped fix (commit `e52bdfc1`,
   "exclude leased status.yaml from baseline precheck dirtiness") against the exact dirtiness-detection
   code path and determine whether Canary C's trigger (this specific lease-write timing/shape) falls
   outside what that fix excludes, or whether the fix regressed between 9.103.0 and 9.104.3. Extend the
   exclusion (or fix the regression) so a lease actively held by the CURRENT run's own build never counts
   as "dirty" for the precheck, regardless of exact write timing.
2. **(2) `PANDACORP_FACTORY_ROOT` resolution:** find where the gate-worktree bootstrap sets or inherits
   `PANDACORP_FACTORY_ROOT` (likely the same `worktree-bootstrap.sh`/`ensureGateWorktree` path BL-0155
   just fixed for the nested `package.json` case) and make it resolve relative to the ACTUAL worktree the
   gate is running in, never falling back to (or inheriting from the parent session's env) the factory's
   main checkout.

## Tests (prove the fix — TDD, RED → GREEN)
- (1) A scenario that holds an active build lease, writes to `status.yaml` via the lease mechanism exactly
  as Canary C's timing did, and asserts `baseline-precheck` does NOT escalate (`escalate:false`).
- (2) A test that boots a gate worktree under a non-default factory root (simulating a canary/sibling
  checkout) and asserts any step reading `PANDACORP_FACTORY_ROOT`-relative data resolves to THAT worktree's
  own factory root, not the process's ambient/parent one.

## Done when
- `baseline-precheck` does not escalate on a lease-owned `status.yaml` write, confirmed by a regression
  test and reconciled explicitly against BL-0124 (either "BL-0124's fix now also covers this trigger" or
  "this was a distinct gap BL-0124 never covered", stated plainly in this item's close-out).
- `gate-worktree` bootstrap resolves `PANDACORP_FACTORY_ROOT` to the worktree it is actually running in,
  confirmed by a regression test.
- `bash plugin/scripts/run-engine-tests.sh` green, run twice.

## Out of scope
Re-running a live canary to re-confirm both fixes end-to-end (a separate live run, not part of this item's
closeable scope). Whether other factory-root-relative reads elsewhere in the engine share the same
mis-resolution — flagged here as a risk, not audited exhaustively in this item.
