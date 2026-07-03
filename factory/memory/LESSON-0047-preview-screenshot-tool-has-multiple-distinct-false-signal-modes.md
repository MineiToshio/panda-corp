---
id: LESSON-0047
type: pattern
domain: preview-tooling
tags: [preview-screenshot, verification, worktree, false-negative, false-positive]
context: using the preview/screenshot verification tools (preview_screenshot, dev-server DOM checks) to confirm a UI change actually landed
trigger: use this when a preview/screenshot verification tool returns an unexpected result (timeout, black/blank image, or stale content) and you are about to conclude that the UI itself is broken or unchanged
source: "panda-corp + personal-page-v2 2026-07-03 harvest — synthesized from LESSON-0033 (canvas timeout), LESSON-0034 (worktree launch.json resolves to main), LESSON-0039 (next dev worktree lockfile confusion), LESSON-0041 (black screenshot on below-fold/opacity content)"
provenance: agent-inferred
created: 2026-07-03
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0033, LESSON-0034, LESSON-0039, LESSON-0041]
---

**Situation:** across two projects, four *different* root causes each produced a misleading result from
the preview/screenshot verification tools: a continuously-animated canvas made the tool time out waiting
for quiescence (LESSON-0033); running from inside a git worktree made the tool resolve `launch.json`
(and thus the dev server) back to the main checkout instead of the worktree's own server (LESSON-0034);
`next dev`/Turbopack run from a worktree picked up the wrong workspace root when multiple lockfiles
existed on disk (LESSON-0039); and below-the-fold or opacity-transition (scroll-reveal) content came
back as a solid black/blank image because the tool captured before the content's reveal trigger fired
(LESSON-0041). Each was individually diagnosed as "the tool is lying," not "the code is broken" — but
each has a distinct mechanism.

**Lesson:** the preview/screenshot verification tools are not a single reliable oracle — they have
several distinct, non-overlapping failure modes (timeout on animation, stale/wrong-checkout content in
a worktree, wrong workspace root under Turbopack, and false-black on reveal-animated/below-fold
content), and each produces a symptom that superficially looks like "the real UI is broken or
unchanged" when it is actually a tooling artifact. Treating any single unexpected preview result as
proof of a rendering bug — without first ruling out these known tooling gaps — risks chasing a
non-existent bug or, worse, shipping with a stale/wrong preview.

**Apply next time:** before trusting an unexpected preview_screenshot/dev-server result (timeout, black
frame, or "nothing changed"), check in order: (1) is the route hosting a continuously-animated canvas
(LESSON-0033)? (2) are you running from a git worktree — is `launch.json`/the dev server actually
pointed at the worktree, not main (LESSON-0034)? (3) if using `next dev`, is Turbopack resolving the
correct workspace root given multiple lockfiles (LESSON-0039)? (4) does the target content sit below
the fold or behind an opacity/IntersectionObserver reveal (LESSON-0041)? Only after ruling these out
should an unexpected preview result be treated as evidence of a real rendering defect.
