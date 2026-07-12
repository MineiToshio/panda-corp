---
id: BL-0065
type: bug
area: build-engine
title: "Keep Codex unattended supervision alive under ephemeral shells"
status: done
severity: p1
opened: 2026-07-11
closed: 2026-07-11
source: "owner/conversation + factory/memory/_inbox.md launcher-reaping gotcha"
closes: "plugin 9.92.6 foreground-owned Codex launcher lifecycle"
links: [DR-113]
---

## Problem

`plugin/scripts/launch-codex-implement.sh` always detaches the supervisor and sleep inhibitor with
`nohup`. Codex Desktop command shells may be ephemeral and reap that detached process tree when the
tool call returns. Live canaries then lose supervision while a dispatch is in flight, leaving an
uncertain build despite a successful launcher receipt.

## Root cause

The launcher assumes that `nohup` is a durable process manager. That is not a portable guarantee:
the host that owns the command shell can terminate the shell's process group after command completion.
There is no certified foreground mode that keeps the shell, supervisor, and sleep inhibitor in one
observable lifetime or forwards termination signals to both children.

## Fix plan

1. Add a backward-compatible foreground mode to `plugin/scripts/launch-codex-implement.sh` while
   retaining the existing background mode for hosts where detached children are durable.
2. Keep the foreground launcher alive until the supervisor exits, bind sleep prevention to the
   supervisor, propagate termination signals, and persist the selected mode in the atomic receipt.
3. Add an offline process-lifecycle test covering argv, receipt, liveness, and signal cleanup without
   contacting a provider.
4. Document the operable choice in the implement skill, runtime guide, and Mission Control Manual.

## Tests (prove the fix — TDD, RED → GREEN)

- Extend `plugin/scripts/test-codex-unattended.mjs` with a fake CLI, supervisor, and sleep inhibitor.
  The foreground launcher must remain alive, preserve targeted argv in its receipt, and terminate
  both children after SIGTERM.
- Keep the existing background launch contract green.
- Run plugin validation, derived-source drift checks, backlog validation, and shell syntax checks.

## Done when

- Foreground mode has a persistent controller and deterministic signal propagation.
- Background behavior remains backward-compatible.
- The offline launcher corpus passes with no real provider.
- Skill, runtime docs, Manual, decision logs, plugin PATCH version, and derived manifests agree.
- `validate-backlog.sh` and plugin validation pass.

## Out of scope

Replacing the supervisor, bypassing R10/R11 promotion gates, or claiming that a foreground launch by
itself certifies overnight execution.
