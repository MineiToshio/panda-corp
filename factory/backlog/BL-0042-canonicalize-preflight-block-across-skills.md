---
id: BL-0042
type: change
area: plugin
title: "Canonicalize the DR-045 preflight block across skills — drifted near-copies defeat mechanical sweeps"
status: open
severity: p2
opened: 2026-07-04
closed:
source: "Fable hardening sprint WS3 prompt audit 2026-07-04 (PROMPT-7 finding)"
closes:
links: [DR-045, DR-048, DR-114]
---

## Problem
The "is this a Pandacorp project? / marker check / upgrade-if-behind / skip-upgrade-if-build-running"
preflight block appears in ≥8 skills as DRIFTED near-copies: architecture/iterate/implement say "this
skill mutates the project…", bug/change say "this skill writes to `.pandacorp/inbox/`…", bug/change/
iterate carry a divergent phrasing of the active-build-guard exception that implement omits;
new-version and release are byte-identical (good); sync's variant adds a justified modo-fábrica
branch. PROMPT-7 (DR-114): divergent near-copies are how sweeps decay — a future change to the
preflight (e.g. a new marker, a changed guard TTL) cannot be swept mechanically and will land in some
copies but not others (audit-20 disease D2).

## Fix plan
Define ONE canonical preflight block (in a shared reference file under plugin/skills/ or as a
documented block in the prompting-conventions standard) with exactly one intended variance point
(the per-skill "what this skill writes/mutates" clause, and sync's documented modo-fábrica branch).
Sweep all carrier skills to the byte-identical canonical text + their variant clause. Add a cheap
grep check (script or test) asserting the invariant part is byte-identical across carriers.

## Done when
All preflight carriers share the byte-identical invariant block; the variance points are explicit;
a script proves it (and goes RED when a copy drifts); plugin version bumped; decision log recorded.

## Out of scope
Changing the preflight's SEMANTICS (marker path, guard TTL, upgrade routing) — this is form
canonicalization only.
