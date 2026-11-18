---
id: BL-0328
type: bug
area: build-engine
title: "Fix v2 build engine failure in drive: git --literal-pathspecs failed (exit 1) in <project>/.pandacorp/run/build/wt/u-build-wo-12"
status: done
severity: p1
opened: 2026-11-16
closed: 2026-11-18
source: "pandacorp-build engine failure, run br-2026-11-16-01"
closes: "Plugin 10.13.7 fix (plugin/runtime/build/reportFiles.mjs); the resumed run br-2026-11-16-01 (same run id) completed to run_finished on 2026-11-18T05:30:47Z"
links: [DR-103]
---

## Problem
The v2 build engine stopped itself at a safe point (exit 8). Command: `drive`, step: `loop`. The fault confirmed itself, so the rebuild-state retry was skipped (journal seq 159: retried:false).
Error code: `INVALID_STATE`. Message: git --literal-pathspecs failed (exit 1) in <project>/.pandacorp/run/build/wt/u-build-wo-12-003: The following paths are ignored by one of your .gitignore files:
```
Error: git --literal-pathspecs failed (exit 1) in <project>/.pandacorp/run/build/wt/u-build-wo-12-003: The following paths are ignored by one of your .gitignore files:
    at err (file:///Users/Shared/Proyectos/panda-corp/plugin/runtime/build/units/common.mjs:3:65)
    at git (file:///Users/Shared/Proyectos/panda-corp/plugin/runtime/build/units/git.mjs:37:11)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
    at async evaluateDone (file:///Users/Shared/Proyectos/panda-corp/plugin/runtime/build/report.mjs:288:3)
    at async evaluate (file:///Users/Shared/Proyectos/panda-corp/plugin/runtime/build/report.mjs:331:19)
    at async fencedTwoPhase (file:///Users/Shared/Proyectos/panda-corp/plugin/runtime/build/state.mjs:198:25)
    at async ingestReport (file:///Users/Shared/Proyectos/panda-corp/plugin/runtime/build/report.mjs:479:15)
```
Run `br-2026-11-16-01`, epoch 42. The product work is preserved on the run's integration branch `lane/br-2026-11-16-01/integration`; the run is resumable once this is fixed. This failure consumed no unit attempt.

## Root cause
Confirmed read-only against the incident worktree and journal on 2026-11-16:

- Exact path: `src/lib/coverage/cachedCoverage.ts`, declared at
  `.pandacorp/run/build/units/u-build-wo-12-003/report.json:29`. `git ls-tree HEAD -- <path>` returns
  tracked blob `7f2b853324518a03806a8910f3be7cdf70b1fb48`; status and cached diff both show `M`.
  This is a modified tracked source file, not a new ignored file or bootstrap output.
- `git check-ignore -v --no-index -- <path>` returns `.gitignore:54:coverage/`. Plain check-ignore
  returns 1 because it normally suppresses tracked files; `--no-index` is necessary for this diagnosis.
  The unanchored directory pattern reaches `src/lib/coverage/` as well as root test output.
- The worktree's `docs/frds/frd-12-web-performance/work-orders/wo-12-003-public-shell-proxy.md:16`
  explicitly authorizes `src/lib/coverage/**`. The report's modification is therefore in scope.
  BL-0327 amended other artifacts; `scope_revision:a7133d05` supplies that amended allowlist.
- Pre-fix factory `plugin/runtime/build/report.mjs:288` used literal `git add -A -- ...files` for
  tracked and new paths together. Git rejects this explicit tracked path under the ignored directory,
  after staging other paths; `units/git.mjs:37` turns the nonzero exit into INVALID_STATE.
  Journal seq 158 records the finished worker, seq 159 the engine failure; no report_received or unit
  commit followed. Bootstrap's `.claude/launch.json` and `e2e/server-env.json` remain unstaged and
  excluded by the existing provenance rule (BL-0318).
- Why earlier commits worked: `ee5a7542` originally committed this source file and anchored the rule
  to `/coverage/`; `abdfd612` later reintroduced unanchored `coverage/` (confirmed by blame/history).
  The previous successful engine commits, including `2af12e45` and scope repair `a7133d05`, do not
  modify this path. The first report of this run to stage it explicitly trips the latent ignore trap.

## Fix plan
1. Reproduce with the journal of the failed run and a fixture of the same shape.
2. Fix the module in `plugin/runtime/build/` named by the stack; keep the failure policy intact (BUILD-15).
3. PATCH or MINOR plugin release; the owner resumes the SAME `run_id` with `/pandacorp:implement --resume`.

## Tests (prove the fix, RED then GREEN)
A regression case in the matching `plugin/scripts/test-build-v2-*.mjs` suite that fails with this error before the fix and passes after, plus a resume of the interrupted run.

## Done when
- The regression test is green and the engine suite passes.
- The plugin version is bumped and the failed run resumes to completion.

## Implementation and verification (2026-11-16)

Factory fix implemented in `plugin/runtime/build/reportFiles.mjs`, called by `report.mjs`:
HEAD provenance and index membership are separate; tracked ignored updates use literal `add -u`,
staged deletions need no add, and `rm --cached` with a remaining file is rejected as inconsistent.
New ignored report paths need an exact pinned WO artifact; only those regular files use bounded `-f`.
Broad globs, docs/tests implicit permissions and pre-staging cannot authorize forced output.
Sensitive paths (`.env*`, secrets/credentials, key containers), unsafe parents and directories are rejected
before G1 through the normal worker-attempt policy, without engine_failure. Ignore rules remain intact.

