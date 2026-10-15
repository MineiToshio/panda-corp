---
id: LESSON-0318
type: gotcha
domain: requirements
tags: [domain-jargon, terminology, asset-sourcing, clarification]
context: a brief uses a domain-specific term that has more than one plausible meaning WITHIN the same narrow niche, before any asset sourcing or implementation work begins
trigger: use this when a brief or spec uses a niche domain term (not a layperson-vs-expert gap, but a term that is polysemous even among people expert in that exact niche) and work (asset sourcing, data modeling, implementation) is about to start from one assumed meaning
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 harvest (owner-stated correction): the term \"stickers\" was initially read as retailer/convention-exclusive stickers, but for this collector niche it specifically means the variant-TYPE stickers printed on the box (Chase, Glow, Flocked, Metallic, Diamond, Scented, Chrome, Black Light) — a different, non-overlapping asset category; the wrong assumption had already driven asset sourcing before the correction"
provenance: owner-stated
created: 2026-10-15
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a niche-domain term in a brief ("stickers", in a physical-collectible catalog context)
was read with its most common sense and used to drive asset sourcing, before realizing the term has a
second, unrelated meaning specific to this exact collector niche (box variant-type markers rather than
retailer/event exclusivity markers) — and that the owner meant the second one.

**Lesson:** domain jargon ambiguity is not only a layperson-vs-expert gap; a single term can have
multiple genuinely distinct meanings WITHIN the same narrow community of practice, and picking the
wrong one wastes real downstream work (sourcing the wrong asset category, modeling the wrong field).
The surface-level plausibility of a reading is not evidence it's the right one in that specific niche.

**Apply next time:** when a brief uses a term from a narrow domain/hobby/niche and more than one
plausible in-niche meaning exists, confirm with the owner which meaning is intended BEFORE sourcing
assets, modeling data, or writing code around that assumption — a short clarifying question is cheaper
than redoing the sourcing/modeling work after guessing wrong.
