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

- Candidate commit: `1797806a`; temporary plugin copy differed only in policy + derived capability projection.
- Disposable fixture: `pandacorp-canaries/codex-attended-9959`, seed `0342fc38`, exact target `frd-c-subtract`.
- Run `codex-20260715T014911Z-30356` stopped fail-closed on its first provider dispatch with
  `usage_limit`; no retry occurred and the lease was released.
- The diagnostic run exposed an out-of-scope rollup correction on inconsistent FRD A/B fixture state. The
  candidate was corrected so a WO transition rolls up only its owning FRD while global counters remain
  derived globally; regression coverage now freezes out-of-scope WO, FRD and blueprint bytes.
- This was diagnostic evidence, not the canonical promotion protocol. Result: **NO-GO for policy promotion**.
  Keep `FALLBACK` until the exact authorized canary completes green.
