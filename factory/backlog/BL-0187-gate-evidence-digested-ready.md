---
id: BL-0187
type: bug
area: build-engine
title: "gateEvidence:'digested' could never run clean on a nested project — every gate-worktree agent worked from the worktree ROOT, the collector's bootstrap probe was alias-hijackable, and its diffs carried the enclosing repo"
status: done
severity: p1
opened: 2026-09-25
closed: 2026-09-25
source: "docs/proposals/38-parallel-frd-gates-and-drift-policy.md — Red-team addendum §A2 option (b) ('digested, measured clean') and §A6 row 4; BL-0155's own out-of-scope note (digested never re-measured clean)"
closes: "plugin/templates/shared/.claude/engines/pandacorp-build.js worktreeWorkFrom + collectGateEvidence + evidenceBlock; plugin/scripts/drift-proof.mjs probe lookup (commit 1d609548, branch gate-cost)"
links: [BL-0149, BL-0155, BL-0183, BL-0178]
---

## Problem
BL-0155 fixed `worktree-bootstrap.sh` for a NESTED project (Mission Control lives at
`<factory>/mission-control/` and shares the factory's `.git`), but `gateEvidence: 'digested'` was
still never measured clean (BL-0155 "Out of scope"; proposal 38 addendum A2(b): "n=2, both
contaminated"). Reading the whole path (`collectGateEvidence` → `validateEvidence`/`GateEvidenceFallback`
→ `evidenceBlock` → `gateFocusedStep`) and checking it against the live tree found four defects that
keep it broken on the real topology even after BL-0155:

1. **Wrong cwd.** `worktreeWorkFrom` told every gate-worktree agent "cd there FIRST … every relative path
   is relative to the worktree". The worktree checks out the WHOLE repo, so for MC its root is the
   factory: `ls <gate-worktree>/.pandacorp` → "No such file or directory"; node_modules exists only at
   `<gate-worktree>/mission-control/node_modules` (observed 2026-09-25 with `[ -e … ]`: root →
   NOT, nested → HAS). The collector's step 0 (`test -e node_modules/.bin/vitest`) was therefore
   evaluated one level too high.
2. **Alias-hijacked probe.** In the owner's shell `type test` → "test is an alias for npm test".
   Running the collector's literal step 0 in the gate worktree root executed `npm test -e …`, which
   walked up to the MAIN tree's `mission-control/package.json` and ran its whole vitest suite (450
   files / 7,811 tests, ~41 s) and exited 0 — a "bootstrapped" answer for a tree that is not. The rest
   of the engine already forbids shell `test`/`[` for the owner-stop probe (BL-0068); step 0 did not.
3. **Factory noise / empty patch.** Steps 2-3 ran `git diff <base>..<pin> --stat` and
   `git diff <base>..<pin> -- <artifacts>` from that root. On the canary-D2 range (`d9addc89..c575adfc`):
   the stat listed **301 files / 18,613 chars** (the factory's own commits) vs **54 files / 3,405
   chars** for the project; the artifact-scoped patch for WO-02-014 (`src/app/board/IdeaBoardView/**`)
   was **0 bytes** from the root vs 3,382 bytes from the project dir. The globs were also unquoted
   (bash expands them against the pin; zsh aborts "no matches found").
4. **Thin digest.** The pack had no list of the tests the cycle added/changed and the AC seed was an
   anonymous list (no WO → contract map).

`drift-proof.mjs` resolved a probe as `path.join(--source, p)` with `--source` = the worktree root: with
the reviewer now (correctly) in the project dir, a nested probe lives under `<source>/<prefix>/`.

## Root cause
The C2 worktree preamble assumed "worktree root = project root" — true for every sibling product repo,
false for the one nested project, which is exactly the topology digested had to be measured on.

## Fix plan (as shipped)
- `GATE_PROJECT_CD` = `cd "<gate-worktree>/$(git -C '<project>' rev-parse --show-prefix)"`, used by
  `worktreeWorkFrom` (collector, serial gate, split finders + closer); paths are project-relative.
- Collector step 0: `node -e "…existsSync('node_modules/.bin/vitest') ? 'BOOTSTRAPPED' : 'NOT-BOOTSTRAPPED'"`.
- Steps 2/3 `git diff --relative …`; artifact pathspecs `shellQuote`d; explanation outside the code span.
- New step 3b `tests` (`git diff --relative --name-only --diff-filter=AMR … | grep -E <test paths>`),
  `EVIDENCE_SCHEMA.tests`, rendered in ATTACHMENT 2; `reviewedAcText` labels each line `[wo-id]`.
- `drift-proof.mjs`: probe lookup `<source>/<prefix>/<p>` first, `<source>/<p>` fallback.
- Unchanged and re-asserted: digested still MUST re-run `verify.sh --since` after the adversarial tests
  (REV2-1) and run its own tests by path (BL-0183 `REVIEWER_TESTS_EXPLICIT`); fail-closed fallback intact.

## Tests (RED → GREEN)
- `test-pandacorp-build.mjs` `GC-L1a` (under `// ---- GATE-COST ----`): a REAL git repo with a nested
  project + a real gate worktree bootstrapped the BL-0155 way; the scenario EXECUTES the collector's own
  commands as the engine wrote them: the cd lands in `<wt>/mission-control`; step 0 prints BOOTSTRAPPED
  there and NOT-BOOTSTRAPPED at the root; the `--relative` stat has no factory files (the pre-fix stat
  did); the quoted patch returns the WO hunk (the pre-fix one was empty); 3b lists exactly the added test;
  the digested gate carries the test list, the mandatory re-run and the by-path run. 11 of its 19
  assertions are RED against the `main` engine (`4a15f4cc`), all GREEN after.
- `test-drift-proof.mjs`: 3 new checks (nested probe found with `--source` = repo root; it runs; flat
  fallback kept) — 2 RED before the `drift-proof.mjs` change, 36/36 after.
- Existing WP06a-h / REV2-1 / FIX2b-d unchanged and green.

## Done when
- [x] `GC-L1a` green; RED on the pre-fix engine.
- [x] `bash plugin/scripts/run-engine-tests.sh` → 27/27 suites.
- [x] MC engine copy byte-identical (`cmp`).

## Out of scope
- The plugin version bump/release (owner/orchestrator; `plugin-metadata.json` untouched here).
- The canary-E measurement of digested vs explore and flipping the default (addendum A5/A6 row 4).
- `ensureGateWorktree` step 1/3 still says "cd into it, run `bash .pandacorp/worktree-bootstrap.sh`"
  from the worktree root (for MC the script is under `mission-control/`); left to the gate-pool work
  that owns that function. Live evidence it worked at least once: `<gate-worktree>/mission-control/
  node_modules/.bin/vitest` exists.
- `applyGate`'s no-release fallback (`sourceDir = GATE_WORKTREE`, `<path>` from `testFiles`) keeps its
  pre-existing path ambiguity for nested projects (orchestration zone; the release path is unaffected).
