# Implementation cleanup audit — 2026-11-05

## Evidence and root cause

The owner reported 17 GiB free, 17 GB in five PandaTrack worktrees and about 3.5 GB of session temporary files. These historical sizes are owner evidence, not current measurements. No real checkout, cache or temporary directory was deleted during this change. Only disposable test fixtures are removed by tests.

Live source inspection found:
- DR-135 and `plugin/scripts/worktree-sweep.mjs` provide an explicit sweep, with a three-hour activity hold. They were not a universal implementation close-out.
- `plugin/templates/shared/.pandacorp/merge-queue.sh` intentionally retained the invoking cwd and delegated deletion to ExitWorktree. Its fallback and pending-work output used `--force` / `branch -D`, which could discard dirty/unmerged work. Those recommendations are replaced.
- `implement` protects gate-worktree crash evidence; build-owned state must stay protected. `implement-backlog` prescribed cleanup only after a successful merge. Neither provided a shared session-owned temporary-resource teardown.
- `plugin/scripts/launch-implement.sh` and DR-142 already distinguish full worker access from workspace-write: sandbox workers cannot commit in the shared `.git`. The current session permission profile makes `.git` read-only and forbids escalation. Policy cannot grant an OS/sandbox capability. This session does not attempt a real git write, commit, merge or deletion.
- The factory `.claude/settings.json` denies raw `rm -rf`; `block-dangerous.sh` additionally protects owner state, locked worktrees and deployments. These protections remain armed. A dedicated validated CLI avoids raw destructive shell commands; it does not bypass runtime approval/sandbox enforcement.
- The old sweep used synchronous subprocesses. Large recursive deletion can outlive a tool call. The new remover is asynchronous, reports each start, and must be polled to process exit; a tool yield is not success.
- Parallel worktrees exist (inventory below). A glob, basename or merged tip alone is not ownership proof. Automatic cleanup targets only a receipt registered by the creating coordinator, after writers stop.

## Resulting contract

DR-145 / BUILD-5: automatic permanent teardown after merge, without a new owner prompt, only for session-owned registered worktrees that pass live ancestry, clean status and all hard safety checks. Includes ignored node_modules/.next and generated caches by removing the full worktree through Git without force. No branch force-deletion. Bootstrap records hashes of exact launch/env outputs it generates; an unchanged generated output is disposable, while unregistered private files or later edits remain protected. Cwd, processes, Git locks, owner state, deployments, nested worktrees and live builds retain their protections. Unsafe resources are listed and left in place.

`session-cleanup.mjs run` allocates a unique owned temporary root, exports TMPDIR and a private npm cache, waits for the command, then calls finish in finally. Worktree creation must register the target before dispatch. For tool-driven workflows, create/register/finish is the explicit coordinator protocol. Existing unregistered temporary clones/caches are never guessed or swept: repository copies inside artifacts block removal and are reported. Use registered temporary worktrees for future repo copies. A failed/remnant cleanup exits nonzero and retains the receipt for retry.

This checkout ships templates and a compatible overlay version; existing projects receive the change on their normal safe-point upgrade. No live project overlay, installed plugin, sandbox privilege or other session was modified. The factory and overlay settings add only an exact cleanup-CLI allow rule while retaining all denies. This session cannot prove production cleanup under an unrestricted coordinator; tests exercise real disposable Git repositories instead.

## Read-only inventory

Commands: `git --no-optional-locks -C <repo> worktree list --porcelain`, `git --no-optional-locks -C <path> symbolic-ref --short HEAD`, `git --no-optional-locks -C <path> merge-base --is-ancestor HEAD main`, `git --no-optional-locks -C <path> status --porcelain --untracked-files=normal`, `du -sh <path>`.
Scope: `/Users/Shared/Proyectos/*-wt-*`, children of `*-wt/`, plus all entries registered in panda-corp and funko-tracker. No PandaTrack worktree matched at capture time. Sizes are rounded du output; parent totals include nested worktrees, so do not sum them. Dirty means tracked/untracked Git changes; ignored caches are not dirty. Base is local main, without fetching. Branch/ancestry/status and du were re-read after implementation edits; panda-corp main is dirty from this change. Other checkouts can continue changing in parallel.

