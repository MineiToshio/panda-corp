---
id: BL-0273
type: bug
area: build-engine
title: "count-lesson-citations.sh must exclude design mockups/fixtures from a project whose own feature displays LESSON ids as content"
status: open
severity: p1
opened: 2026-10-22
closed:
source: "mission-control memory harvest, 2026-10-22 (agent-inferred): running `count-lesson-citations.sh mission-control factory/memory` falsely bumped applied_in/times_applied on 30 unrelated lessons (LESSON-0003..0036)"
closes:
links: []
---

## Problem
`plugin/scripts/count-lesson-citations.sh` scans `<project>/docs/**/*.md` + `<project>/.pandacorp/comms/*.md`
for literal `LESSON-\d{4}` strings and records every match as genuine retrieval evidence (bumping
`applied_in`/`times_applied` on the cited lesson). Running it against mission-control falsely matched 30
lessons (LESSON-0003 through LESSON-0036) that mission-control's build never actually retrieved or applied.

Two concrete sources, both `.md` files under `mission-control/docs/`:
1. `docs/design/prototype/fixtures/factory-root/factory/memory/LESSON-NNNN-*.md` — a full fixture COPY of
   `factory/memory/` lessons, created to test Mission Control's own FRD-17 "Propuestas" feature (which reads
   and displays `factory/memory/` lesson files as app content). Every fixture file's own `id: LESSON-NNNN`
   frontmatter line matches the scan regex.
2. `docs/design/freeze/packs/frd-17.md` (and FRD-17's blueprint/fdd/work-order docs) — the design-freeze
   context pack and spec for the SAME "Propuestas" feature, which legitimately quotes example `LESSON-NNNN`
   ids as illustrative UI copy (the feature's whole job is to show lesson cards), not as evidence the
   project's OWN build retrieved and applied those lessons.

Impact: the citation counter's whole purpose (DR-047 loop v2 — measuring genuine retrieval, never agent
self-report) is defeated for any project whose own product feature happens to display or mock `LESSON-NNNN`
strings as content. This is a real, structural risk specifically for Mission Control (the only project with
a "show memory lessons" feature) but would recur for any future "memory/lessons dashboard"-style feature in
another project. Caught and reverted before commit in this harvest; left uncorrected the next run would
silently repeat it and compound the pollution (confidence inflation, premature `promotion: proposed`
auto-escalation at >=3 citing projects).

## Root cause
The scan has no way to distinguish "this project's build artifact cites a lesson because it applied it" from
"this file's content happens to contain the literal string `LESSON-NNNN`" — it is a bare regex over every
`.md` file under `docs/`, with no exclusion for design mockups, fixtures or any directory whose purpose is to
hold SAMPLE/demo data rather than genuine build artifacts.

## Fix plan
1. In `count-lesson-citations.sh`'s `scan_globs`, exclude known non-artifact subtrees before matching:
   `docs/design/prototype/**` (prototype HTML/fixtures/mocks, DR-056) and `docs/design/freeze/packs/**`
   (context packs, which quote FRD content verbatim and can include mocked IDs) at minimum.
2. More robust alternative (consider alongside #1): require a citation line to match a stricter pattern that
   distinguishes genuine citation prose (e.g. "per LESSON-NNNN", "cite LESSON-NNNN", inside a Status Note or
   commit-message-style line) from a bare frontmatter `id: LESSON-NNNN` declaration or an inline code span
   quoting an example id — the project's own `ai-implementation.md` rule already says citations belong in "the
   commit message or the work order's Status-Note", which is a narrower, more scannable target than all of
   `docs/**/*.md`.
3. Add a regression fixture under `plugin/scripts/fixtures/` modeled on this incident (a project with a
   `docs/design/prototype/fixtures/factory-root/factory/memory/LESSON-NNNN-*.md` subtree) that must NOT be
   counted, alongside a genuine citation in a real FRD/blueprint that MUST be counted.

## Tests (prove the fix — TDD, RED → GREEN)
- A test fixture project with (a) a mock/fixture `.md` file containing `id: LESSON-0003` and (b) a real
  blueprint `.md` file containing a genuine citation sentence for `LESSON-0010`: before the fix, both are
  counted (RED, since (a) should not be); after the fix, only (b) is counted (GREEN).

## Done when
- The regression fixture test passes.
- Re-running `count-lesson-citations.sh mission-control factory/memory` after the fix reports 0 new
  citations from the fixtures/packs subtrees.
- Plugin PATCH version bumped (bug fix) + manifests regenerated; decision log entry.

## Out of scope
- Redesigning the citation-measurement mechanism itself (DR-047's "cite in a durable artifact" contract) —
  this item only fixes the scan's false-positive sources.
