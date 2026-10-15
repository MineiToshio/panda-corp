---
id: LESSON-0320
type: gotcha
domain: design-process
tags: [mockup-data, template, fabricated-content, qa]
context: authoring a detail-page template that includes illustrative/sample sections (e.g. "reprints", "store availability", "also comes in") populated for one demo record while building the design
trigger: use this when a detail-page mockup/prototype is built from one shared template and that template includes illustrative sections only meaningful for a specific demo record
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 harvest (agent-inferred, caught before owner review): a detail-page template's illustrative sections (reprints, store availability, \"also comes in\") were populated with specific sample facts for one demo record, but — because they lived in the shared template rather than per-record data — rendered the SAME invented facts on EVERY other record's detail page, presenting fabricated information as if it were real for items that have none of those facts"
provenance: agent-inferred
created: 2026-10-15
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0311]
---

**Situation:** a detail-page template authored illustrative sample sections directly as part of the
shared template markup (rather than as per-record conditional data) to make one demo record look
fully fleshed out. Because the content lived in the template, it rendered identically on every
record's detail page — presenting invented facts as real for items that had no such facts at all.

**Lesson:** a shared page template built around ONE illustrative demo record silently generalizes that
record's sample content to every record rendered through the same template, unless the sample-only
sections are explicitly gated to the demo record. This is a distinct failure from cross-screen data
INCONSISTENCY (LESSON-0311) — here, a single record's fabricated detail leaks everywhere, presenting
fiction as fact for records that have no such property at all.

**Apply next time:** when a page template includes any illustrative/sample-only section built to make
one demo record look complete, explicitly gate that section to the demo record (a flag/condition, not
ambient template markup), and spot-check a few OTHER records' rendered detail pages before presenting
the template to the owner — a template audit that only ever looks at the demo record cannot catch this.
