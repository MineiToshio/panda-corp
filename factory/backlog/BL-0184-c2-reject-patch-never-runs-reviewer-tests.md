---
id: BL-0184
type: bug
area: build-engine
title: "On a C2 reject the reviewer's RED-proven tests stay in the gate worktree; the patch and verifyPatched run on main without them, so the patcher can re-type the test that judges it (DR-080)"
status: done
severity: p1
opened: 2026-09-25
closed: 2026-09-25
source: "docs/proposals/38-parallel-frd-gates-and-drift-policy.md, Red-team addendum (2026-09-25) §A3 finding X3 (evidence e4)"
closes: "plugin/templates/shared/.claude/engines/pandacorp-build.js drainConverge/portReviewerTests/attemptPatch/checkReviewerTestIntegrity/verifyPatched (DR-080 on the C2 reject path) — fixed in 86c95003"
links: [BL-0182, BL-0183, BL-0001, BL-0051]
---

## Problem
A review-only C2 gate that REJECTS (reopen) writes its RED-proven adversarial tests into the gate
worktree. Its reject verdict carries only a TEXT description (`findings[].failingTest`); the reject
schema has no `testFiles` (red-team e4). The convergence ladder then runs on MAIN: `attemptPatch` is
told to "make the RED-proven failing test PASS" without having the file, so it may write its own
version of it, and `verifyPatched` runs "the FULL FRD test files" on main, which never include the
reviewer's tests. The patch is certified without ever running the tests that rejected it. That breaks
DR-080 (the implementer may not shape the test that judges it).
Never exercised live (every D2 reject went legacy because of BL-0182); it follows from the code.

## Root cause
The C2 split moved the gate into a separate tree but left the reject's evidence there. Only the PASS
path had a port (`applyGate`'s `testFiles`), and nothing tied the reject ladder to the reviewer's
actual files.

## Fix plan
Design choice: **copy the tests into the patch's working tree at the SAME repo-root-relative path**,
not run vitest on them from `gate-evidence/`. A test's relative imports and the runner's include
globs/tsconfig only resolve at the path it was written for. A file under `.pandacorp/run/…` would fail
to load or be filtered out. (Verified: vitest 4.1.9 accepts an absolute file path as a filter, so the
explicit run can use `"$(git rev-parse --show-toplevel)/<path>"` for a nested project.)
1. BL-0182's release salvages the reject's files with their sha256; the engine keeps the TEST paths
   (`REVIEWER_TEST_PATH`) on the verdict (`gate.reviewerEvidence`). Non-test leftovers stay in evidence
   only.
2. `drainConverge` → `portReviewerTests` (MECH, `port-reviewer-tests:<frd>`), BEFORE the patch and on
   the quiesced main tree: copy each file from `gate-evidence/<frd>/` to `$TOP/<path>`, hash the copy.
   The ENGINE compares the hashes. On a mismatch or missing file it logs loudly and re-gates the FRD on
   main (`gateAndConverge`) instead of patching blind. The pinned set lives in `reviewerTestsByFrd` for
   this verdict's ladder only: `drainConverge` clears it, and so does `revertAndReopen` (the in-run
   retry's fresh gate owns its own tests).
3. `attemptPatch`'s prompt names the files and forbids editing, moving, skipping, deleting or
   re-typing them (DR-080), pointing a genuine defect to the existing gate-test-defective exit.
4. `verifyPatched` first calls `checkReviewerTestIntegrity` (MECH, `reviewer-test-hash:<frd>`): the
   engine compares sha256 against the pinned values. On a breach it restores the originals from
   evidence and returns red WITHOUT spawning the certifier, so the ladder falls to revert. The
   certifier's prompt then runs the files EXPLICITLY by path, fails if any is missing, and stages them
   on green.
5. `repairGateTest` (the independent reviewer, the tests' OWNER, BL-0001/BL-0051) marks the set
   re-blessed, so its legitimate edit re-pins the hashes instead of registering as a breach. A file it
   deleted still fails.

## Tests (prove the fix — TDD, RED → GREEN)
`plugin/scripts/test-pandacorp-build.mjs`, marker `// ---- BL-0182..0184 ----`:
- `BL-0184a`: C2 reopen. The port runs before the patch (evidence dir → repo-root path, hashed); a
  non-test leftover is not ported; the patch prompt names the file and forbids editing it; the hash
  check runs after the patch and before `verify-patch`, pinned to the release's hash; `verify-patch`
  runs the file by path; the FRD verifies.
- `BL-0184b`: the hash changed after the patch. There is no `verify-patch` spawn, the breach is logged
  with both hashes, the originals are restored, and the ladder reverts (never VERIFIED off that patch).
- `BL-0184c`: the port reports the file missing. There is no patch, and the FRD re-gates on main.
- `BL-0184d`: the gate-test repair edits the pinned test. The check records instead of restoring,
  there is no false breach, and the FRD verifies.

## Done when
- [x] All four RED against the pre-fix engine; GREEN after the fix.
- [x] `bash plugin/scripts/run-engine-tests.sh`: 25/25 suites.
- [x] `plugin/agents/reviewer.md` unchanged (the engine carries the directives), so there is no Codex
  mirror or prompt-fragment regeneration.

## Out of scope
The LEGACY path (gate on main): the reviewer's tests are already in the patch's tree there, but they
are not hash-pinned. That is the pre-C2 behaviour, unchanged here. A C2 PASS whose serialized apply
fails and is re-routed through `gateConverge`'s green branch still calls `applyGate(…, null)` (tests
"already on main"), a `gateConverge`-zone edge left to the owner of that zone. A live reject exercised
end to end is not verified (see BL-0182).
