---
id: BL-0212
type: bug
area: build-engine
title: "a revert 'to last_green_sha' is a silent no-op for a work order the pin already contains (carry-over or a sibling landing published it before its own gate)"
status: done
severity: p1
opened: 2026-09-30
closed: 2026-09-30
source: "red-team of the BL-0190/0205-0211 batch (2026-09-30): the BL-0190 audit's finding — the first last_green_sha publication of canary F1, F2 and E2 certified IN_REVIEW commits of sibling FRDs 2-43 min before they verified"
closes: "plugin/runtime/engine/pandacorp-build.src.js (revertAndReopen, the DR-070 revert in the gate/repair block path, the in-run-retry discard, the A3 seam revert)"
links: [BL-0190, BL-0066, DR-070, DR-073, DR-107, DR-122]
---

## Problem
`last_green_sha` is published by each PASS landing as the snapshot of the WHOLE main tree (BL-0066 commit A). With
parallel gates (default since 9.116.0), build waves between landings, and every carry-over work order of a previous
run, that tree already holds `IN_REVIEW` commits of FRDs whose own gate has not landed. `audit-last-green.mjs` found
it on the first publication of F1 (`d858cf8d`), F2 (`8dd7532b`) and E2 (`59ce5a79`), 3 commits each.

The pin cannot be made "verified-only" at the source: in linear history the unverified commits precede the verified
ones, so the only verified-only snapshot is an OLDER pin, and every file-level revert "to `last_green_sha`" would then
also wipe verified sibling edits to a shared file (i18n messages, constants). The engine keeps "the pin contains every
verified FRD" — the invariant that protects verified siblings — and the standard now says so (build-orchestration.md,
"What `last_green_sha` certifies").

The defect is in the consumers that assume the opposite. Every discard of rejected code reverts "to the last green":
`revertAndReopen` (`git checkout <last_green_sha> -- <its files that existed at last green>` + `git rm` of the files it
newly created), the DR-070 revert when a gate/repair BLOCKS a work order, the in-run retry discard and the A3 seam
revert (`git checkout <last_green> -- <seam.files>`). For a work order the pin already contains, its files at the pin
ARE its rejected build, and none of them is "newly created" relative to the pin, so the revert changes nothing, silently:
- the DR-107 in-run retry and the A3 point/seam paths rebuild "from the clean base" on top of the rejected code;
- a BLOCKED work order's broken code stays committed on main and keeps red-locking the whole-project gate of every
  sibling FRD (the pollution DR-070 exists to prevent).
The DR-122 drift proof is NOT affected: `drift-proof.mjs` refuses a base where a reviewed work order is already
`IN_REVIEW`/`VERIFIED` (`baseValid`), so such claims fail closed (a cost in provability, not a hole).

## Fix plan
1. Revert a work order's OWN changes, not "the tree at the pin": the engine already receives each work order's build
   commit sha from the serialized commit step (`{ committed: 1, sha }`); record it per work order (carry-over ones:
   the commit that flipped its work-order file to `IN_REVIEW`, found by a deterministic script, never by a model).
2. A deterministic helper (`plugin/scripts/wo-revert-plan.mjs`?) prints, per file, the base to restore: the pin when
   the work order's build commit is NOT an ancestor of it (today's behavior), else the build commit's parent — and
   flags any file another commit touched since (a shared file), where `git revert --no-commit <wo commits>` is the
   only non-destructive choice (conflict → refuse, needs-owner).
3. The revert prompts run the helper's commands verbatim and return its receipt; the engine logs a loud `RevertNoop`
   when a revert changed nothing.

## Tests (prove the fix — TDD, RED → GREEN)
- A git-fixture test of the helper: WO-A built, sibling FRD B lands (pin covers A), A reopened → the plan restores A's
  files to A's parent; a shared file edited by B after A → `git revert` path, B's edit survives.
- Engine scenarios: a reopened work order whose build precedes the pin gets the precise revert commands; a BLOCK of
  such a work order discards its code; the no-op receipt is logged.

