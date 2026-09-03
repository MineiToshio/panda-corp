---
id: BL-0116
type: change
area: plugin-skill
title: "Spike the native /deep-research against discover's hand-rolled multi-source research playbook"
status: done
severity: p2
opened: 2026-09-02
closed: 2026-09-03
source: "docs/proposals/33-model-era-audit.md §6 R-23"
closes: "plugin/docs/decision-log.md v9.99.1 entry (2026-09-03)"
links: []
---

## Problem
`/deep-research` is a GA bundled workflow and is unused. `plugin/agents/researcher.md` plus
`plugin/skills/discover/sources.md` (68 lines of hand-rolled source playbook) implement multi-source web
research by hand across `discover`, `spec` and `architecture`. Unlike Agent Teams or ntfy, this was never
considered and rejected — there is no decision on file either way. Impact: M.

## Fix plan
**Spike, do not adopt blind.** Run `/deep-research` on one real `discover` lens and compare its cited-report
output shape against the idea-card schema `discover` already produces: does the citation format, the source
verification and the structure fit, or would it need a translation layer that costs more than it saves?
Record the answer as an adopt / partially-adopt / reject decision with the comparison attached.

## Tests (prove the fix — TDD, RED → GREEN)
One side-by-side run on the same lens, with the two outputs diffed against the card schema.

## Done when
`plugin/docs/decision-log.md` carries an explicit verdict with the comparison behind it, so the question is
not re-opened without new information.

## Out of scope
Replacing the `researcher` agent or `sources.md` in this item — the spike only decides whether to.
