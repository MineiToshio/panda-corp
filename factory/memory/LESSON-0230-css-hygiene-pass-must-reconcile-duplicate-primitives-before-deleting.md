---
id: LESSON-0230
type: gotcha
domain: css
tags: [css, dead-code, hygiene, knip, duplicate-styles, single-source-of-truth]
context: a dead-code/hygiene pass (e.g. knip) removes a shared CSS primitive because nothing appears to reference it anymore
trigger: use this when a hygiene/dead-code pass is about to delete a shared CSS primitive class, or when rebuilding a primitive that was recently removed
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-12 (agent-inferred, translated from Spanish) — when a hygiene pass deletes a shared primitive for being dead (knip), its CSS often stays orphaned in the foundation stylesheet while surfaces keep copying the markup under ANOTHER class name (here: `.section-header` dead in components.css vs `.sec-head` alive in home.css, with different values). Rebuilding the primitive requires reconciling the two copies and keeping the one pages actually rendered, or two sources of truth for the same style are born (DR-115)."
provenance: agent-inferred
created: 2026-09-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a hygiene/dead-code pass (knip) removed a shared CSS primitive class as unreferenced. In
reality, a second, differently-named copy of the same visual pattern (with slightly different values) had
already been living in a page-specific stylesheet, actively rendered by pages — the "dead" class wasn't
the only implementation of that pattern, just the abandoned one.

**Lesson:** a class flagged dead by static reference analysis (knip or similar) being truly unreferenced
does not mean the *visual pattern* it implements is gone — surfaces may have silently forked a duplicate
copy under a different class name while the shared primitive rotted. Deleting the dead class alone leaves
the fork as the sole, undocumented source of truth for that style. When later rebuilding or auditing a
primitive that hygiene removed, actively search for a duplicate implementation under another name before
assuming the primitive can be recreated from scratch — reconcile the two and keep the one pages actually
render, per DR-115 (single source of truth), rather than ending up with two.

**Apply next time:** before or after a hygiene pass deletes a CSS primitive, grep for sibling
implementations of the same visual pattern under different class names across the stylesheet tree, and
reconcile them into one canonical primitive rather than letting the fork become the unacknowledged truth.