The fixture `plugin/scripts/fixtures/build-v2/ignored-tracked.json` captures the real path, ignore
rules, original/reintroduced-rule history, artifact scope and bootstrap neighbors. Before the fix,
`TMPDIR=/private/tmp node plugin/scripts/test-build-v2-report.mjs` produced **49 passed, 5 failed**,
including the exact tracked-ignore git error. Final report regression: **61 passed, 0 failed**,
including seven independently authored adversarial checks (staged deletion, index removal, nested
literal paths, bounded nested force, directory and symlink shapes). Final verification on the completed code (all with `TMPDIR=/private/tmp`):

| Command | Result |
| --- | --- |
| `node plugin/scripts/test-build-v2-report.mjs` | 61 passed, 0 failed |
| `node plugin/scripts/test-build-v2-scope.mjs` | 9 passed, 0 failed |
| `node plugin/scripts/test-build-v2-next.mjs` | 68 passed, 0 failed |
| `node plugin/scripts/test-build-v2-drive.mjs` | 45 passed, 0 failed |
| `node plugin/scripts/test-build-v2-cli.mjs` | 36 passed, 0 failed |
| `node plugin/scripts/test-build-v2-e2e.mjs` | 115 passed, 0 failed |
| `node plugin/scripts/test-build-v2-nested.mjs` | 9 passed, 0 failed |
| `node node_modules/vitest/vitest.mjs run src/app/manual/_tests/day1-engine.test.tsx src/app/manual/_tests/manualPages.builder.test.tsx` (cwd mission-control) | 2 files, 6 tests passed |
| `node_modules/.bin/biome check src/app/manual/_components/DesatendidaDetail.tsx` (cwd mission-control) | 1 file, no fixes |
| `node plugin/scripts/generate-plugin-manifests.mjs` | exit 0; PATCH 10.13.7 in both manifests |
| `bash plugin/scripts/check-derived-drift.sh /Users/Shared/Proyectos/panda-corp` | exit 0 |
| `bash plugin/scripts/validate-backlog.sh` | 322 items valid |
| `node --check plugin/runtime/build/reportFiles.mjs` and `node --check plugin/runtime/build/report.mjs` | exit 0 |
| `GIT_OPTIONAL_LOCKS=0 git diff --check` | exit 0 |

Independent reviewer reran report tests and added seven adversarial cases; the coordinator then reran
all relevant suites on the completed helper. The derived-drift gate also refreshed its managed
`.pandacorp/run/derived-drift-last-ok.json` cache. No temporary evidence logs are needed after these
results were recorded.

The working tree contains the reviewable changes only: no factory add/commit/worktree creation, no
write to funko-tracker, no plugin installation/update. All Git mutations exercised by tests occur only
in their own disposable `/private/tmp` fixtures. The automatic runtime control rejected
`claude plugin validate plugin/` (Codex may not dispatch/steer Claude); generator and derived-drift
validation succeeded instead. `pnpm exec` initially could not write its package-manager lockfile;
installed Vitest/Biome binaries were then used directly and passed.

## Exact coordinator continuation (not executed here)

Observed: run `stopped`, epoch 42; `u-build-wo-12-003` remains **running**, attempt 1, not reported.
Its recorded CLI worker `w-br-2026-11-16-01-u-build-wo-12-003-d98158d4f` has exit 0 and a sealed
result (`peekWorker`: state exited, sealed true). Resume adopts it and reopens its harvest job; drive
then re-ingests the preserved result with its original unit token and commits the staged work.
There is no need for unblock, scope-repair, token replacement, manual report or state edits.

Execute only in the Claude coordinator session using this updated factory CLI consistently:

```bash
set -euo pipefail
CLI=/Users/Shared/Proyectos/panda-corp/plugin/scripts/pandacorp-build.mjs
PROJECT=/Users/Shared/Proyectos/funko-tracker
EPOCH=$(node "$CLI" start --resume --project "$PROJECT" --coordinator claude --session-model opus | python3 -c 'import json,sys; r=json.load(sys.stdin); assert r.get("run_id")=="br-2026-11-16-01",r; assert r.get("drive",{}).get("armed"),r; assert "u-build-wo-12-003" in r.get("reattached",[]),r; print(r["epoch"])')
node "$CLI" handoff --project "$PROJECT" --epoch "$EPOCH" --reason manual
```

Do not pass `--run`: this run is still in build/, not an archived/suspended directory. Use the returned
new epoch, not 42. The assertions stop before handoff if adoption/arming does not match the observed
state; inspect the output rather than resetting or cleaning anything. If CONTENDED, let the prior
drive yield and retry the same resume command. No production permission is granted by these commands.

## Acceptance still pending

Status remains `doing`: the original Done-when requires the real interrupted run to complete, and the
owner explicitly restricted that project to read-only work in this task. Close only after the coordinator
executes the continuation and verifies the live result. The factory fix and automated evidence are ready;
the real continuation and `claude plugin validate plugin/` remain unexecuted.

## Closed (2026-11-18, observed during a funko-tracker harvest sweep)

Read-only observation of `funko-tracker/.pandacorp/run/build/journal.jsonl`: at `2026-11-16T17:05:54Z`
a `run_resumed` event (`from: stopped`) **reattached and adopted `u-build-wo-12-003`** — exactly the WO
this failure blocked — on the SAME `run_id` (`br-2026-11-16-01`), confirming the continuation command
above was executed and worked. The run continued through further resumes and finished cleanly:
`2026-11-18T05:30:47Z run_finished {status: finished}`. `docs/frds/frd-12-web-performance/work-orders/
wo-12-003-public-shell-proxy.md` now carries `implementation_status: VERIFIED`. The original Done-when
criterion ("the failed run resumes to completion") is met. No write was made to funko-tracker or its git
history to produce or observe this evidence — the project's own subsequent commits already record it.
`claude plugin validate plugin/` remains unexecuted but is not load-bearing for this closure (the
derived-drift/manifest checks already recorded above cover plugin-side correctness).