| Path | Branch | Ancestor of main | Dirty | du -sh |
|---|---|---|---|---|
| /Users/Shared/Proyectos/funko-tracker | main | yes | no | 11G |
| /Users/Shared/Proyectos/funko-tracker-wt-cpu-catalog | perf/cpu-catalog | no | no | 1.6G |
| /Users/Shared/Proyectos/funko-tracker-wt-cpu-config | perf/cpu-config | no | no | 1.8G |
| /Users/Shared/Proyectos/funko-tracker-wt-cpu-export | perf/cpu-export | no | no | 1.6G |
| /Users/Shared/Proyectos/funko-tracker-wt-cpu-session | perf/cpu-session | no | no | 2.6G |
| /Users/Shared/Proyectos/funko-tracker/.claude/worktrees/ingest-parallel | chore/ingest-parallel-photos | no | no | 1.8G |
| /Users/Shared/Proyectos/panda-corp | main | yes | yes | 9.6G |
| /Users/Shared/Proyectos/panda-corp-wt-ci | fix/engine-tests-ci | yes | no | 1.2G |
| /Users/Shared/Proyectos/panda-corp-wt-verify-affected | feat/verify-affected-browser-gates | no | no | 413M |
| /Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/run/gate-worktree | detached@df384e69 | yes | no | 700M |
| /Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/run/gate-worktree-1 | detached@d174599d | yes | no | 1.7G |
| /Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/run/lanes/lane-1 | lane/c-wo-02-019 | no | no | 1.5G |
| /Users/Shared/Proyectos/panda-corp/mission-control/.pandacorp/run/lanes/lane-2 | lane/c-wo-04-013 | no | no | 1.6G |
| /Users/Shared/local-deployments/panda-corp | detached@5c5cdd20 | yes | no | 1.5G |

The deployed panda-corp worktree is explicitly locked (LIVE DEPLOY on :1987) and must remain. The `.pandacorp/run` entries hold engine state and are not automatic session cleanup targets. All listed worktrees were left intact.

## Proposed commit

`fix(backlog): BL-0304 — reclaim merged session worktrees and temporary artifacts safely`


## Changed files (uncommitted)

- `.claude/engines/pandacorp-backlog.js`
- `.claude/settings.json`
- `.github/workflows/factory-engine-tests.yml`
- `.gitignore`
- `docs/research/worktree-cleanup-2026-11-05.md`
- `factory/backlog/BL-0304-session-resource-cleanup.md`
- `factory/decision-log.md`
- `factory/decisions/registry.yaml`
- `factory/standards/build-orchestration.md`
- `factory/standards/rule-registry.md`
- `mission-control/content/manual/guides/g-batch-integration.md`
- `plugin/.claude-plugin/plugin.json`
- `plugin/.codex-plugin/plugin.json`
- `plugin/docs/decision-log.md`
- `plugin/docs/engine-tests.md`
- `plugin/runtime/plugin-metadata.json`
- `plugin/scripts/session-cleanup.mjs`
- `plugin/scripts/test-pandacorp-backlog.mjs`
- `plugin/scripts/test-session-cleanup-adversarial.mjs`
- `plugin/scripts/test-session-cleanup.mjs`
- `plugin/scripts/worktree-sweep.mjs`
- `plugin/skills/architecture/SKILL.md`
- `plugin/skills/change/SKILL.md`
- `plugin/skills/change/references/now-mode.md`
- `plugin/skills/implement-backlog/SKILL.md`
- `plugin/skills/implement/SKILL.md`
- `plugin/skills/upgrade/SKILL.md`
- `plugin/skills/worktrees/SKILL.md`
- `plugin/templates/OVERLAY_VERSION`
- `plugin/templates/rules/quality-and-testing.md`
- `plugin/templates/shared/.claude/settings.json`
- `plugin/templates/shared/.pandacorp/guide.md.tpl`
- `plugin/templates/shared/.pandacorp/merge-queue.sh`
- `plugin/templates/shared/.pandacorp/pending-work.sh`
- `plugin/templates/shared/.pandacorp/session-cleanup.sh`
- `plugin/templates/shared/.pandacorp/worktree-bootstrap.sh`
- `plugin/templates/shared/AGENTS.md.tpl`

