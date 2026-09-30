---
id: BL-0212
type: bug
area: build-engine
title: "a revert 'to last_green_sha' is a silent no-op for a work order the pin already contains (carry-over or a sibling landing published it before its own gate)"
status: open
severity: p1
opened: 2026-09-30
closed:
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
- [ ] No revert path restores a reopened/blocked work order's files from a pin that already contains its build.
- [ ] `run-engine-tests.sh`, `test-engine-artifact.mjs` green; the next canary's audit shows the reverts land.

## Out of scope
Changing what `last_green_sha` publishes (it keeps every verified FRD — see Problem) or the review worktree's
`safe_to_test` meaning (documented: whole-project green, may include `IN_REVIEW` work).
