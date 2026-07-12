---
id: BL-0071
type: bug
area: build-engine
title: "Pass the absolute state CLI capability to installed Claude workflows"
status: done
severity: p0
opened: 2026-07-12
closed: 2026-07-12
source: "installed R10-E Claude canary"
closes: "Installed Claude subagents no longer depend on an absent CLAUDE_PLUGIN_ROOT"
links: [DR-113]
---

## Problem
Installed Claude Workflow subagents did not reliably inherit `CLAUDE_PLUGIN_ROOT`. Five governed
state commands therefore resolved to `/scripts/pandacorp-build-state.mjs` and failed before useful
construction, even though the plugin and its CLI were installed correctly.

## Root cause
The engine generated subagent commands from an ambient plugin-root environment variable instead of
receiving the already-known installed capability path from its launcher.

## Fix plan
Resolve and validate the state CLI in `launch-implement.sh`, pass its canonical absolute path through
the printed Workflow arguments, reject a missing/relative capability before any engine spawn, and
shell-quote that path in every generated governed-state command.

## Tests (prove the fix — TDD, RED → GREEN)
Launcher tests assert canonical absolute injection and JSON safety. The engine harness rejects missing
and relative paths before any agent and proves paths containing spaces reach all prompt commands.
The complete engine and lease lifecycle suites remain green with an empty inherited plugin-root env.

## Done when
The launcher, engine, generated prompt source, skill, standards, runtime docs, Manual and decision
logs describe one explicit capability; plugin 9.94.2 and overlay 8.75.1 are generated; all named
suites pass; R10 remains unpromoted.

## Out of scope
No Codex capability promotion and no change to runtime-local orchestration ownership.
