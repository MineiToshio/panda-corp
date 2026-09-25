---
id: BL-0160
type: bug
area: build-engine
title: "baseline-precheck escalates to a full opus baseline-repair because the lease itself dirties status.yaml (BL-0124 class recurrence), and gate-worktree bootstrap resolves PANDACORP_FACTORY_ROOT to the factory main checkout instead of the canary's own worktree"
status: done
severity: p2
opened: 2026-09-23
closed: 2026-09-24
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

**(1) Baseline-precheck recurrence — NOT a regression of BL-0124's fix; a distinct gap BL-0124 never
covered.** `git log` shows exactly one commit ever touched the exclusion (`e52bdfc1`, 9.103.0); nothing
changed it between then and Canary C's run on 9.104.2, so the engine-side decision code itself is
unmodified. Direct simulation of the four decision branches in
`plugin/templates/shared/.claude/engines/pandacorp-build.js` (~line 958-969) against the EXACT
production-shaped payload STEP 3's own prompt instructs the pre-check to return — `{ escalate: true,
dirty: true, dirtyPaths: ['.pandacorp/status.yaml'], leaseValid: true }`, with no `green` field, or with
`green: false` as `canary-c-forensics.md` §2's literal annotation records — confirms the exclusion branch
(`leasedStatusOnly` at line 965) DOES fire correctly for that shape; `baseline-precheck-decision.harness`
capture at the top of this item's investigation. So the engine logic is not the defect. The defect is
that **none of BL-0124's own regression tests (`WP04a/b/c`, `test-pandacorp-build.mjs`) actually exercise
that real shape** — `WP04a` sets `green: true` in its scripted response, which short-circuits through the
FIRST decision branch (`precheck.green === true`, line 961) and never reaches the `leasedStatusOnly`
branch the fix actually added, so the suite's "proof" the fast path works was never testing the real
trigger path. Given that gap, the most likely actual failure mode in the live Canary C run — not
independently confirmed, since the forensics artifact (`canary-c-forensics.md`) only paraphrases the
pre-check's structured output, not its literal JSON — is that the STEP 3 prompt text and the
`PRECHECK_SCHEMA.dirtyPaths` description (both ~line 677/944, pre-fix) told the MECH/haiku pre-check
agent to report dirty paths "exactly as printed" by `git status --porcelain`, which literally prints a
2-character XY status code + a space BEFORE each path (e.g. `' M .pandacorp/status.yaml'`), while the
engine's exclusion match is a strict `dirtyPaths[0] === '.pandacorp/status.yaml'` — a mis-shaped entry
silently fails that comparison (this exact shape is REV-3c's own scenario, which the previous session
wrote as a "fails-safe on malformed input" CONTROL, not realizing the prompt gave the agent no clear
reason NOT to produce that shape as its normal output). **NO PUDE VERIFICAR** which of the two candidate
divergences (bare-path-vs-porcelain-line, or a mis-set `leaseValid`) actually occurred in Canary C's own
run — the raw agent JSON is not preserved in the available evidence. The fix (below) closes both
candidates at once by making the bare-path requirement explicit and unambiguous, and adds the missing
real-shape regression coverage regardless of which one fired.

**(2) `PANDACORP_FACTORY_ROOT` resolution — confirmed by direct inspection of
`plugin/templates/shared/.pandacorp/worktree-bootstrap.sh` step 3 (pre-fix line 136-137).** It set
`PANDACORP_FACTORY_ROOT="$MAIN_WT"`, where `MAIN_WT="$(dirname "$(git rev-parse --git-common-dir)")"`.
Every `git worktree` — no matter how many `worktree add`-of-a-worktree hops deep — shares exactly ONE
common `.git` (`git-common-dir` always resolves to the SAME original repository), so `$MAIN_WT` collapses
onto the real panda-corp main checkout regardless of nesting depth. `ensureGateWorktree`
(`pandacorp-build.js` ~line 1619) runs literally `git -C ${PROJECT_DIR} worktree add --detach
${GATE_WORKTREE} ${sha}` where `PROJECT_DIR` may itself already be inside a canary's own worktree — a
worktree-of-a-worktree — and `worktree-bootstrap.sh` then always wrote the ultimate main checkout's path,
never the canary's or the gate-worktree's own pinned copy. Confirmed live in a synthetic fixture
replicating the exact topology (`plugin/scripts/test-worktree-bootstrap.sh` §(e2)): before the fix, a
gate-worktree nested inside another worktree resolved `PANDACORP_FACTORY_ROOT` to the outermost main
checkout; RED without the fix (4 failing assertions reproduced live), GREEN with it.

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

## Resolution (2026-09-24)
Shipped on branch `bl-0160-precheck-factory-root`, commit **`ddb968df`** ("fix(build-engine): bare-path
dirtyPaths + worktree-scoped PANDACORP_FACTORY_ROOT (BL-0160)").

**(1) reconciled against BL-0124: a distinct gap BL-0124 never covered, not a regression.** BL-0124's
shipped exclusion logic (`leasedStatusOnly`, unmodified since `e52bdfc1`/9.103.0) is confirmed correct by
direct simulation for the real production-shaped pre-check payload. The gap was BL-0124's OWN test suite
never exercising that real shape (`WP04a` reaches the fast path through an unrelated branch, `green:
true`, not the exclusion branch the fix actually added) plus a prompt ambiguity (STEP 3's "exactly as
printed" instruction never told the pre-check agent to strip `git status --porcelain`'s leading XY status
code) that plausibly let the live pre-check emit a mis-shaped `dirtyPaths` entry the engine's strict match
silently rejects. Fixed by tightening the STEP 3 prompt + `PRECHECK_SCHEMA.dirtyPaths` description
(`plugin/templates/shared/.claude/engines/pandacorp-build.js`, ~line 677 and ~line 944) with an explicit
bare-path requirement and a worked example; the matching logic itself is untouched (REV-3c's malformed-
input control still passes unmodified). New coverage: `BL-0160a/b/c/d` in `test-pandacorp-build.mjs`,
proving the fast path fires for the literal real-shaped and `green:false`-annotated payloads Canary C's
forensics recorded, that an unrelated dirty path still escalates, and that the prompt now documents the
bare-path rule. **NO PUDE VERIFICAR** which exact divergence (porcelain-prefixed path vs. a mis-set
`leaseValid`) fired in Canary C's own run — the raw pre-check JSON is not preserved in the available
forensic evidence; the fix closes both candidates and the coverage gap regardless.

**(2) confirmed root cause, fixed and regression-tested.** `worktree-bootstrap.sh` step 3
(`plugin/templates/shared/.pandacorp/worktree-bootstrap.sh`, ~line 136-137 pre-fix) derived
`PANDACORP_FACTORY_ROOT` from `$MAIN_WT` (`git rev-parse --git-common-dir`'s parent), which collapses
onto the SAME ultimate main checkout for every worktree regardless of `worktree add`-of-a-worktree
nesting depth — exactly the gate-worktree-inside-a-canary topology `ensureGateWorktree` creates. Fixed to
derive from `$WORKTREE` (`git rev-parse --show-toplevel`, this worktree's own root) instead; a sibling
(non-nested-factory) project is unaffected (the guarding condition never fires for it, so no `.env.local`
is written, matching pre-fix behavior exactly). New coverage: `test-worktree-bootstrap.sh` §(e1) single-
level nesting, §(e2) a worktree-of-a-worktree fixture reproducing the bug's EXACT topology (RED without
the fix — reproduced live, 4 failing assertions — GREEN with it), §(e3) the sibling-project no-op case.

**Verified by:** `bash plugin/scripts/run-engine-tests.sh` green twice, 25/25 suites both runs (0 failed).
Engine + `worktree-bootstrap.sh` re-synced byte-identical `plugin/templates/shared` → `mission-control`
(`cmp`-verified). `bash plugin/scripts/check-derived-drift.sh` exit 0. `bash
plugin/scripts/validate-backlog.sh` OK both before and after this close-out edit.

**Out of scope confirmed still open:** no live canary re-run performed (per this item's own out-of-scope
note); other factory-root-relative reads elsewhere in the engine were not audited for the same
mis-resolution pattern.
