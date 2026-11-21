---
name: implement
description: Build or resume any feature, change or bug through the runtime-neutral Pandacorp CLI. Use inside a project after architecture, or for a scoped change to an existing project.
---

# /pandacorp:implement

**Queue completion (DR-165 phase 1).** The recipe is commit → `bash .pandacorp/merge-queue.sh`.
Plain `verify.sh` is diagnosis. Until the queue certifies the current rebased tree, report
`implemented-uncertified` ("implementado, sin certificar"). Read `bash .pandacorp/merge-queue.sh --status`:
`certified-awaiting-order` ("certificado, espera tu orden", exit 21 with matching stamp/base),
`certified-stale` (main moved or stamp expired; re-queue), or `landed` (queue ff, plus published for launched projects).
Only `certified-awaiting-order` and `landed` may be called done. Work-order `VERIFIED` is review/feature evidence.
For a launched project, ask for the explicit per-landing order at the START of the work (DR-138 unchanged);
if deferred, certify and preserve the branch at exit 21. A direct commit on launched main cannot be
published through a main-checkout stamp: supported paths are the queue or the explicit logged owner
bypass. The agent never sets the bypass. A transferred stamp's main-checkout check is diagnosis only.

**Repair pre-check.** After a static/Vitest red, run
`bash .pandacorp/verify.sh --only=live-data-asserts,structure-guard,data-layer,api-error-contract,doc-lint,residual-ambiguity,biome,tsc,knip,madge,vitest`
(the whole unit suite) before re-queueing. After a Playwright red, run the failing spec plus all static checks.
`bash .pandacorp/verify.sh --diagnose-unit` reports all static/unit failures under the host slot, never
certifies and leaves Playwright policy unchanged. Outcomes go to main's `.pandacorp/run/test-outcomes.jsonl`;
`node <plugin>/scripts/flaky-suspects.mjs <ledger>` lists same-tree pass/fail suspects. No reruns or autonomous exclusions. DR-165/5B permits reviewed owner-signed exact-id suspect verdict exclusions only in internal Mission Control (maximum 14 days); agents NEVER run authorize-exclusion.mjs, even with a TTY.


**The single Pandacorp entry for building and resuming.** Claude Code and Codex use the same
`plugin/scripts/pandacorp-build.mjs` engine. No engine keyword or execution-mode choice
is needed. The CLI owns scope detection, planning, admission, routing, review, governed
state transitions and landing; the session converses and relays the work it returns.
The conversation selects skills using `.pandacorp/guide.md`; skills never invoke each
other. An explicit owner request to work directly without Pandacorp uses that direct
workflow, rather than starting this engine.

Read and follow `references/engine-v2.md` in order, together with
`references/autonomy.md`, `references/drive.md` and `references/rescue.md`. Policy lives in
`factory/standards/build-engine.md` (BUILD-7..16); exact commands, flags, JSON and exits
live in `plugin/docs/build-engine-cli.md`. Resolve the factory path from the project's
`.pandacorp/guide.md`; Claude Code may use `${CLAUDE_PLUGIN_ROOT}` for the installed plugin.

## Project and ownership preflight

- Confirm `.pandacorp/status.yaml` exists; otherwise stop and route an existing project
  to `/pandacorp:adopt`, or a new idea to `/pandacorp:spec` (DR-045).
- If `overlay_version` is behind `plugin/templates/OVERLAY_VERSION`, return the prerequisite
  to the conversation for upgrade routing (DR-048), after checking live-build ownership.
  Never mix plugin versions on one project: after a plugin update, restart or close all
  sessions working on it before continuing.
- Use the CLI's detect and preflight checks. ACTIVE blueprints must have passed readiness,
  grounding and consistency gates, work orders must be ACTIVE, and ACTIVE docs must have
  no `NEEDS CLARIFICATION` markers. Missing initial-plan evidence returns to the conversation for architecture routing;
  an incremental card uses the run's specialist docs contract.
