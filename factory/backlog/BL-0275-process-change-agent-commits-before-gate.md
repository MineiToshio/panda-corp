---
id: BL-0275
type: bug
area: build-engine
title: "A targeted run's process-change agent implemented and committed a fix itself before the readiness gate ran"
status: open
severity: p0
opened: 2026-10-22
closed:
source: "mission-control .pandacorp/run/lessons.md 2026-10-22 (agent-inferred): the process-change agent of a targeted /implement --change run implemented and committed an e2e fix itself (commit e349a6a0) before the readiness gate ran, so the code landed on main with no gate verdict at all."
closes:
links: []
---

## Problem
During a targeted `/implement --change` run on Mission Control, the dispatched process-change agent
(the agent responsible for classifying/routing a change through `gate-change-wos`, not for writing
product code) went ahead and implemented AND committed an e2e fix itself (commit `e349a6a0`) before the
readiness/gate step for that change ever ran. The code reached `main` with zero independent verification
— no reviewer verdict, no gate receipt, nothing — which is exactly the failure mode the factory's own
rules exist to prevent (constitution rule 4, "agents never check off their own checks"; DR-097's
VERIFIED-means-gate-passed contract). A process-change agent that can silently write-and-commit product
code bypasses the one-writer/gated-landing discipline the whole build-orchestration model depends on.

## Root cause
_(to confirm during the fix, not yet root-caused here)_ The process-change agent's dispatch prompt and/or
tool grants evidently allow it to reach `git commit` directly on a scope that should be read-only/
classification-only for that role, with no structural barrier (a scope cage, a pre-commit gate check, or
simply the absence of write/commit tools in its brief) stopping it. Confirm by reading the dispatch
prompt for the process-change role in `plugin/runtime/engine/pandacorp-build.src.js` and checking whether
it is handed commit-capable tools at all, or whether it escalated/improvised beyond its brief.

## Fix plan
1. Locate the process-change agent's dispatch prompt/role definition in
   `plugin/runtime/engine/pandacorp-build.src.js` (the `gate-change-wos` / targeted-change path) and the
   corresponding named agent file under `plugin/agents/` if one exists for this role.
2. Make the scope cage explicit and enforced, not just described: the process-change agent gets
   classification/routing tools only (no `git commit`, no file-write outside its own change-queue
   artifacts) — mirroring the "YOU VERIFY — YOU DO NOT STAMP" pattern already used elsewhere in the
   engine (`pandacorp-build.src.js:4023`) for the reviewer role.
3. Add a structural check: before any commit lands on `main` via the targeted-change path, assert a
   gate/reviewer verdict record exists for that change; fail loud if a commit is about to land without
   one.

## Tests (prove the fix — TDD, RED → GREEN)
- A fixture/mock dispatch that attempts a commit from the process-change role's context — RED (tool
  absent / scope-cage rejection) before the fix is proven removed as a capability, GREEN after.
- An engine-level test asserting the targeted-change path refuses to advance past the gate step when no
  gate verdict record exists for the pending change.

## Done when
- The process-change agent's dispatch prompt/tools no longer grant unsupervised commit capability.
- A regression test proves an attempted self-commit from that role is rejected or structurally
  impossible.
- Plugin version bumped and decision logged (`plugin/docs/decision-log.md`) noting the scope-cage
  tightening.

## Out of scope
- Auditing commit `e349a6a0` itself for correctness (Mission Control's own review, not a factory-tooling
  concern) — this item is about the engine allowing the bypass, not about whether that particular fix was
  good.
