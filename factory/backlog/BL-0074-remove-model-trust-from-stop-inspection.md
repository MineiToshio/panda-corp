---
id: BL-0074
type: bug
area: build-engine
title: "Harden Claude stop inspection beyond the Dynamic Workflows trust boundary"
status: doing
severity: p2
opened: 2026-07-12
closed:
source: "R10-G pre-run adversarial audit"
closes:
links: [DR-068, BL-0068, BL-0073]
---

## Problem

BL-0073 validates the shape of a recurring safe-point `stop_receipt`, but the Dynamic Workflows API
exposes filesystem/process side effects only through delegated Claude agents. Its engine harness can
prove fail-closed receipt handling and a live installed qualification can prove real tool execution,
but neither can remove the platform's model-agent trust boundary. A malicious or non-compliant agent
could still fabricate a structurally valid receipt.

This is a known Claude-executor hardening opportunity, **not a blocker for R10/R11 or the separate
Codex executor**. R10 certifies a cold file-state handoff between two runtime-local executors; it does
not require Claude's Dynamic Workflow to become a host-side deterministic program.

## Root cause

Claude's native Dynamic Workflows API has no workflow-body filesystem/process channel. Deterministic
stop truth is therefore transported through a Claude subagent response. Schema validation proves
shape and fail-closed behavior, while live qualification proves the expected installed path; neither
is cryptographic provenance of every future agent execution.

## Fix plan

1. Track Anthropic support for a runtime-owned filesystem/process seam or host control API that can
   inspect and stop a Workflow without placing a delegated agent in the trust path.
2. Use one shared stop-receipt validator and require the same contract on all continuation paths.
3. Preserve the real installed qualification that executes the state CLI under hostile aliases and
   overlay-real paths; keep mock/fuzz tests for rejection paths and label the evidence boundary.
4. If a native seam becomes available, migrate Claude only after a compatibility canary and propagate
   engine/template/standards/skill/Manual truth and version metadata.

## Tests (prove the fix — TDD, RED → GREEN)

- A live installed qualification must prove real CLI output drives absent-stop, present-stop and stale
  lease decisions under hostile aliases.
- Cover absent stop, real regular stop, symlink/non-regular stop, command failure and malformed output.
- If a native host seam lands, add a regression that rejects forged agent output and run engine, state
  CLI, launcher, lifecycle, source/drift, Mission Control typecheck and backlog gates.

## Done when

- Anthropic exposes (or Pandacorp can safely use) a runtime-owned seam so neither pre-loop nor recurring
  stop truth depends on a delegated agent's tool execution or narration.
- The regression suite executes that real deterministic seam and rejects forged agent output.
- Canonical and derived surfaces agree; plugin/overlay versions and decision logs are updated.
- The item closes only after an independent red-team confirms the stronger provenance claim is true.

## Attempt evidence — 2026-07-12

The official Dynamic Workflows surface does not expose filesystem or process execution to workflow
JavaScript. The script can orchestrate `agent`, `parallel`, `pipeline`, and phases; commands are executed
only by delegated agents. The public `Workflow` API likewise exposes launch identity/arguments/resume,
not a host-side command-result channel. Consequently, an `inspect-stop` JSON object returned to the
engine is necessarily model-authored under the current API, even when the prompt asks the agent to run
the real CLI. Shape validation, nonces, signatures, or a second agent cannot prove execution because
the delegated agent receives the command and its capabilities and can omit it or fabricate narration.

Official references checked:

- <https://code.claude.com/docs/en/workflows#behavior-and-limits>
- <https://code.claude.com/docs/en/agent-sdk/typescript#workflow>

This is a genuine platform limitation, not a missing prompt constraint. A closeable design requires a
deterministic runtime-owned seam that can both inspect the file and stop/pause the workflow without a
model in the trust path (for example, a host supervisor with a native `TaskStop` control API). Until
that exists and a real seam test goes RED on forged agent output, this item remains `doing` as
non-blocking hardening. It does **not** block R10/R11: those certify separate Claude and Codex
executors, shared deterministic state, lease fencing, safe-point quiescence and cold continuation.
The installed Claude 9.95.2 qualification remains the honest oracle for the current platform boundary.

## Out of scope

Do not weaken owner stop semantics, claim cryptographic provenance from schema validation, replace
Claude Dynamic Workflows with the Codex executor, or couple the two runtimes through live messaging.
