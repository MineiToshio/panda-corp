---
id: BL-0074
type: bug
area: build-engine
title: "Remove model trust from build stop inspection"
status: doing
severity: p0
opened: 2026-07-12
closed:
source: "R10-G pre-run adversarial audit"
closes:
links: [DR-068, BL-0068, BL-0073]
---

## Problem

BL-0073 validates the shape of a recurring safe-point `stop_receipt`, but its engine harness mocks the
agent response and never proves that the model executed the fenced `stateCli inspect-stop` command.
The model can fabricate a structurally valid receipt or derive it through ambient shell predicates.
The pre-loop baseline also accepts `{green:true}` without requiring any receipt. Therefore the same
model-compliance failure class exposed by R10-F remains possible despite green unit tests.

## Root cause

Deterministic stop truth is still transported through an untrusted model response, while tests stub
that response. Schema validation proves shape, not provenance or execution of the deterministic CLI.

## Fix plan

1. Redesign every pre-loop and recurring stop check so the engine consumes deterministic stop truth
   without trusting a model-authored claim; use a runtime-native deterministic seam if supported, or a
   fail-closed verifiable capability whose provenance cannot be forged by the delegated agent.
2. Use one shared stop-receipt validator and require the same contract on all continuation paths.
3. Replace mock-only assertions with a test that executes the real state CLI under hostile aliases and
   overlay-real paths; explicitly document any boundary that only a live installed canary can prove.
4. Propagate engine/template/standards/skill/Manual truth and version metadata.

## Tests (prove the fix — TDD, RED → GREEN)

- A test must fail on the current model-authored/mocked receipt design and pass only when real CLI
  output drives both pre-loop and recurring decisions.
- Cover absent stop, real regular stop, symlink/non-regular stop, command failure and malformed output.
- Run engine, state CLI, launcher, lifecycle, source/drift, Mission Control typecheck and backlog gates.

## Done when

- Neither pre-loop nor recurring stop truth depends on a model's honest tool execution or narration.
- The regression suite executes the real deterministic seam rather than injecting the expected object.
- Canonical and derived surfaces agree; plugin/overlay versions and decision logs are updated.
- The item closes only after an independent red-team confirms the R10-F failure class is structurally impossible.

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

This is a genuine platform blocker, not a missing prompt constraint. A closeable design requires a
deterministic runtime-owned seam that can both inspect the file and stop/pause the workflow without a
model in the trust path (for example, a host supervisor with a native `TaskStop` control API). Until
that exists and a real seam test goes RED on forged agent output, this item remains `doing`; R10-G and
R11 must not run or promote.

## Out of scope

Do not run or promote R10-G/R11. Do not weaken owner stop semantics.
