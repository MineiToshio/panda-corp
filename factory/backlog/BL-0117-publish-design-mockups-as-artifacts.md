---
id: BL-0117
type: change
area: plugin-skill
title: "Publish design mockups as Artifacts instead of serving them from a local python3 http.server"
status: done
severity: p2
opened: 2026-09-02
closed: 2026-10-11
source: "docs/proposals/33-model-era-audit.md §6 R-62; REOPENED 2026-10-11 by docs/proposals/42-absorb-claude-design-to-artifacts.md Plan step 3 (the Artifact tool now exists)"
closes: "plugin v9.122.0 — design SKILL.md Step 6 publishes each direction as a private Artifact (lead session), owner comments read via ArtifactComments, local server/screenshots as fallback; spike verdict A (static HTML artifact) over B (Design canvas)"
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

## Spike verdict — 2026-10-11 (A wins)
Source: `pandacast/docs/design/claude-design-archive/screens/Panel.card.html` (React + `_ds_bundle.js`).
- **A, static HTML artifact** (https://claude.ai/artifact/3CXVtSguC61VaeMgauagv8):
  - Rendered with a Playwright DOM snapshot into one script-free page (640 KB, 623 inline SVG icons), with the 1.4 MB logo published as a sibling file.
  - Zero porting cost and pixel-faithful in both themes. Fonts load from Google Fonts. First paint takes about 10 s.
  - The page offers comments.
- **B, Design canvas** (https://claude.ai/artifact/41xiwkbFNtVmUHMz3eMPe5):
  - The type requires every artboard to be hand-authored `.dc.html` markup with inline styles. An existing class/token-based design cannot be ingested; a 640 KB render is impractical to author through the file tool. A reduced Panel artboard was hand-ported with the real OKLCH tokens.
  - It renders well, and the owner gets a canvas, direct edits, tweak swatches and PNG/PDF/HTML export.
  - Its "HTML" export is a 2.2 MB bundled-runtime page (8 scripts). It renders offline faithfully under Playwright, so it can serve as a visual baseline, but it is not repo-ready markup.
  - The type's own rule forbids verifying on the canvas.
- **Verdict:**
  - A becomes the review surface: repo HTML stays the source, and the lead session publishes it.
  - B is not used in the lifecycle. It stays an optional owner playground, revisited only together with the Design System artifact projection (proposal 42 P2, deferred).
- **Still owner-attended:** a phone view plus one comment on A, read back with `ArtifactComments` (tracked in proposal 42 Iteration).
