---
id: LESSON-0575
type: pattern
domain: review-process
tags: [ai-disclosure, review-override, owner-gate, collectibles]
context: a review flow where an automated or human reviewer rejects AI-generated images for quality, in a product that already discloses AI-generated content publicly
trigger: use this when an owner wants to override a reviewer's per-item rejection of an AI-generated asset, and the product already carries a public AI-generated-content notice
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-30 (owner-stated)"
provenance: owner-stated
created: 2026-10-31
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** funko-tracker's reviewer flagged several AI-generated images as below the quality bar;
the owner chose to accept some of them anyway, picking the rejected items by number, reasoning that the
app already publicly discloses which images are AI-generated so a lower-fidelity accepted image does not
mislead anyone.

**Lesson:** a quality bar set by an automated reviewer is a DEFAULT, not an absolute gate, when the
product already has an independent disclosure mechanism (a public "AI-generated" notice) covering the
exact risk the quality bar exists to manage (misleading the viewer). The owner is the one positioned to
judge that trade-off case by case, picking specific items to override.

**Apply next time:** when an automated reviewer rejects an asset for quality and the product already
discloses the asset's AI-generated nature to its audience, offer the owner an explicit override path
(accept by item number/id) instead of treating the rejection as final — and record which items were
overridden and why, for the audit trail.
