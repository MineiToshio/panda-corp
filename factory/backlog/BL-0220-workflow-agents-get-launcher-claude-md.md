---
id: BL-0220
type: bug
area: build-engine
title: "engine agents receive the LAUNCHING session's CLAUDE.md chain, not the project's, when /implement is launched from a session whose cwd is another project"
status: open
severity: p3
opened: 2026-10-01
closed:
source: "pandacorp-bench-form benchmark 2026-10-01 (orchestrator session cwd = mission-control launched bench-implement's engine)"
closes:
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
