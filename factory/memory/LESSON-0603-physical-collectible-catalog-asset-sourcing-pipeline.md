---
id: LESSON-0603
type: pattern
domain: image-sourcing
tags: [asset-sourcing, logos, collectibles, catalog-apps, licensing-reference, reflection]
context: synthesis of 8 funko-tracker lessons about sourcing and preparing per-item/per-entity identity
  images (product photos, logos, brand marks) for a catalog/collectible-tracking app
trigger: use this when planning or reviewing the ENTIRE asset-sourcing pipeline (photo + logo + brand mark)
  for a physical-collectible or product-catalog app — before relying on any single sub-rule about
  placeholders, hotlinking, packaging condition, AI restoration, or contrast fixes in isolation
source: "reflection pass, panda-corp memory review 2026-11-03 — synthesizes LESSON-0304, LESSON-0329,
  LESSON-0425, LESSON-0570, LESSON-0593, LESSON-0594, LESSON-0600, LESSON-0601 (all funko-tracker,
  2026-10-13 through 2026-11-01)"
provenance: agent-inferred
created: 2026-11-03
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0304, LESSON-0329, LESSON-0425, LESSON-0570, LESSON-0593, LESSON-0594, LESSON-0600, LESSON-0601]
---

**Situation:** funko-tracker needed to build out a full asset-sourcing pipeline for a physical-collectible
catalog — a real product photo per item, a franchise/brand logo per entity, and placeholder art for items
missing either. Eight separate lessons were harvested over three weeks as this pipeline was built and
corrected piece by piece: mockups needed real photos not placeholder silhouettes (LESSON-0304);
placeholders then needed to be cropped/sized to match real figures and sorted by actual rendered state,
not a proxy flag (LESSON-0329); sourced images needed a hotlink-vs-store-and-license check
(LESSON-0425); the photo plan needed to branch on packaging condition, not just resolution
(LESSON-0570); logo SVGs needed style/grayscale prep before design-tool upload (LESSON-0593); low-contrast
logos tempted a quick invert-filter fix the owner rejected (LESSON-0594); the box-as-reference rule was
over-applied as a sourcing requirement instead of an identity anchor (LESSON-0600); and an AI restoration
pass was tried and rejected 8/8 for altering logo detail (LESSON-0601).

**Lesson:** each individual fix above is correct but narrow; read together they describe ONE recurring
root cause — an asset-sourcing pipeline for real-world collectible items is governed by **fidelity to the
actual physical/licensed source**, not by convenience shortcuts that only look equivalent:
convenience shortcuts repeatedly tried and rejected across this pipeline were (1) a drawn/silhouette
stand-in instead of the real photo, (2) downloading/storing an image instead of checking whether hotlinking
the licensed source is sufficient and compliant, (3) treating a single reference artifact (the box) as a
hard constraint rather than an identity anchor, (4) a generative "restoration" pass instead of a faithful
crop, and (5) a one-line CSS filter instead of sourcing/preparing the correct asset. Every one of these
shortcuts was caught only after it shipped and had to be corrected — the pipeline had no standing checklist
that would have caught them up front.

**Apply next time:** when planning (not just executing) an asset-sourcing pipeline for a physical-product
or collectible catalog, walk every item/entity through this checklist BEFORE implementation, not after a
correction: (1) source the REAL photo/mark, never a placeholder, for anything the owner will judge visually
(LESSON-0304); (2) if a placeholder is unavoidable for some items, crop/size it to match real content and
key its sort/fallback logic on actual rendered state, not a correlated flag (LESSON-0329); (3) check
hotlink-ability and license terms of the authoritative source before deciding to download-and-store
(LESSON-0425); (4) branch the sourcing plan on real-world physical condition (e.g. packaging), not just
file size/resolution (LESSON-0570); (5) prepare brand-mark assets (format, color mode) for the actual
tool they'll be used in, and audit contrast traps before upload (LESSON-0593); (6) never reach for a quick
filter trick (invert, etc.) to patch a visual defect in a brand mark — source or prepare the asset correctly
instead (LESSON-0594); (7) use any single physical reference as an identity ANCHOR to confirm which
entity/franchise is correct, not as a literal requirement the asset must visibly satisfy (LESSON-0600); (8)
never use generative AI "restoration" on a brand mark or identity graphic where any detail drift is
unacceptable — prefer a faithful crop or a normal search (LESSON-0601). The common thread across all eight:
treat "looks visually similar/equivalent" as insufficient — verify fidelity to the real, licensed,
owner-recognizable source at every step of the pipeline.
