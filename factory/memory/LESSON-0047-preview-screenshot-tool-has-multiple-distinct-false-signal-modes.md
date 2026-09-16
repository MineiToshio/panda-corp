---
id: LESSON-0047
type: pattern
domain: preview-tooling
tags: [preview-screenshot, verification, worktree, false-negative, false-positive]
context: using the preview/screenshot verification tools (preview_screenshot, dev-server DOM checks) to confirm a UI change actually landed
trigger: use this when a preview/screenshot verification tool returns an unexpected result (timeout, black/blank image, or stale content) and you are about to conclude that the UI itself is broken or unchanged
source: "panda-corp + personal-page-v2 2026-07-03 harvest — synthesized from LESSON-0033 (canvas timeout), LESSON-0034 (worktree launch.json resolves to main), LESSON-0039 (next dev worktree lockfile confusion), LESSON-0041 (black screenshot on below-fold/opacity content). Folded in 2026-07-16 (librarian review): LESSON-0060 (personal-page-v2 .pandacorp/run/lessons.md 2026-07-03 — headless capture defaults to light `prefers-color-scheme` even when the shipped theme is dark), a 5th distinct failure mode created the day after this synthesis and never previously folded in. Folded in a SIXTH mode (personal-page-v2,
2026-09-09, `.pandacorp/run/lessons.md`): a hidden Browser pane makes `computer.screenshot` return solid
black regardless of DOM state, and the `playwright screenshot` CLI mis-times staggered reveal transitions.
Eval-gate note (librarian, 2026-09-10): this lesson's evidence already spans panda-corp and personal-page-v2
— activating `status: active`."
provenance: agent-inferred
created: 2026-07-03
status: active
promotion: proposed   # 2026-09-10 (librarian review) — target: factory/standards/debugging.md, add as a "preview/screenshot verification false-signal checklist" alongside DEBUG-1..4 (six named modes: animated canvas timeout, worktree launch.json resolving to main, Turbopack worktree-root confusion, below-fold/opacity black frame, prefers-color-scheme defaulting light, hidden Browser pane forcing solid black). Corroborated across 2 distinct projects (panda-corp + personal-page-v2), synthesizing 6 sibling lessons with zero contradicting evidence — before trusting a preview/screenshot tool's verdict, this checklist is cheaper than re-deriving each mode from scratch.
confidence: medium
times_applied: 1
applied_in: [personal-page-v2]
links: [LESSON-0033, LESSON-0034, LESSON-0039, LESSON-0041, LESSON-0060, LESSON-0069, LESSON-0245]
---

**Situation:** across two projects, five *different* root causes each produced a misleading result from
the preview/screenshot verification tools: a continuously-animated canvas made the tool time out waiting
for quiescence (LESSON-0033); running from inside a git worktree made the tool resolve `launch.json`
(and thus the dev server) back to the main checkout instead of the worktree's own server (LESSON-0034);
`next dev`/Turbopack run from a worktree picked up the wrong workspace root when multiple lockfiles
existed on disk (LESSON-0039); below-the-fold or opacity-transition (scroll-reveal) content came
back as a solid black/blank image because the tool captured before the content's reveal trigger fired
(LESSON-0041); and a headless capture of a page whose theme is driven by `prefers-color-scheme` silently
resolved to the browser's default LIGHT scheme even when the shipped theme was dark (LESSON-0060). Each
was individually diagnosed as "the tool is lying," not "the code is broken" — but each has a distinct
mechanism.

**Lesson:** the preview/screenshot verification tools are not a single reliable oracle — they have
several distinct, non-overlapping failure modes (timeout on animation, stale/wrong-checkout content in
a worktree, wrong workspace root under Turbopack, false-black on reveal-animated/below-fold content, and
a wrong-theme capture on `prefers-color-scheme`-driven pages), and each produces a symptom that
superficially looks like "the real UI is broken or unchanged" when it is actually a tooling artifact.
Treating any single unexpected preview result as proof of a rendering bug — without first ruling out
these known tooling gaps — risks chasing a non-existent bug or, worse, shipping with a stale/wrong
preview.

**Apply next time:** before trusting an unexpected preview_screenshot/dev-server result (timeout, black
frame, wrong theme, or "nothing changed"), check in order: (1) is the route hosting a continuously-animated
canvas (LESSON-0033)? (2) are you running from a git worktree — is `launch.json`/the dev server actually
pointed at the worktree, not main (LESSON-0034)? (3) if using `next dev`, is Turbopack resolving the
correct workspace root given multiple lockfiles (LESSON-0039)? (4) does the target content sit below
the fold or behind an opacity/IntersectionObserver reveal (LESSON-0041)? (5) does the page's theme depend
on `prefers-color-scheme` — was the intended theme forced explicitly before capture, rather than trusting
the headless browser's default color-scheme preference (LESSON-0060)? Only after ruling these out
should an unexpected preview result be treated as evidence of a real rendering defect.

**Sixth mode (2026-09-09, personal-page-v2):** when the Browser pane is hidden (`tabs_context` reports
"pane is currently hidden"), `computer.screenshot` returns a solid BLACK image even though the DOM is
fully rendered (opacity 1, reveals already `is-visible`) — this is a property of the screenshot tool
capturing a hidden pane's backing surface, not the page. Fix: capture via Playwright script directly
(`page.locator(sel).screenshot({ animations: "disabled" })`), not the pane-screenshot tool. The CLI
`playwright screenshot` command is ALSO unreliable for a site using staggered scroll-reveal transitions —
it can capture mid-animation (only the first revealed child, hero H1 missing) because it does not disable
`transitionDelay` the way the primitive's own capture-mode CSS does.

**Apply next time (addendum):** (6) is the Browser pane hidden, or are you relying on the `playwright
screenshot` CLI on a page with staggered reveal transitions — prefer a Playwright script call that
explicitly disables animations over either the pane-screenshot tool or the bare CLI command.
