---
id: LESSON-0353
type: pattern
domain: product-design
tags: [information-architecture, navigation, surface-reuse, owner-preference]
context: deciding how to surface a new capability (a new view/visualization/feature) inside an app that already has a related, broader surface
trigger: use this when extending an app with a new capability and a narrow dedicated tab/page is the first instinct, while a broader existing surface already covers adjacent ground
source: "factory/memory/_inbox.md owner-stated note — Mission Control, 2026-10-16: the owner preferred reusing the full Architecture surface in both Tablero and Portafolio, with the new ERD nested inside Modelo de datos, instead of adding a narrow dedicated Base de datos tab"
provenance: owner-stated
created: 2026-10-17
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** when deciding where a new logical-data-model/ERD viewer should live in Mission Control, the
first instinct was a new, narrow "Base de datos" tab. The owner instead chose to reuse the existing,
broader Architecture surface (already present in both the Tablero and Portafolio views) and nest the new
viewer inside its existing "Modelo de datos" section.

**Lesson:** when a new capability is adjacent to a context the app already presents, a dedicated new
surface fragments navigation and duplicates chrome that the existing surface already provides (tabs,
headers, routing, consistent styling). The owner's default preference is to extend an existing surface's
context rather than multiply surfaces.

**Apply next time:** before proposing a new dedicated tab/page/view for a capability, check whether an
existing surface already covers the same or adjacent domain (the same entity, the same broader concept).
If it does, default to nesting the new capability inside that existing surface and present the narrower
new-surface option only as an explicit alternative for the owner to reject or accept — never as the
unchallenged default.
