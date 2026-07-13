---
id: BL-0076
type: bug
area: build-engine
title: "Stop targeted builds before global hardening"
status: done
severity: p0
opened: 2026-07-13
closed: 2026-07-13
source: "R10-H installed Codex Stage 2 incident"
closes: "Plugin 9.95.4 / overlay 8.76.2 targeted terminal-scope boundary"
links: [DR-085, DR-113]
---

## Problem
During R10-H Stage 2, the Codex executor was launched for the exact `frd-b-multiply` target and
completed that scope. Because this happened to make every project work order `VERIFIED`, the executor
then entered the project-wide hardening audit/fix path. The audit inspected transient canary state and
FRD-A, and the hardening fixer had authority to write outside the one-shot certification scope.

Targeted FRD and targeted change runs promise exact scope. Completing the last globally pending FRD
must not silently widen that authorization into whole-project hardening or release.

## Root cause
`plugin/runtime/codex/executor.mjs` chooses `hardening` whenever every global work order is verified,
without first distinguishing a bare whole-project run from a targeted `--frds` or `--change` run.
The targeted path also reaches shutdown with `finalReason: complete` without explicitly persisting the
normal terminal-complete checkpoint/event.

## Fix plan
1. Change the Codex executor terminal decision so any targeted run ends `complete` immediately after
   its scoped FRDs are verified and change cards reconciled. It must quiesce/release ownership, retain
   `phase: implementation`, and never dispatch global hardening.
2. Keep global hardening/release available only to a bare whole-project run after every global work
   order is verified.
3. Persist an explicit terminal-complete result for targeted success so the certification launcher
   can revoke its one-shot receipt with a successful terminal exit.
4. Update the runtime contract, portability standard, Proposal 32 narrative, Mission Control Manual,
   plugin decision log, and plugin version. No overlay bump unless a managed overlay file changes.

## Tests (prove the fix — TDD, RED → GREEN)
- Extend `plugin/scripts/test-codex-executor.mjs` with a two-FRD regression where FRD-A is already
  verified and targeted FRD-B is the last pending scope: target B completes, A stays byte-identical,
  no hardening dispatch occurs, phase remains implementation, terminal reason is complete, and the
  lease is released.
- Run the equivalent fixture bare and prove hardening audit/fix dispatch exactly once and phase release.
- Strengthen the targeted-change regression with the same no-hardening, phase and terminal assertions.
- Run executor, unattended, R10 permit, source/derived drift, plugin validation, Mission Control
  typecheck, and backlog validation suites.

## Done when
- Targeted FRD and change runs cannot dispatch global hardening even when they verify the final global
  work order; they persist terminal complete, quiesce cleanly and preserve implementation phase.
- A bare run still invokes global hardening exactly once and reaches release when all global work is green.
- Documentation and Manual describe the bare-only hardening boundary.
- Plugin PATCH version is bumped; overlay version remains unchanged unless a managed overlay changes.
- All named tests are green and this item is closed with objective evidence.

## Out of scope
- Retrying or modifying R10-H, consuming another permit, changing Claude Dynamic Workflows, promoting
  Codex normal-project writes, or redesigning project-wide hardening.
