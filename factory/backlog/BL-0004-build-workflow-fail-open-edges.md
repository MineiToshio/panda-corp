---
id: BL-0004
type: bug
area: build-engine
title: Build workflow has fail-open edges (foundation completeness, maxAgents, missing artifacts)
status: open
severity: p1
opened: 2026-06-30
closed:
source: docs/proposals/19-factory-flow-audit-2026-06-30.md (P1 — Build Workflow Has Fail-Open Edges)
closes:
links: [DR-050, DR-060]
---

**Problem:** `pandacorp-build.js` has robustness edges that continue when they should block: foundation
completeness can be treated as complete when the gate data is missing/invalid; `maxAgents` can be exceeded
within a planned wave if the external supervisor is absent/dead; old work orders without `artifacts` weaken
overlap detection (treated as "no overlap" instead of forcing serialization).

**Fix plan:**
1. Make missing/invalid foundation-completeness data **fail closed** (a blueprint's foundation must be
   provably complete, not assumed).
2. Enforce `maxAgents` **before** scheduling each spawn/wave, independent of the supervisor being alive.
3. Treat missing `artifacts` as a **warning that forces serialization**, not as "no overlap".
Files: `plugin/templates/shared/.claude/workflows/pandacorp-build.js`, note in
`factory/standards/build-orchestration.md`.

**Done when:** the three edges fail-closed/serialize as above; validated with the gate canary + a dry-run on
a plan with missing foundation data and an un-`artifacts`'d WO; plugin + `OVERLAY_VERSION` bumped.
