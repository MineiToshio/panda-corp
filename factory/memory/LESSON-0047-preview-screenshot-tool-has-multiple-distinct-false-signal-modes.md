---
id: LESSON-0047
type: pattern
domain: preview-tooling
tags: [preview-screenshot, verification, worktree, false-negative, false-positive, axe, animation]
context: using the preview/screenshot verification tools (preview_screenshot, dev-server DOM checks) to confirm a UI change actually landed
trigger: use this when a preview/screenshot verification tool returns an unexpected result (timeout, black/blank image, or stale content) and you are about to conclude that the UI itself is broken or unchanged
source: "panda-corp + personal-page-v2 2026-07-03 harvest — synthesized from LESSON-0033 (canvas timeout), LESSON-0034 (worktree launch.json resolves to main), LESSON-0039 (next dev worktree lockfile confusion), LESSON-0041 (black screenshot on below-fold/opacity content). Folded in 2026-07-16 (librarian review): LESSON-0060 (personal-page-v2 .pandacorp/run/lessons.md 2026-07-03 — headless capture defaults to light `prefers-color-scheme` even when the shipped theme is dark), a 5th distinct failure mode created the day after this synthesis and never previously folded in. Folded in a SIXTH mode (personal-page-v2,
2026-09-09, `.pandacorp/run/lessons.md`): a hidden Browser pane makes `computer.screenshot` return solid
black regardless of DOM state, and the `playwright screenshot` CLI mis-times staggered reveal transitions.
Eval-gate note (librarian, 2026-09-10): this lesson's evidence already spans panda-corp and personal-page-v2
— activating `status: active`. Folded in a SEVENTH mode (funko-tracker, 2026-10, `.pandacorp/run/lessons.md`
2026-10 harvest): axe-core's color-contrast check can false-positive on cards still mid stagger/entrance
animation — the contrast measurement samples a transient, partially-faded frame, not the settled color.
Folded in an EIGHTH and NINTH mode (pandasaga, 2026-10-13/14, `.pandacorp/run/lessons.md`): (8) the
built-in browser pane's `computer scroll` sometimes does not move the page under an emulated viewport —
`javascript_tool`'s `scrollTo()` is reliable where it isn't; also, after a click that re-renders (e.g. a
theme toggle), re-querying the element is required — reading the previously-fetched node reports stale
state; (9) a full-page screenshot of a page with `loading=\"lazy\"` images can capture them blank even
after switching to eager loading — the fix is awaiting `img.decode()` (with a timeout) before capturing,
not just changing the loading attribute."
provenance: agent-inferred
created: 2026-07-03
status: active
promotion: proposed   # 2026-09-10 (librarian review) — target: factory/standards/debugging.md, add as a "preview/screenshot verification false-signal checklist" alongside DEBUG-1..4 (seven named modes: animated canvas timeout, worktree launch.json resolving to main, Turbopack worktree-root confusion, below-fold/opacity black frame, prefers-color-scheme defaulting light, hidden Browser pane forcing solid black, axe color-contrast measured mid stagger-animation). Corroborated across 3 distinct projects (panda-corp + personal-page-v2 + funko-tracker), synthesizing 7 sibling lessons with zero contradicting evidence — before trusting a preview/screenshot/a11y tool's verdict, this checklist is cheaper than re-deriving each mode from scratch.
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

**Seventh mode (2026-10, funko-tracker):** running an axe-core accessibility pass over cards that are
still mid stagger/entrance animation (opacity/transform transitioning in on load or on scroll) can
report a color-contrast VIOLATION that doesn't exist once the animation settles — axe samples the DOM's
computed color at the instant it runs, and a card captured mid-fade genuinely has lower contrast than
its final state, so the tool is not wrong about that instant, but that instant is not representative of
what a user actually sees. Treating it as a real defect and "fixing" the settled colors would be
chasing a symptom that isn't there.

**Apply next time (addendum):** (7) before trusting an axe-core color-contrast violation on a page with
entrance/stagger animations, wait for the animation to settle (or force `prefers-reduced-motion:
reduce` so the browser skips the transition) before measuring, and re-run axe on the settled state —
confirm the violation persists before changing any colors.

**Eighth mode (2026-10-13/14, pandasaga):** the built-in browser pane under an emulated viewport can
silently fail to move the page on a `computer scroll` command — the DOM doesn't change but no error is
raised either. `javascript_tool`'s `scrollTo()`/`scrollIntoView()` reliably moves the page where the
pane's own scroll command doesn't. Separately (a general interaction gotcha, not screenshot-specific):
after any click that triggers a re-render (a theme toggle, a state change), a previously-fetched element
reference can report stale attributes/text — re-query the element from the live DOM before asserting on
it, rather than trusting a handle captured before the re-render.

**Ninth mode (2026-10-14, pandasaga):** a full-page screenshot of a page containing `loading="lazy"`
images (especially large PNGs) can capture them blank even when the loading strategy is switched to
eager — eager loading starts the fetch sooner, but the screenshot can still fire before the image has
finished DECODING, producing a visually blank portrait that looks like a missing-asset bug.

**Apply next time (addendum):** (8) if a scroll command inside the browser pane appears to have no
effect, retry via `javascript_tool`'s `scrollTo()` before concluding the page is stuck, and always
re-query an element after any click that could trigger a re-render rather than reusing a captured
reference. (9) before a full-page screenshot of a page with lazy-loaded images, await `img.decode()`
(with a timeout) for each image rather than merely switching `loading` to eager — a blank captured
portrait after a reveal/eager-load change is this race, not a layout regression.
