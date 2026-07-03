---
id: BL-0009
type: change
area: templates
title: "Make selected doc-lint checks fail-closed for greenfield projects (advisory stays for brownfield)"
status: done
severity: p2
opened: 2026-06-30
closed: 2026-07-03
source: "docs/proposals/19-factory-flow-audit-2026-06-30.md (P1 — Some Gates Are Advisory) + factory/decision-log 2026-06-30"
closes: "amended DR-077 — doc-lint.sh splits HARD-ELIGIBLE (frontmatter-key presence, PRD type) vs SOFT (REQ cross-ref, UI design-oracle) findings; HARD-ELIGIBLE is fail-closed for greenfield projects (created_via: scaffold, new immutable status.yaml field) and stays advisory for brownfield/adopted or no-provenance; SOFT stays advisory everywhere; proven by a greenfield-vs-brownfield fixture pair"
links: [DR-077, DR-079]
---

## Problem
`plugin/templates/shared/.pandacorp/doc-lint.sh` is advisory by design (always exits 0) so a hard doc gate
can't red-lock adopted/partial-spine projects. But a greenfield project born with a COMPLETE doc spine could
safely carry a stricter, fail-closed doc-lint — there is no reason for it to stay advisory-only. This is the
one open sub-item of the audit's "advisory/vacuous gates" finding: the DR-079 gate canary itself is already
BUILT (covers 8 fail-closed gates), so only the greenfield doc-lint tightening remains. Impact: greenfield
projects miss a chance to hard-enforce doc completeness they actually satisfy.

## Fix plan
Decide which `doc-lint.sh` checks become **fail-closed for greenfield only** (e.g. a project created by
`/scaffold` with a full spine), keeping advisory mode for brownfield/adopted. Wire a greenfield flag or a
threshold (detected from provenance — scaffolded vs adopted — or an explicit config key) that selects the
fail-closed subset. Files: `plugin/templates/shared/.pandacorp/doc-lint.sh`, `factory/standards/quality.md`
(the advisory-vs-hard list), registry `DR-077` amendment.

## Tests (prove the fix — TDD, RED → GREEN)
- **Greenfield fail-closed (canary / script assertion):** a greenfield fixture (scaffolded flag set) with a
  DELIBERATELY-broken doc-spine item in the fail-closed subset must make `doc-lint.sh` exit NON-ZERO. Today it
  exits 0 (advisory). The same broken fixture flagged as brownfield must still exit 0 (advisory preserved).
  That RED-greenfield / GREEN-brownfield pair is the proof.
- **Happy path:** a greenfield fixture with a complete spine exits 0; the subset only bites on real gaps.

## Done when
Greenfield projects get a fail-closed doc-lint subset (proven by the greenfield-vs-brownfield fixture pair);
brownfield/adopted stays advisory; `DR-077` amended in the registry; `factory/standards/quality.md`
advisory-vs-hard list updated; `OVERLAY_VERSION` bumped (overlay script changed). (Lower priority — the
owner's 2026-06-30 directive kept doc-lint advisory-but-proactive; this only tightens the greenfield case.)

## Out of scope
Making doc-lint fail-closed for brownfield/adopted projects (explicitly kept advisory); the DR-079 gate canary
itself (already built).
