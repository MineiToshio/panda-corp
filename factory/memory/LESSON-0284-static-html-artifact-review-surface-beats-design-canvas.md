---
id: LESSON-0284
type: library-verdict
domain: design-process
tags: [claude-design, artifact, playwright, owner-review, html-export]
context: choosing a surface to hand an owner a reviewable visual artifact (a live page capture, a design) for sign-off
trigger: use this when deciding how to hand the owner a pixel-faithful review surface for an existing live page, versus generating/porting it through a design canvas
source: "panda-corp 2026-10-11 — Claude Design absorption research (docs/proposals/42-absorb-claude-design-to-artifacts.md): a Playwright DOM snapshot of the local page bundled with its asset files as a static HTML Artifact needed zero porting and was pixel-faithful; the Design Artifact type needed hand-written inline-style .dc.html and its HTML export was a 2.2 MB bundled-runtime page (renders offline, not repo-ready markup)"
provenance: agent-inferred
created: 2026-10-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0141, LESSON-0080, BL-0229]
---

**Situation:** needed to hand the owner a reviewable snapshot of an EXISTING live page. Tried the Design
Artifact type (Claude Design's post-sunset successor): it requires hand-authoring inline-style `.dc.html`
and its HTML export is a 2.2 MB bundled-runtime page that renders standalone but is not repo-ready
markup — real porting work either way. A Playwright DOM snapshot of the actual local page, saved as a
static HTML Artifact with its asset files as siblings, needed no porting at all and was pixel-faithful
by construction (it IS the real page).

**Lesson:** for reviewing something that ALREADY EXISTS as a live/local artifact, capturing it directly
(a DOM snapshot, a screenshot-backed static page) beats routing it through a generative design surface —
the design-canvas/Artifact types are for GENERATING or redesigning something new, not for faithfully
reproducing something that already renders correctly. Using a generative surface to review an existing
page adds translation loss and porting cost for no benefit.

**Apply next time:** when the task is "show the owner surface X as it already is" (not "design/redesign
X"), capture X directly (Playwright snapshot, screenshot, static export) rather than reaching for a
design-generation tool. Reserve the Design/Design System Artifact types for actually generating or
iterating on NEW visual work.
