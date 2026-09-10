---
id: LESSON-0215
type: gotcha
domain: build-tooling
tags: [content-collections, mdx, parallel-sessions, gate, false-positive]
context: running a full verify.sh/gate pass while a parallel subagent or session is still mid-edit on ANY content file consumed by @content-collections
trigger: use this when a gate red spans multiple unrelated content-driven pages (home, blog, contact, an unrelated case study) right after or during a parallel subagent's write to a different content file
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-08 (agent-inferred) — a subagent still mid-edit on content/about/*.mdx caused a full gate run to fail 24 unrelated pages (home, blog, contact, a case-study lightbox) with no relation to the file being edited"
provenance: agent-inferred
created: 2026-09-10
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0106, LESSON-0122, LESSON-0131, LESSON-0032]
---

**Situation:** `@content-collections` compiles ALL of a project's content collections together as one
build step, not file-by-file or collection-by-collection. While a subagent was still mid-write on an
`about` MDX file, a full gate run triggered a content-collections compile that failed on the half-written
file — but the failure surfaced as 24 broken pages spanning home, blog, contact and an unrelated
case-study lightbox, none of which touch the `about` collection at all, because the whole compile step
failed as a unit and every page that imports ANY compiled content module broke together.

**Lesson:** a broad, scattered gate failure across content-driven pages that share no obvious relationship
to each other is a strong signature of a content-collections compile failure caused by a file still being
actively written, not a real cross-page regression — the same "structural, not code" shape LESSON-0040's
dev-server family and LESSON-0124/0125's worktree-glob family already teach for other whole-tree build
steps: a single shared compile/build unit means one half-finished input can break everything downstream of
it, however unrelated the symptom pages look.

**Apply next time:** before diagnosing a broad, page-spanning content-collections gate failure as a real
regression, check `ListAgents` (or equivalent) for any subagent still actively writing a content file in
this or a related collection — a live writer racing the gate is the first thing to rule out, not the last.
Never "fix" tests reacting to this pattern (widely scattered failures with no shared code path) without
first confirming no parallel write is in flight.
