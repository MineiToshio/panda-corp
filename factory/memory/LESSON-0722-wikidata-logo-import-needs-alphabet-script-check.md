---
id: LESSON-0722
type: gotcha
domain: data-ingestion
tags: [wikidata, bulk-import, i18n, logos, data-quality]
context: bulk-importing a reference image/logo asset from a general knowledge graph (Wikidata) keyed by entity id, for a few hundred distinct entities at once
trigger: "use this when sourcing logo/brand/reference images for many entities at once from Wikidata (or a similar general knowledge graph) rather than curating each by hand"
source: "funko-tracker — .pandacorp/run/lessons.md note (2026-11-22): 482 franchise logos imported from Wikidata without a script/alphabet review; the Haikyu!! logo resolved to an Arabic-script release variant instead of the expected Japanese/Latin one"
provenance: agent-inferred
created: 2026-11-23
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---
**Situation:** a bulk import pulled a "logo image" claim per entity from Wikidata for ~482 franchises. The import only checked that an image claim existed and resolved — not which localized/regional release variant of that image Wikidata happened to have on file. For at least one entity (Haikyu!!, a Japanese franchise), the resolved image was a non-Latin, non-Japanese (Arabic) regional logo variant — visually wrong for the common/expected usage, but not something an "image exists and loaded" check would ever catch.

**Lesson:** Wikidata (and knowledge graphs generally) often carry MULTIPLE regional/localized variants of the "same" media claim (a logo, a poster, a title treatment) for one entity, and the property/claim selection logic that picks "the" image for an entity can silently land on a variant in the wrong script or language for that entity's primary/expected market — with zero error signal, because the claim is legitimately a real, valid image of the real entity.

**Apply next time:** a large-scale, unattended import of logo/brand reference images keyed through a general knowledge graph needs an explicit script/alphabet (or locale) consistency check against the entity's expected language/market before accepting the claim automatically — e.g., flag any imported logo whose dominant text script doesn't match the entity's origin-country script, for a human spot-check, rather than trusting "an image resolved" as sufficient.
