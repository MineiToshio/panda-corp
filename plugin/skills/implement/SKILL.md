---
name: implement
description: Build or resume any feature, change or bug through the runtime-neutral Pandacorp CLI. Use inside a project after architecture, or for a scoped change to an existing project.
---

# /pandacorp:implement

**The single entry for building and resuming.** Claude Code and Codex use the same
`plugin/scripts/pandacorp-build.mjs` engine. No engine keyword or execution-mode choice
is needed. The CLI owns scope detection, planning, admission, routing, review, governed
state transitions and landing; the session converses and relays the work it returns.

Read and follow `references/engine-v2.md` in order, together with
`references/autonomy.md` and `references/drive.md`. Policy lives in
`factory/standards/build-engine.md` (BUILD-7..15); exact commands, flags, JSON and exits
live in `plugin/docs/build-engine-cli.md`. Resolve the factory path from the project's
`.pandacorp/guide.md`; Claude Code may use `${CLAUDE_PLUGIN_ROOT}` for the installed plugin.

## Project and ownership preflight

- Confirm `.pandacorp/status.yaml` exists; otherwise stop and route an existing project
  to `/pandacorp:adopt`, or a new idea to `/pandacorp:spec` (DR-045).
- If `overlay_version` is behind `plugin/templates/OVERLAY_VERSION`, run
  `/pandacorp:upgrade` first (DR-048), only after verifying no live build owns the project.
  Never mix plugin versions on one project: after a plugin update, restart or close all
  sessions working on it before continuing.
- Use the CLI's detect and preflight checks. ACTIVE blueprints must have passed readiness,
  grounding and consistency gates, work orders must be ACTIVE, and ACTIVE docs must have
  no `NEEDS CLARIFICATION` markers. Missing evidence routes back to architecture.
- The fenced lease is authoritative. Never reset `running`, edit state or reclaim a live
  foreign run by hand. Resume only through the CLI and its ownership checks.

## Scope and the first minute

"Impleméntalo" builds only the behavior ordered in this conversation, captured in a
cited scope card. A named card or FRD targets that scope; a bare invocation builds the
pending plan. The CLI selects the first matching detection row. It never drains other
cards into this run. "Anótalo" creates a `draft` card and validates it with `card check`,
then stops without a build. The cards are a file format, not another entry command.

Send the first-minute message from `references/autonomy.md`, using preflight evidence
and its stated defaults. Later doubts follow sources, consultation and parking; one
blocked unit does not stop independent work. Human gates remain binding. A production
landing requires the owner's explicit order; the engine never grants itself permission.

## Adaptive resources and performance

Follow **BUILD-9** for the adaptive concurrency ladder, admission constants and calibration.
The ladder is `[1, 2, 3, 5, 8]`, initially 5 unless recent performance recommends lower;
8 requires journal evidence of sustained 5 without scale-downs. Memory and sustained swap
growth lower concurrency, critical pressure lowers it to 1, and stable recovery raises
it again. Swap use alone is not a reason to stop. Dispatch only what `next` admits;
never replace the controller with a machine-specific agent limit.

Before allocating a new worktree the CLI reserves 1.5 GiB and requires 15 GiB still free
on the project's volume. `wait` with reason `disk` holds new allocations while existing
work continues. Report the reason and continue the loop; never delete owner state to
free space. Bootstrap and merge-queue enforce their own disk checks.

Each run records workers, RAM, swap, scaling, unit timings and disk in the host-local
performance journal `~/.pandacorp/host/perf/journal.jsonl` (or the configured host path).
The CLI writes it and uses recent runs to tune admission; the session reports observed
results and warnings, never fabricates calibration evidence. Hardware details belong
in the owner's personal profile, not in this skill.

## Execution, verification and landing

The session follows the CLI's `next` loop, dispatches exactly its model/effort and files
reports through the fenced commands. Continue in the active session when scheduling
is unavailable; claim background continuity only after observing a working mechanism.
Do not bypass independent review, deterministic gates or the three-execution budget.
Only build and patch units spend that budget; a red gate patches the attributed failing
scope, preserving healthy work. See BUILD-15 and the CLI reference for fallback behavior.

Every tracked run change is a CLI commit on `lane/<run_id>/integration`. Merge-queue
is the only path to `main`. Never write tracked files in the main checkout, push, edit
frontmatter/state manually, or set `PANDACORP_OWNER_RELEASE_OK` without the owner's order.
Service work follows DR-134 and `factory/standards/external-services.md`: reconcile actual
accounts/resources, preserve environment values and keep admin credentials out of runtime.

## Close-out and cleanup (CONV-21 / DR-145)

Use `finish` or the terminal action's summary, then follow the cleanup procedure in
`references/engine-v2.md` §8 and `../worktrees/SKILL.md` §Implementation teardown.
The engine removes eligible finished-run worktrees immediately and keeps branches;
`waiting_gate` retains the integration worktree needed for the owner's landing order.
Verify the resulting worktree inventory and report retained paths and reasons. Never
force-remove dirty, locked, live or process-cwd worktrees, or bulk-clean `.pandacorp/`.

For session-owned resources, register them before dispatch, restore the actual session
cwd, run `session-cleanup.mjs finish` and await its exit. Remove only named, eligible
scratch paths created by this session. A timeout is not successful cleanup.

The final report uses verified CLI results: owner questions/gates, autonomous decisions,
parked work, landed work versus work waiting on its branch, review status, quota and
cleanup/performance warnings. Capture lessons and leave an actionable explanation for
anything retained or unverified.
