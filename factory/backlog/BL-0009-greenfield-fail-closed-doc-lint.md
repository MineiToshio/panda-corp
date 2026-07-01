---
id: BL-0009
type: change
area: templates
title: Make selected doc-lint checks fail-closed for greenfield projects (advisory stays for brownfield)
status: open
severity: p2
opened: 2026-06-30
closed:
source: docs/proposals/19-factory-flow-audit-2026-06-30.md (P1 — Some Gates Are Advisory) + factory/decision-log 2026-06-30
closes:
links: [DR-077, DR-079]
---

**Problem:** `doc-lint.sh` is advisory by design (always exits 0) so a hard doc gate can't red-lock adopted/
partial-spine projects. But a greenfield project born with a complete doc spine could carry a stricter,
fail-closed doc-lint. This is the one open sub-item of the audit's "advisory/vacuous gates" finding — the
DR-079 gate canary itself is already BUILT (covers 8 fail-closed gates), so only this remains.

**Fix plan:** Decide which `doc-lint.sh` checks become **fail-closed for greenfield only** (e.g. a project
created by `/scaffold` with a full spine), keeping the advisory mode for brownfield/adopted. Wire a
greenfield flag or a threshold. Files: `plugin/templates/shared/.pandacorp/doc-lint.sh`,
`factory/standards/quality.md` (advisory-vs-hard list), registry DR-077 amendment.

**Done when:** greenfield projects get a fail-closed doc-lint subset; brownfield stays advisory; DR-077
amended; quality.md updated. (Lower priority — the owner's 2026-06-30 directive kept doc-lint advisory-but-
proactive; this only tightens the greenfield case.)
