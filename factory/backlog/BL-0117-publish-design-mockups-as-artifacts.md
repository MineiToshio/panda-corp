---
id: BL-0117
type: change
area: plugin-skill
title: "Publish design mockups as Artifacts instead of serving them from a local python3 http.server"
status: done
severity: p2
opened: 2026-09-02
closed: 2026-09-03
source: "docs/proposals/33-model-era-audit.md §6 R-62"
closes: "factory/decision-log.md 2026-09-03 entry — Artifacts publish path investigated and rejected (no tool surface exists for any agent to create/publish an Artifact headlessly); local python3 http.server review surface stays"
links: []
---

## Problem
The Artifact tool has **zero uses** in the factory. Design surfaces are served locally:
`.claude/launch.json:4-11` serves `mission-control/prototype` on :4000 and `:16-23` serves
`mission-control/docs/design` on :4180 — which requires the owner's machine to be running the server to
review anything. Impact: L, convenience only. (Note the audit's citation correction: the earlier claim that
`launch.json` serves `docs/design/mockups/direction-{1,2,3}.html` is wrong; that path does not exist.)

## Fix plan
Publish one mockup set as an Artifact from the `design` skill's flow, keeping the local server as the
fallback. Artifacts' single-page / no-backend model is correctly **not** used for Mission Control itself
(783 source files) — this is only for the static mockup review surface.

## Tests (prove the fix — TDD, RED → GREEN)
Publish one mockup set; the owner confirms the review link is faster and more convenient than starting the
local server. A "no, the local server is fine" verdict closes the item as tried-and-rejected.

## Done when
Either `plugin/skills/design/SKILL.md` documents the Artifact publish path with the local server as
fallback, or the decision-log records why the local server stays.

## Out of scope
Mission Control itself, and the Claude Design canvas flow (mature in-house, DR-058/101/109).
