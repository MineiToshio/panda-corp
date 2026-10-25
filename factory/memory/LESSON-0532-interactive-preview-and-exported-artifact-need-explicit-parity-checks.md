---
id: LESSON-0532
type: pattern
domain: testing
tags: [visual-parity, export, preview, print, rendering-pipeline]
context: a feature that renders the same content through two different pipelines — an interactive in-app preview and a separately generated exported/rendered artifact (a PDF, a poster PNG, a print sheet)
trigger: use this when a feature has both a live preview AND a separately rendered export of the same content, and you are about to ship a visual change to either one
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 (owner-stated) — the owner's explicit rule for the checklist-export poster feature: preview and export must look identical, and every visual change gets verified against BOTH, never just one"
provenance: owner-stated
created: 2026-10-25
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0521, LESSON-0382]
---

**Situation:** a feature renders the same visual content through two independent pipelines — an
in-app interactive preview (the live DOM) and a separately generated exported artifact (a rendered
poster PNG, produced by a different rendering path/sandbox). The owner's standing rule: these two must
look identical, and that parity is explicitly re-checked for every visual change, not assumed to hold
once established.

**Lesson:** two independently-implemented rendering pipelines for "the same" visual output WILL drift
unless parity is a first-class, explicitly re-verified property — not a one-time fact established at
launch. This is the same underlying hazard as LESSON-0521 (a sandboxed renderer's own asset mirror
silently diverging from the live preview) generalized beyond assets to ANY visual property (layout,
spacing, color, new elements): a change applied to one pipeline (fixing the preview's CSS, say) has no
mechanism forcing the other pipeline (the export renderer) to follow, so the two drift apart silently,
one visual change at a time, until an explicit side-by-side check catches it.

**Apply next time:** whenever a feature maintains both an interactive preview and a separately-rendered
export of the same content, treat "preview and export match" as an explicit acceptance criterion for
EVERY visual change to either pipeline — not just the ones that are "about" the export. Verify both
outputs side by side (a diff or a manual side-by-side check) before considering a visual change done,
and extend this same discipline to any newly added asset category or visual element, not only pre-existing
ones.
