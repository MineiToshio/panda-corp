---
id: BL-0220
type: bug
area: build-engine
title: "engine agents receive the LAUNCHING session's CLAUDE.md chain, not the project's, when /implement is launched from a session whose cwd is another project"
status: done
severity: p3
opened: 2026-10-01
closed: 2026-10-03
source: "pandacorp-bench-form benchmark 2026-10-01 (orchestrator session cwd = mission-control launched bench-implement's engine)"
closes: "preflight-implement.sh section 1b session-cwd WARN + test-preflight-session-cwd.sh + implement SKILL.md launch note (plugin/docs/decision-log.md, Unreleased bench follow-ups)"
links: [DR-096]
---

## Problem
The workflow-authoring reference states that Workflow/Agent subagents get the same CLAUDE.md files injected as the
main session. In the benchmark the orchestrator session's cwd was panda-corp/mission-control, so arm A's engine agents
(building /Users/Shared/Proyectos/pandacorp-bench-form/bench-implement) were given Mission Control's CLAUDE.md +
docs/rules instead of the bench project's. NOT VERIFIED from the transcripts which files were injected.

## Fix plan
1. Verify from an engine agent transcript which CLAUDE.md content it received.
2. If confirmed: make preflight-implement.sh WARN (or FAIL) when the session cwd's git toplevel differs from the
   project being built, and document "launch /implement from inside the project" in the implement SKILL.md.

## Tests (prove the fix — TDD, RED → GREEN)
Preflight test: cwd outside the project → WARN line present.

## Done when
Verification recorded; preflight check shipped or the item closed as not-a-defect with evidence.

## Resolution (2026-10-03)
**Verified (defect confirmed).** The engine agents' own transcripts for the bench run (session `ffab0b09`, `subagents/workflows/wf_*/agent-*.jsonl`) carry an `instructions` attachment listing the CLAUDE.md files injected at agent start. In all 160 of 160 agents whose prompt targets `pandacorp-bench-form/bench-implement` the list is identical: `panda-corp/CLAUDE.md`, `panda-corp/mission-control/CLAUDE.md` + `AGENTS.md` + `docs/rules/*.md` + `.pandacorp/guide.md`, and the auto-memory `MEMORY.md`; none is the bench project's own chain. Their recorded `cwd` is `panda-corp/mission-control` (the launching session's), although the prompt told them to `cd` to the bench project. So the injection follows the session cwd, not the engine's per-agent cd.

**Shipped.** `preflight-implement.sh` section 1b WARNs (never FAILs; the build runs, under foreign rules) when the session's real cwd is not inside the project, comparing real paths (a parent, a sibling or an unrelated cwd all warn; the project itself or a subdirectory passes). `implement/SKILL.md` step 1 now says to launch from a session opened inside the project, and no longer claims "launching from ANY cwd is safe" for the instructions the agents follow. Test: `plugin/scripts/test-preflight-session-cwd.sh` (13 assertions, RED before the check, GREEN after), registered in `run-engine-tests.sh`.
