---
id: LESSON-0570
type: pattern
domain: image-sourcing
tags: [image-sourcing, collectibles, photo-plan, owner-gate, product-process]
context: planning a photo-sourcing step for a physical collectible whose packaging condition (boxed vs loose) determines which image pipeline applies
trigger: use this when building or reviewing a photo/asset-sourcing plan for a packaged physical collectible and the plan checks only size/resolution before marking a candidate image "usable"
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-30 (owner-stated)"
provenance: owner-stated
created: 2026-10-31
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0425, LESSON-0304, LESSON-0329, LESSON-0617]
---

**Situation:** a photo-sourcing plan for packaged collectibles (funko-tracker Funko Pop figures)
classified a candidate image as "usable" purely by checking whether it met a minimum resolution/size
threshold — with no branch on the item's own packaging condition.

**Lesson:** for a physical collectible with a packaging state, the sourcing PIPELINE itself differs by
condition, not just the asset's quality: a **boxed** item with no official box render needs an
owner-approved AI-generated 3/4 render (there is no loose photo to clean up); a **loose/real** item
instead gets a real photo with its background removed via the project's own photo tooling. "Usable by
resolution" is necessary but not sufficient — a plan that checks only size silently SKIPS this
condition branch, and the owner decision (approve the AI render) it requires.

**Apply next time:** when planning a photo-sourcing step for any packaged/condition-variable physical
good, make the condition branch (boxed artwork vs loose photography) an explicit step BEFORE the
size/resolution check, and gate the AI-render path for boxed items behind an explicit owner yes/no —
don't let a resolution-only check imply coverage of both pipelines. Name this branch explicitly in the
plan/skill step that sources the image, not as an implicit assumption.

**Corroborating mechanism (2026-11-05, agent-inferred, funko-tracker):** a generative image worker
(Codex imagegen) consistently REFUSED loose small-figure render jobs (Bitty Pop, Minis, Mystery Minis,
soda cans) when the reference material didn't show the whole figure — 0/8 across three separate
canaries — while the SAME worker succeeded reliably on box renders. This is independent evidence for
why the condition branch above matters: it is not just that loose items need different tooling by
policy, but that the AI-render path for the boxed branch and real-photo-sourcing for the loose branch
are not interchangeable fallbacks — the generative path structurally fails on small loose figures with
incomplete references (consistent with LESSON-0617's "generative image tools are unreliable for
faithful transforms" finding). Route small loose figures to real-photo sourcing or native
acceptance; never retry them through AI generation expecting a different outcome.