Personal, gitignored files also updated in Spanish: `factory/profile.md` (standing preference) and `factory/memory/_inbox.md` (same-turn owner-stated incident). No secrets are read or printed by the cleanup receipt; generated-file receipts hold hashes only.

## Verification and limits

- `node plugin/scripts/test-session-cleanup.mjs`: 20 passed, 0 failed, including the real overlay bootstrap and transport creating a receipt without a manual register call and reclaiming a complete merged worktree.
- `node plugin/scripts/test-session-cleanup-adversarial.mjs`: 14/14 passed against final output-hash and hidden-change source (exit 0, independently rerun and also executed by the parent). Covers native shell argv boundaries from the actual backlog engine, failed process inventory, receipt identity replacement, repository copies/bare repos, ignored private files, active processes, generated-output path boundaries and tracked changes hidden by index flags.
- `node plugin/scripts/test-worktree-sweep.mjs`: 41 passed, 0 failed.
- `node plugin/scripts/test-pandacorp-backlog.mjs`: 35 passed, 0 failed. The seam now uses real cleanup for newly owned worktrees, retains branch refs and reports cleanup debt for reused worktrees without a new receipt; blocked results preserve receipts.
- `bash plugin/scripts/test-worktree-bootstrap.sh`: 51 passed, 0 failed against final output-hash wiring (exit 0).
- `bash plugin/scripts/test-block-dangerous.sh`: 157 passed, 0 failed; `bash plugin/scripts/test-batch-integration.sh`: passed both real Git integration scenarios.
- `bash factory/standards/check-standards.sh`: exit 0, 32 standards, 180 rules. `bash plugin/scripts/validate-backlog.sh`: exit 0, 298 valid items. BL-0304 remains doing because the full acceptance gate is not green in this environment.
- `bash plugin/scripts/check-derived-drift.sh`, `git diff --check` and Bash syntax checks: exit 0.
- `node plugin/scripts/generate-plugin-manifests.mjs`: exit 0; both manifests project plugin 9.150.0. `claude plugin validate plugin/`: first run passed; a later repeat was rejected by automatic approval review ("Codex may not dispatch or steer the Claude runtime"). No bypass was attempted.
- `bash plugin/scripts/run-engine-tests.sh`: **51 suites passed, 5 failed (56 total), exit 1**. Failures: test-build-mech-lanes.mjs, test-codex-enforcement.mjs, test-codex-unattended.mjs, test-prod-smoke.mjs and test-serve-once.sh. Logs show EPERM writing `.codex` projections, `spawnSync ps EPERM` and `listen EPERM 127.0.0.1`; port allocation independently returned `no free lane port in 4100..4199`. This full run preceded final focused test/wiring refinements and is not claimed as final-source green.
- `bash plugin/scripts/test-merge-queue-release-gate.sh`: **73 passed, 4 failed**, identical on retry. Its real TCP listener cannot bind (`PermissionError: Operation not permitted`), so the busy-port scenario cannot prove exit 14. The test was not relaxed or skipped.

Full acceptance is blocked by the current runtime. No red result is called done. Re-run the full engine corpus, the real-port merge queue suite and the final native plugin validation in a capable runtime before closing BL-0304; then commit the proposed change, update/restart the installed plugin and propagate overlay 8.118.0 at normal safe points. The three currently active Mission Control overlay replicas still have old guidance and were deliberately not rewritten under another session; the canonical templates/skills are ready for upgrade. Tracked files with changes hidden by assume-unchanged/skip-worktree are independently compared with HEAD and kept. Projects that bootstrap tracked launch/e2e overrides must first normalize their own verified reproducible outputs through their gated flow; this cleanup does not silently discard those tracked changes. Exact command allow rules are installed in source, but effective native approval matching is not certified by this sandbox.

No real multi-gigabyte removal, installed plugin activation, or other runtime's effective privileges was certified here.
