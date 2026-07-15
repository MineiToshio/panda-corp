---
id: BL-0081
type: change
area: build-engine
title: "Promote attended Codex builds after closing the governed-executor gaps"
status: open
severity: p0
opened: 2026-07-14
closed:
source: "owner/conversation — narrowed Codex-only implementation scope"
closes:
links: [DR-047, DR-050, DR-085, DR-113]
---

## Problem
The runtime-local Codex executor exists, but normal project builds remain blocked behind certification-only
permits because six governed-build behaviours are incomplete: answered owner decisions do not reopen their
BLOCKED work orders; the project-facing progress and event projections are incomplete; per-FRD mutation
testing is not fail-closed; the final hardening pass does not preserve independent auditor/fixer/analytics
roles and evidence; lesson citations and harvest state are not closed before release; and the owner-facing
`implement` skill still routes its operative launch instructions through Claude Dynamic Workflows. The owner
has explicitly narrowed the target to safe, attended, foreground Codex builds. Claude's existing Dynamic
Workflow path must remain unchanged.

## Fix plan
1. Complete the six missing behaviours in `plugin/runtime/codex/executor.mjs`, using deterministic controller
   seams and runtime-local Codex agents only: answered-decision reopen, canonical project progress/event
   projection, fail-closed per-FRD mutation testing, independent hardening auditor/fixer/evidence/analytics
   stages, and lesson citation/harvest accounting before release.
2. Make `plugin/scripts/launch-codex-implement.sh` admit normal Codex execution only in foreground/attended
   mode while the capability remains unproven; keep certification permits and the Claude launcher intact.
3. Add an explicit Codex branch to `plugin/skills/implement/SKILL.md` that invokes the Codex launcher and
   never calls `Workflow`; preserve the Claude branch byte-for-byte where practical.
4. Update the runtime policy, operative portability/build standards, generated/reference Manual surfaces,
   decision logs and plugin manifests. Do not mark Codex `implement` PROVEN until a disposable canary passes.

## Tests (prove the fix — TDD, RED → GREEN)
- Extend the Codex executor/launcher suites with positive and adversarial fixtures for all six behaviours.
- Prove foreground normal Codex launch is admitted, background/unattended normal launch remains rejected,
  and Claude workflow files and routing remain unchanged.
- Prove mutation/hardening/harvest ambiguity or missing evidence fails closed and prevents release.
- Run the full Codex executor, runtime-switch, source/derived drift, backlog, manifest and Manual checks.

## Done when
- All six behaviours have deterministic green and red-path coverage.
- Normal Codex builds have a documented foreground-only route that does not invoke Dynamic Workflows.
- `skill-runtime-policy.json` truthfully advertises the limited attended capability without claiming PROVEN.
- Claude's Dynamic Workflow path is unchanged and its existing contract tests remain green.
- Canonical standards, Manual, plugin/factory decision logs and versions match the shipped behaviour.
- The plugin and repository verification suites pass and this item is closed with objective evidence.

## Out of scope
- Overnight/unattended Codex operation, cross-runtime live takeover, Claude↔Codex messaging, and feature
  parity with Claude-only Dynamic Workflow ergonomics. Promotion to fully PROVEN remains a later canary gate.
