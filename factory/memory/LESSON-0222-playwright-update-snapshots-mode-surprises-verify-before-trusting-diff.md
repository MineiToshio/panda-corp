---
id: LESSON-0222
type: gotcha
domain: testing
tags: [playwright, visual-regression, snapshots, update-snapshots, false-positive, false-negative]
context: regenerating Playwright visual-baseline snapshots after a real content/copy change, or reviewing whether an already-committed snapshot change reflects an intentional edit
trigger: use this when deciding how to regenerate Playwright snapshots after a copy/content change, or when reviewing an unexpectedly-changed visual baseline and judging whether it is legitimate
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-08/2026-09-10 (2 related agent-inferred incidents, same class): (1) a verification subagent saw a home-mobile baseline differ from what it expected mid-session and, assuming DR-096/099 parallel-session WIP, reverted it — but the real cause was that a full-suite `pnpm exec playwright test e2e/ --update-snapshots` (no path scope) had regenerated every snapshot whose render diverged even slightly from baseline, including one already correctly re-blessed earlier in the SAME session, not a foreign session's WIP; (2) after a small copy change (a 20-character label), bare `-u`/`--update-snapshots` in Playwright 1.61 runs in changed mode (only rewrites snapshots whose comparison fails) and `maxDiffPixelRatio: 0.02` absorbed the small visual change, so the suite passed green against a baseline that still showed the OLD text"
provenance: agent-inferred
created: 2026-09-10
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0036, LESSON-0040, LESSON-0043]
---

**Situation:** two incidents on the same project exposed opposite-looking but related surprises in how
Playwright's `--update-snapshots` decides which baseline PNGs actually get rewritten. In one, a full
unscoped `--update-snapshots` run silently overwrote an unrelated, already-correct baseline (because its
render diverged just enough from the old baseline to count as changed), and a reviewing subagent
misread that legitimate overwrite as a sign of foreign parallel-session WIP and reverted it. In the other,
the SAME bare `--update-snapshots` flag (Playwright 1.61's default "changed" mode) failed to rewrite a
baseline that SHOULD have changed, because the real visual diff from a small copy edit fell within
`maxDiffPixelRatio`'s tolerance — the gate then passed green against a stale screenshot showing old text,
a lying oracle.

**Lesson:** "changed" mode (the default for a bare `-u`/`--update-snapshots`) rewrites exactly the
snapshots whose comparison currently reads as different from baseline — no more, no less — which has two
distinct failure shapes: it can rewrite MORE than intended (an unrelated page whose render varies just
past tolerance gets silently overwritten, which can look like reverted/foreign work to someone reviewing
the diff without checking git log/session context first) or LESS than intended (a real, small content
change that fits within the diff-ratio tolerance never gets flagged as changed, so the baseline never
updates and the test keeps passing against stale content).

**Apply next time:** after any content/copy change that should be visible in a screenshot, force
`--update-snapshots=all` (not the bare `-u`/changed-mode default) and confirm via `git status -- e2e/`
(or the equivalent snapshot path) that the expected PNGs actually changed — do not trust a green run alone
as proof the baseline was refreshed. Conversely, before treating an unexpectedly-changed baseline as
evidence of foreign/reverted work (per LESSON-0043's provenance-evaluation guidance), first check whether a
recent unscoped `--update-snapshots` run in THIS session could explain it before assuming a parallel
session touched it.
