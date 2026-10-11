---
id: BL-0117
type: change
area: plugin-skill
title: "Publish design mockups as Artifacts instead of serving them from a local python3 http.server"
status: open
severity: p2
opened: 2026-09-02
closed:
source: "docs/proposals/33-model-era-audit.md §6 R-62; REOPENED 2026-10-11 by docs/proposals/42-absorb-claude-design-to-artifacts.md Plan step 3 (the Artifact tool now exists)"
closes:
links: [BL-0229, DR-058, DR-109, LESSON-0255]
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

## Reopened 2026-10-11 — the rejection premise is gone; the fix plan is now a SPIKE
The 2026-09-03 rejection said "no tool surface exists for any agent to create/publish an Artifact
headlessly". As of 2026-10-10 Claude Code (v2.1.286) ships the `Artifact` tool (publish / read / list,
`type_url` for the core `Design` / `Design System` / `Slides` types) plus `ArtifactComments`. Standalone
Claude Design closes 2026-12-14, so this is also the candidate replacement review surface (proposal 42).

### Spike (one session) — publish ONE pandacast screen two ways and compare
Source: `pandacast/docs/design/claude-design-archive/` (full canvas export, renders standalone).
- **A — plain HTML artifact page:** one self-contained `.html` page (tokens inlined), `Artifact publish`.
- **B — Design-type canvas:** `type_url` = the core Design type, one PAGE artboard (`.dc.html`).
Measure for each: (1) owner can open and comment on it, phone included; (2) the agent reads comments
back with `ArtifactComments`; (3) a round-trip back to renderable local HTML for the DR-056 chain (B:
does `.dc.html` + `support.js` export cleanly?); (4) token fidelity versus the archive; (5) effort.
Record the verdict in proposal 42's Iteration section and here.

### Done when (replaces the section above)
The spike verdict is recorded. The winner, if any, is specified for `/pandacorp:learn` (proposal 42
Plan step 4). A "neither beats the local server" verdict closes this as tried-and-rejected, with the
reasons.
