---
id: LESSON-0095
type: pattern
domain: documentation
tags: [frd, slug, rename, stable-id, doc-lint]
context: an FRD's folder is renamed after change files/blueprints/work-orders already reference its original slug
trigger: use this when writing or reviewing a doc-lint/reader that matches an FRD by its folder name, or when an FRD folder is renamed mid-build
source: "mission-control .pandacorp/run/lessons.md 2026-07-06 (FRD-17 build) — frd-17-self-learning-loop renamed to frd-17-proposals-inbox between 2026-07-03 and 2026-07-05; a change file's frd: frontmatter kept the old slug"
provenance: agent-inferred
created: 2026-07-06
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** an FRD folder (`docs/frds/frd-NN-<slug>/`) was renamed mid-build after a change file's
`frd:` frontmatter had already been filed against the OLD slug (`frd-17-self-learning-loop` →
`frd-17-proposals-inbox`). The build engine resolves FRDs by their numeric prefix (`frd-17-...`), not the
full slug, so this rename did not break the build — the engine kept working transparently.

**Lesson:** the FRD **number** is the stable identifier across a feature's lifetime; the slug half of the
folder name is descriptive and can legitimately drift if a feature's scope/name is clarified after filing
(a rename is a normal, healthy edit, not a bug). Any doc-lint, reader, or cross-reference check that
matches an FRD reference by comparing the FULL slug string (rather than just the number) is fragile to
this — it should tolerate a name-mismatch (`frd-17-proposals-inbox` referenced as `frd-17-self-learning-loop`)
as long as the number matches, because the engine itself already treats the number as authoritative.

**Apply next time:** when writing or reviewing any FRD-matching logic (doc-lint, cross-reference
validators, change-file `frd:` frontmatter readers), parse and compare the **FRD number**, not the full
folder slug; treat a slug mismatch on a matching number as a rename to be tolerated (or at most flagged
as "stale slug, refresh it"), never as a broken reference.
