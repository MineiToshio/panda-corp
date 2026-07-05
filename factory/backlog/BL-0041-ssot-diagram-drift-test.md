---
id: BL-0041
type: change
area: mission-control
title: "SourceOfTruthMap Manual diagram hardcodes the agent-portability SSOT table — add a drift test against the standard"
status: open
severity: p2
opened: 2026-07-04
closed:
source: "Fable hardening sprint WS1 adversarial audit 2026-07-04, finding #10"
closes:
links: [DR-046, DR-113]
---

## Problem
`mission-control/src/components/modules/manual-diagrams/SourceOfTruthMap.tsx` hand-copies the
single-source-of-truth table from `factory/standards/agent-portability.md` §Maintenance —
including the literal skill count ("Los 25 skills") — with no mechanism to flag it stale when the
standard's table or the skills directory changes. A hand-maintained copy of the very table that
decrees "never a hand-maintained copy" is the self-consistency trap in miniature; permitted as a
DR-046 hand-authored Concept, but it needs an oracle.

## Fix plan
A unit test in mission-control that (a) derives the skill count from the `plugin/skills/`
directory listing and asserts the TSX renders it, and (b) asserts each SSOT row's source path in
the TSX appears in `agent-portability.md` §Maintenance (cheap string containment) — so a change to
either side reds the test until they re-agree.

## Done when
The drift test exists, fails on a deliberately tampered row/count, and passes on the current pair.

## Out of scope
Auto-generating the diagram from the standard (keep it hand-authored; just fence it).