- The fenced lease is authoritative. Never reset `running`, edit state or reclaim a live
  foreign run by hand. Resume only through the CLI and its ownership checks.

## Scope and the first minute

"Impleméntalo" builds only the behavior ordered in this conversation, captured in a
cited scope card. A named card or FRD targets that scope; a bare invocation builds the
pending plan. The CLI selects the first matching detection row. It never drains other
cards into this run. "Anótalo" creates a `draft` card and validates it with `card check`,
then stops without a build. The cards are a file format, not another entry command.

Send the first-minute message from `references/autonomy.md`, using preflight evidence
and its stated defaults. Later doubts follow sources and consultation; reversible technical choices become recorded assumptions
with rationale and reversal instructions, and do not block integration. One protected action does not stop independent work. Human gates remain binding. A production
landing requires the owner's explicit order; the engine never grants itself permission.

## Design source and specialist preparation

Read `references/incremental.md` for the three UI cases, card fields and docs roles.
An agreed or existing design is implemented and documented faithfully, without redesign.
When the owner delegates everything and no design exists, the conversation first selects
lightweight design and then implement, without awaiting owner visual approval. If the
run received `design_source: pending`, its designer docs unit produces that same bounded
design before the affected UI unit builds; independent work continues. No UI goes
straight to implementation without a recorded visual source. Non-UI changes go directly
to implement. Builders never improvise visual design while coding.

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

## Shared account capacity (DR-162)

Follow `references/shared-capacity.md` for account ingestion, fixed execution cells,
subscription suspension and the Claude lead wake-up contract. Keep the attended loop
when scheduling is unavailable; never claim an unobserved automatic continuation.

## Execution, verification and landing

The session follows the CLI's `next` loop, dispatches exactly its model/effort and files
reports through the fenced commands. Continue in the active session when scheduling
is unavailable; claim background continuity only after observing a working mechanism.
Do not bypass independent review or deterministic gates. The ordinary three-execution budget
permits one supervised rescue under DR-164; see the rescue protocol at the top of the references.
Only build and patch units spend that budget; a red gate patches the attributed failing
scope, preserving healthy work. See BUILD-15 and the CLI reference for fallback behavior.

Every tracked run change is a CLI commit on `lane/<run_id>/integration`. Merge-queue
is the only path to `main`. Never write tracked files in the main checkout, push, edit
frontmatter/state manually, or set `PANDACORP_OWNER_RELEASE_OK` without the owner's order.
Service work follows DR-134 and `factory/standards/external-services.md`: reconcile actual
accounts/resources, preserve environment values and keep admin credentials out of runtime.

## Close-out and cleanup (CONV-21 / DR-145)

Follow `references/engine-v2.md` §8 for close-out inventories, gate-budget evidence and cleanup.

Use `finish` or the terminal action's summary, then follow the cleanup procedure in
`references/engine-v2.md` §8 and `../worktrees/SKILL.md` §Implementation teardown.
The engine removes eligible finished-run worktrees immediately and keeps branches;
`waiting_gate` retains the integration worktree needed for the owner's landing order.
Verify the resulting worktree inventory and report retained paths and reasons. Never
force-remove dirty, locked, live or process-cwd worktrees, or bulk-clean `.pandacorp/`.

For session-owned resources, register them before dispatch, restore the actual session
cwd, run `session-cleanup.mjs finish` and await its exit. Remove only named, eligible
scratch paths created by this session. A timeout is not successful cleanup.

Technical failures enter supervised rescue after the same cause occurs twice. A failed rescue
abandons only the unit and dependent work; independent work continues to `completed_with_gaps`.
The app lead executes session rescue briefs directly; drive uses a fresh worker. Tests stay
protected and every rescued commit needs independent review plus full green project verify
before integration. Never end the session for a technical `stop` or ask for technical approval.

The final report uses verified CLI results: owner questions/gates, autonomous decisions,
parked work, landed work versus work waiting on its branch, review status, quota and
cleanup/performance warnings. Capture lessons and leave an actionable explanation for
anything retained or unverified.