## Done when
- [x] No revert path restores a reopened/blocked work order's files from a pin that already contains its build.
- [x] `run-engine-tests.sh`, `test-engine-artifact.mjs` green. The canary half ("the next canary's audit shows the
  reverts land") can only be observed on a live build: not verified here.

## Out of scope
Changing what `last_green_sha` publishes (it keeps every verified FRD — see Problem) or the review worktree's
`safe_to_test` meaning (documented: whole-project green, may include `IN_REVIEW` work).

## Resolution (2026-09-30)

**Sites found** (source `plugin/runtime/engine/pandacorp-build.src.js`, pre-fix): `revertAndReopen` COMMIT 2 (every
DR-073 fallback, the A3 seam revert, the in-run retry's re-reject and the traceability re-ask's reopen all funnel
through it); `blockEarlyNeedsOwner` step 1 (A3 early block, BL-0051 deadlock block); `attemptRepair` step 3 (the DR-070
block, reached from a gate failure without reopen AND from a build-wave self-test failure). All three told a model to
`git checkout <last_green_sha> -- <its files>` + `git rm` "newly-created" ones. Two other pin consumers were checked
and left as they are: the baseline reconciliation restores UNCOMMITTED dirty paths to the pin (not a work order's
commits) and the DR-065 foundation repair resets whole surfaces; `persistGateBlock` and the repair-budget exit keep the
work by design.

**Fix.** `plugin/scripts/wo-revert.mjs` (plan | apply | replay) replaces the model's checkout with a deterministic
revert of the work order's OWN commits — the attempt found from git history, the pin used only for files the attempt
first touched after it (the unchanged pre-fix behaviour), a 3-way reverse merge that keeps any other commit's edit of a
shared file, and a whole-plan refusal (nothing written) on a conflict, a dirty target, a work order not in the required
state or bad input. The engine drives it through a MECH relay with a sealed receipt at all three sites (plan → flip →
apply for a reopen; flip → apply for the blocks; the repair restores only uncommitted edits to HEAD first). A refusal
blocks the FRD `needs-owner` with a Spanish decision record naming the conflicting files and is never followed by a
rebuild; a no-op where a change was expected is logged and emitted (`RevertNoop`). Full contract:
`factory/standards/build-orchestration.md`, "The revert contract (BL-0212)".

**Deviation from the fix plan:** no per-WO build sha is recorded in the engine (a carry-over work order has none in
memory, and a patch/repair commit is part of the attempt too); the script derives the whole attempt from git history
instead, one source for fresh and carry-over work orders alike.

**Tests.** `plugin/scripts/test-wo-revert.mjs` (51 assertions, real repositories, nested and flat): the legacy restore
is reproduced as a no-op on the fixture, then the script discards the code; DR-070 block; shared file with a later
VERIFIED edit preserved; conflict refused with no partial write + `RevertRefused`; pin without the work order = the
legacy result; patch + seam revert + rebuild undone as one; dirty target; wrong state; unknown work order; replay.
`plugin/scripts/test-pandacorp-build.mjs`: 9 BL-0212 scenarios (carry-over reopen order, DR-070 early block, repair
give-up on both paths, refused plan, refused apply, altered/unreadable relay, no-op, parallel gates with two FRDs), all
RED against the pre-fix engine. 12/12 mutations killed.

**Second red-team (2026-09-30).** Four work-loss paths of `wo-revert.mjs` (rename, mixed commit, certified anonymous sibling repair, pin restore over a later writer) and one false `dirty` refusal (a preserved test moved out of the tree) are fixed with tests `test-wo-revert.mjs` (g)-(l); the baseline reconciliation named above as "left as it is" restored dirt to the pin, which staged the reversal of post-pin commits: it now restores to HEAD (scenario `DR-067 × BL-0212`). The crash window between the flip and the apply is BL-0215. See `plugin/docs/decision-log.md`.
