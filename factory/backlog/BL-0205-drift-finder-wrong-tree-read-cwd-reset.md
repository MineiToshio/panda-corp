---
id: BL-0205
type: bug
area: build-engine
title: "the whole-FRD drift finder audits the factory main checkout instead of its pinned gate worktree because Bash cwd resets between subagent tool calls"
status: open
severity: p1
opened: 2026-09-26
closed:
source: "docs/reviews/canary-f2-report.md §4.2 (canary F2, wf_8bab7752-702)"
closes:
links: [BL-0201, BL-0203, LESSON-0125]
---

## Problem
Two of canary F2's four `find:drift` finders (BL-0203) read the wrong tree. Each finder is told to `cd`
into its pinned gate-worktree slot before it starts, and it does so on its FIRST Bash call — but a
subagent's Bash tool resets the working directory between separate tool calls, so every LATER call
without an explicit `cd` prefix silently runs from the launching session's own cwd
(`/Users/Shared/Proyectos/panda-corp/mission-control`, the factory's `main` checkout, where later fixes
have already landed), not the pin (`7b44a772`) it was supposed to audit.

Measured carry-through of the slot path across Bash calls (`docs/reviews/canary-f2-report.md` §4.2 table):

| Finder | Bash calls with the slot path |
|---|---:|
| FRD-02 | 50 / 50 |
| FRD-03 | **2 / 42** |
| FRD-04 | **1 / 13** |
| FRD-05 | 25 / 26 |

Concretely: FRD-03's finder `cat src/lib/portfolio/formatLastSync.ts` returned a copy containing
`isRealCalendarDay`/`ISO_DATE_TIME` — helpers that exist on `main` (commit `0ecdc144`, not an ancestor of
the pin) but not in `git show 7b44a772:…/formatLastSync.ts` (`Date.parse` + `Number.isNaN` only). FRD-04's
finder listed `ChangesPanel.relativeDate.reviewer.test.tsx`, present on `main`, 0 matches in
`git ls-tree 7b44a772`. Both finders then reported the already-fixed validators as `implemented` — **2
false negatives** (canary defects #3 and #5), the dangerous class the finder's own directive calls out
("a false `implemented` hides the defect"). The opus judge caught both independently in this run, so
nothing shipped wrong, but the finder's report was not trustworthy evidence.

## Root cause
The finder's directive tells it to `cd` into the pinned slot as its first action, but nothing re-asserts
or re-verifies the cwd on every subsequent call, and a subagent's Bash tool does not persist cwd across
separate invocations (each call starts from the harness's own default directory). A finder that spends
most of its tool budget on grep/cat calls without its own `cd <slot-path> &&` prefix silently drifts back
to whatever tree the harness defaults to.

## Fix plan
- `plugin/agents/drift-finder.md`'s `DRIFT_FINDER_START`/`END` block (regenerated into
  `plugin/runtime/engine/pandacorp-build.src.js`'s `DRIFT_FINDER_DIRECTIVE` via
  `generate-build-prompt-fragments.mjs`): instruct the finder to prefix EVERY shell command with the
  pinned worktree's absolute path (e.g. `cd <slot-path> && <command>`, never a bare command relying on a
  prior `cd` to have stuck), and to treat this as non-negotiable — never assume the shell remembers where
  it was.
- Add a first-call, and periodic, self-check: run `git rev-parse HEAD` prefixed the same way and confirm
  it equals the pin the engine gave it before trusting any subsequent read; if it does not match, stop and
  report the mismatch rather than continuing to read the wrong tree.
- Engine-side backstop (`plugin/runtime/engine/pandacorp-build.src.js`, `startDriftFinder`/
  `validateDriftFinding`): have the finder report the `HEAD` it actually observed (a new `headSha` field on
  its schema/return), and have the engine discard (or flag `unknown`, never `implemented`/`drift`) any
  contract whose reported `headSha` does not match the gate's pin — never merge a claim proven against the
  wrong commit.

## Tests (prove the fix — TDD, RED → GREEN)
- A `drift-finder` prompt-fragment unit assertion (in the existing prompt-fragment generation test, or a
  new one alongside `plugin/scripts/generate-build-prompt-fragments.mjs`) that the generated
  `DRIFT_FINDER_DIRECTIVE` text requires an explicit `cd <path> &&` (or equivalent) prefix on every command
  and a `git rev-parse HEAD` self-check.
- An engine unit test (`plugin/scripts/test-pandacorp-build.mjs` or the whole-FRD-gate contract test) that
  feeds `validateDriftFinding` a finding whose `headSha` does not match the gate's pin and asserts it is
  discarded/marked `unknown`, never merged as `implemented`/`drift`.
- A gate canary (`verify.sh --canary`, DR-079) is not applicable here (this is a prompt/engine-contract
  fix, not a code path `verify.sh` itself exercises) — the unit tests above are the oracle.

## Done when
- [ ] `DRIFT_FINDER_DIRECTIVE` (generated) requires the per-command `cd`/`HEAD` self-check.
- [ ] The engine discards/downgrades a finder claim whose reported `headSha` mismatches the gate's pin.
- [ ] `bash plugin/scripts/run-engine-tests.sh` and `node plugin/scripts/test-engine-artifact.mjs` green
      with the new assertions.
- [ ] Re-measured in a future finder canary (held-out defect set, see BL-0201's closing note on
      contamination) with 0 wrong-tree reads.

## Out of scope
- Fixing the harness's own Bash-cwd-reset behavior (Claude Code's own tool contract, not this repo's to
  change) — the fix is making the finder's own prompt/engine robust to it, not asking the harness to
  persist cwd.
