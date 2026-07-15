---
id: BL-0081
type: change
area: build-engine
title: "Promote attended Codex builds after closing the governed-executor gaps"
status: doing
severity: p0
opened: 2026-07-14
closed:
source: "owner/conversation — narrowed Codex-only implementation scope"
closes:
links: [DR-047, DR-050, DR-085, DR-113]
---

## Problem
The runtime-local Codex executor exists, but normal project builds remain blocked behind certification-only
permits. A smaller safe capability is ready to promote: an explicitly targeted FRD/change build, attended in
the foreground, which ends at a clean implementation safe point. Its remaining gaps are answered-decision
reopening, project-facing progress/timeline events, a fail-closed per-FRD mutation seam, and an explicit
owner-facing Codex route. Bare/global builds, hardening, harvest, release and unattended operation remain
uncertified. Claude's existing Dynamic Workflow path must remain unchanged.

## Fix plan
1. Complete answered-decision reopening, canonical project progress/timeline events and fail-closed per-FRD
   mutation verification in `plugin/runtime/codex/executor.mjs` using deterministic controller seams.
2. Add the explicit `attended_foreground` execution profile across launcher, supervisor and executor. Admit it
   only for an exact `frds` or `change` target, only in foreground, with a cumulative duration below three
   hours, no backgrounding and no supervisor auto-restart. Direct executor/supervisor invocation must not
   bypass the profile contract. Keep certification permits and the Claude launcher intact.
3. Add an explicit Codex branch to `plugin/skills/implement/SKILL.md` that invokes the Codex launcher and
   never calls `Workflow`; preserve the Claude branch byte-for-byte where practical.
4. Update the runtime policy, operative portability/build standards, generated/reference Manual surfaces,
   decision logs and plugin manifests. Advertise this exact profile as `EXPERIMENTAL`, never `PROVEN`.

## Tests (prove the fix — TDD, RED → GREEN)
- Extend the Codex executor/launcher suites with positive and adversarial fixtures for the promoted profile.
- Prove targeted foreground launch is admitted; bare/global, background, excessive-duration and direct
  executor/supervisor bypasses are rejected; Claude workflow files and routing remain unchanged.
- Prove missing, malformed or red mutation evidence fails closed and prevents FRD verification.
- Run the full Codex executor, runtime-switch, source/derived drift, backlog, manifest and Manual checks.

## Done when
- The promoted behaviours have deterministic green and red-path coverage.
- Targeted Codex builds have a documented foreground-only route that does not invoke Dynamic Workflows.
- `skill-runtime-policy.json` advertises only `EXPERIMENTAL: attended_foreground`, without claiming PROVEN.
- Claude's Dynamic Workflow path is unchanged and its existing contract tests remain green.
- Canonical standards, Manual, plugin/factory decision logs and versions match the shipped behaviour.
- The plugin and repository verification suites pass and this item is closed with objective evidence.

## Out of scope
- Bare/global Codex builds, hardening, lesson harvest, release, overnight/unattended operation, cross-runtime
  live takeover, Claude↔Codex messaging, and parity with Claude Dynamic Workflows. Those remain FALLBACK;
promotion beyond the attended targeted profile requires a later canary.

## Candidate canary evidence

- Main candidate: `bb7640c9`. Codex plugin `9.95.9` is installed and enabled, while the canonical
  `implement` policy remains `FALLBACK`; no promotion flip has been made.
- The diagnostic canary stopped fail-closed on its first provider dispatch with `usage_limit`; no retry
  occurred, the lease was released, and the diagnostic protocol was subsequently identified as incorrect.
- The diagnostic run exposed an out-of-scope rollup correction on inconsistent FRD A/B fixture state. The
  candidate was corrected so a WO transition rolls up only its owning FRD while global counters remain
  derived globally; regression coverage now freezes out-of-scope WO, FRD and blueprint bytes.
- The exact final fixture is prepared but has not been launched:
  `/Users/Shared/Proyectos/pandacorp-canaries/codex-attended-9959-final`, seed `80586c2d`, temporary plugin
  `/tmp/pandacorp-candidate-final.Tg9wIx/plugin` at exact candidate `bb7640c9` plus only the policy/capability
  projection, target `frd-01-safe-add`, foreground limits `6/900/1/1`. Its preflight is `PASS`.
- Result at that checkpoint: **NO-GO for policy promotion**. Keep `FALLBACK`; the prepared final canary must
  not be retried or launched without fresh authorization. The quota hypothesis was later disproved below.

## Final canary diagnosis and correction (2026-07-15)

- The final installed canary remains **NO-GO** and policy remains `FALLBACK`. Its first Codex dispatch exited
  with code 1 and no result because `result.schema.json` violated OpenAI Structured Outputs strictness:
  `traceability` was declared in `properties` but omitted from `required`. This was a local schema defect,
  not evidence that the account quota was exhausted.
- The matching Codex rollout reported `primary.used_percent: 1.0`,
  `rate_limit_reached_type: null`, and `resets_at: 1784730769` (2026-07-22 09:32:49 Lima). In this telemetry
  `1.0` means one percent used, so the reset timestamp is ordinary window metadata and not a quota blocker.
- Patch 9.95.10 separates the ordinary worker schema from a strict review schema where every property,
  including nested traceability fields, is required; the executor validates all output schemas recursively
  before acquiring build ownership. A silent failed dispatch may inspect only one safely correlated, fresh
  `source=exec` rollout from the exact real project cwd. It classifies `usage_limit` only when
  `rate_limit_reached_type` is present or the percentage is at least 100, and otherwise stays `unknown`.
  Sanitized, bounded stdout/stderr tails and a validated reset timestamp are durable diagnostics; prompts and
  secrets are never persisted.
- Adversarial coverage freezes exact-cwd/prompt correlation, stale/foreign/ambiguous/malformed rejection,
  one-percent non-classification, true 100-percent classification, stdout rate-limit classification and secret
  redaction. No provider or canary launch is part of this correction.
