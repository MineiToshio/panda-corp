---
id: BL-0200
type: change
area: build-engine
title: "retire BL-0179's since-scope close-out reuse (unreachable and unsound); the engine re-checks the reuse fields itself"
status: done
severity: p2
opened: 2026-09-26
closed: 2026-09-26
source: "canary E2 report §4 (BL-0179 row) and §6 item 3; proposal 38 'Canary E2 result'"
closes: "plugin/templates/shared/.claude/engines/pandacorp-build.js checkFullVerifyReuse (prompt + engine-side guard) + REUSE_REPORT_CLAUSE — 7c741f90"
links: [BL-0147, BL-0179]
---

## Problem
BL-0179 let the close-out reuse a `scope:"since"` report anchored at the current `last_green_sha`. It never fired:
0 `CloseOutVerifyReused` events in the whole history (canaries D and E2). In E2 all three conditions failed
(HEAD two bookkeeping commits past last_green, the last report a since-PIN reverify, a dirty tree).

## Decision: option (b), close as not applicable and remove the arm
Option (a) ("reuse a since report whose base is ≤ N docs/.pandacorp commits from last_green") was rejected:
- Its premise is false. BL-0179 argued that a report "since last_green_sha" plus a full-certified last_green equals a
  full run. But every landing publishes `last_green_sha` from a since-scoped report (E2's apply-gate:frd-05 read
  `"scope": "since"` and published 4ceac8e0), so last_green is never itself full-certified.
- The close-out full suite is the declared backstop for `--since`'s blind spots (vitest `--changed`; build-orchestration
  §5c honest limits) — the case it exists for is exactly a multi-FRD parallel run.
- Even (a) would not have fired in E2: the certify commit adds the reviewer tests under `src/` after the last report.

## Fix plan
The reuse-check prompt accepts only a fresh, full, green report of exactly HEAD over a clean tree (BL-0147); the engine
re-checks those fields on the agent's answer and overrules a canReuse:true that does not meet them (logged).
verify.sh keeps stamping `since` (provenance; comment updated).

## Tests
E2-7a (no since arm in the prompt), E2-7b (an agent's canReuse:true on a since report is overruled → full run, logged),
E2-7c (a full canReuse:true with sha ≠ HEAD is overruled). BL-0179a/b removed (their contract is retired), BL-0179c kept.

## Done when
- [x] RED → GREEN, suites green (see BL-0194).
