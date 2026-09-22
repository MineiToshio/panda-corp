---
id: BL-0155
type: bug
area: build-engine
title: "worktree-bootstrap.sh step 1 only checked package.json at the worktree root, so a NESTED project (Mission Control) never got its deps installed in a fresh gate worktree"
status: done
severity: p1
opened: 2026-09-23
closed: 2026-09-23
source: "canary B2 launch 2026-09-22 (canary-b2-report.md §1, §6(a), 'Tareas flageadas' item 3) — WP-06 digested gate on the REAL Mission Control topology, frd-25-canary-speed-sprint"
closes: "plugin/templates/shared/.pandacorp/worktree-bootstrap.sh step 1 (dependency install)"
links: [BL-0149]
---

## Problem
`plugin/templates/shared/.pandacorp/worktree-bootstrap.sh` step 1 (dependency install) checked
`[ -f package.json ]` — a bare, CWD-relative check, correct only when the project IS the worktree
root. Mission Control lives NESTED inside the factory's own repo (`panda-corp/mission-control/`,
sharing the factory's `.git` — the real production topology, and the one every prior canary (A, B)
happened NOT to exercise, since their fixture repos were flat). For a nested project, `package.json`
never exists at the worktree root, so this step silently installed NOTHING — exit 0, no error, no
`node_modules` anywhere the real project could use.

Impact (measured live, canary-b2-report.md §1/§6(a)): the C2 gate worktree (`ensureGateWorktree`,
BL-0149's own fix — which DOES run `.pandacorp/worktree-bootstrap.sh`, correctly) came up with no
`node_modules` for `mission-control/`. The WP-06 evidence collector (`evidence:frd-25`) correctly
detected this BEFORE touching `verify.sh` (BL-0149's own sanity gate, `test -e
node_modules/.bin/vitest`) and refused to fabricate a report: `{"report": null, "reason":
"gate-worktree-not-bootstrapped"}`, confirmed in `~/.claude/dashboard-events.ndjson` as a
`GateEvidenceFallback` event. The `gate` agent then had to `pnpm install --prefer-offline
--frozen-lockfile` BY HAND inside `gate-worktree/mission-control` to do its job at all — exactly the
expensive re-bootstrap `gateEvidence: 'digested'` exists to let the reviewer skip. Measured saving for
`gate`+`evidence` combined vs the `explore`-mode baseline dropped to **−20.04% time / −9.73% cost**
(canary-b2-report.md §2), far short of the ≥40% span-reduction bar the canary was checking. The
report's own verdict (§6(a)): *"BL-0149 (cerrado) no cubre el caso anidado — sigue roto para la
topología real de Mission Control."*

## Root cause
Step 1's check (`[ -f package.json ] && command -v pnpm ...`) is a relative path with no explicit
`cd` and no reference to the `$WORKTREE` variable the script computes at the top
(`git rev-parse --show-toplevel`). It silently assumed "the project IS the worktree root" — true for
every OTHER Pandacorp project (each is a sibling repo with its own `.git`, so its worktree root IS its
package root) but false for Mission Control, the one project that shares the factory's `.git` and
lives one level down. The script's OWN step 3 (`PANDACORP_FACTORY_ROOT` / `.env.local`) already had
the correct search pattern for this (`for APP_DIR in "$WORKTREE/mission-control" "$WORKTREE"; do if
[ -f "$APP_DIR/package.json" ]; ...`) — it was simply never applied to step 1, the step that actually
determines whether dependencies get installed at all.

## Fix plan
1. Added a new step 0 in `worktree-bootstrap.sh` that resolves `$APP_DIR` ONCE via the exact same
   `$WORKTREE/mission-control` → `$WORKTREE` search order step 3 already used, computed purely from
   `$WORKTREE` — never from the script's own invocation CWD, so the result is identical whether the
   caller `cd`s into the worktree root or into the nested project dir before running the script.
2. Step 1 now installs against `$APP_DIR` (`cd "$APP_DIR" && pnpm install ...`) and keys its BL-0149
   lockfile-sha idempotency marker under `$APP_DIR/node_modules/.pandacorp-lock-sha` instead of the
   worktree root's.
3. Step 3 refactored to reuse the SAME `$APP_DIR` (its own duplicate search loop removed) — one
   resolution, two consumers, no behavior change to step 3 itself.
4. No engine (`pandacorp-build.js`) change was needed: `ensureGateWorktree`'s prompt already runs
   `.pandacorp/worktree-bootstrap.sh` inside the worktree (BL-0149) — the bug was entirely inside the
   script's own path resolution, so fixing it there fixes every caller (the gate worktree, a manual
   `EnterWorktree`, `/pandacorp:change`'s implement-by-delegation worktree) without touching the
   engine or any launcher.

## Tests (prove the fix — TDD, RED → GREEN)
New suite `plugin/scripts/test-worktree-bootstrap.sh` (registered in `run-engine-tests.sh`'s
`EXPLICIT_SH_SUITES` — none existed before this item, flagged as a possible follow-up in BL-0149's own
"Out of scope"). Exercises the REAL script against a REAL git worktree (`git worktree add --detach`)
with a fake `pnpm` on PATH (no network, records each invocation's cwd) — never a reimplementation:
- **(a1)** nested topology, invoked from the worktree ROOT (`bash mission-control/.pandacorp/worktree-bootstrap.sh`) — `node_modules` lands in `mission-control/`, not the root; pnpm ran with cwd = the nested dir; step 3's `.env.local` still lands correctly (no regression from the `$APP_DIR` reuse refactor).
- **(a2)** same nested topology, invoked from WITHIN the nested dir (`cd mission-control && bash .pandacorp/worktree-bootstrap.sh`) — identical result, proving the fix is CWD-independent (not a lucky caller `cd` order).
- **(b)** non-nested topology (package.json at the worktree root, a normal product project's own repo) — unchanged behavior, no regression.
- **(c)/(c2)** idempotency: a second bootstrap with an unchanged lockfile skips reinstalling (still 1 pnpm call); a changed lockfile DOES trigger a real reinstall (2 calls) — the BL-0149 guard still works under `$APP_DIR`.

Confirmed RED against the pre-fix script: 3 of 18 assertions failed (the (a1) worktree-root nested
invocation — `node_modules` in the wrong place, pnpm never ran, `.env.local` wrong), exactly the
canary's confirmed defect; (a2)/(b)/(c) already passed by accident on the old script, which is itself
informative (the bug only bites for the worktree-root invocation the engine's own prompt literally
describes — "cd into it, run bash .pandacorp/worktree-bootstrap.sh"). GREEN (18/18) after the fix.
`bash plugin/scripts/run-engine-tests.sh` — 23/23 suites (was 22), run twice, 0 failures both times.

## Done when
- [x] `test-worktree-bootstrap.sh` is green (18/18), confirmed RED (3/18 failing) against the pre-fix script.
- [x] `bash plugin/scripts/run-engine-tests.sh` green, run twice (23/23 suites both times).
- [x] `mission-control/.pandacorp/worktree-bootstrap.sh` re-synced byte-identical to the template (`cmp` confirmed) and `mission-control/.pandacorp/status.yaml`'s `overlay_version` bumped to match.
- [x] `claude plugin validate plugin/` passes.

## Out of scope
Re-measuring canary B2's `digested` A/B numbers with this fix applied (its own recommendation, §6(a):
"volver a medir con un run realmente limpio antes de decidir el default") — a separate live canary
run, not part of this item's closeable scope.
