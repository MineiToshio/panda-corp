---
id: LESSON-0613
type: pattern
domain: data-modeling
tags: [catalog, dedupe, bundle-products, data-ingestion, manufacturer-id]
context: ingesting a product catalog that includes both bundle/multi-pack products and their individual component products
trigger: use this when a catalog import includes bundle (multi-item-pack) products alongside their individual components and a dedupe pass is needed
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-03 (agent-inferred): Pop! & Tee figures were double-recorded as standalone Pop!; check Funko item IDs to dedupe bundle-only figures"
provenance: agent-inferred
created: 2026-11-04
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a catalog ingestion recorded a figure that only exists bundled inside a "figure + apparel"
pack as if it were ALSO a separately-sold standalone figure — title-based matching treated the bundled
figure and a same-named standalone figure as the same catalog entry when they were not, or missed that the
bundle-only figure had no standalone counterpart at all.

**Lesson:** a bundle/multi-pack product and its individual components are a common source of catalog
double-recording: title text alone does not reliably distinguish "sold only inside this bundle" from "also
sold standalone" or "a separate bundle-exclusive variant." The manufacturer's own item/SKU id (not display
title) is the reliable signal for whether two catalog entries are actually the same product or must stay
distinct.

**Apply next time:** when ingesting a catalog that includes bundle/multi-pack products, dedupe/cross-check
bundle components against standalone listings using the manufacturer's item/SKU id, never title-text
matching alone — a bundle-exclusive component with no standalone SKU should be recorded once, tied to the
bundle, not duplicated as if it were an independent product.
