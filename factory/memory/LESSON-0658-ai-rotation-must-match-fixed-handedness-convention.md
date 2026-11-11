---
id: LESSON-0658
type: gotcha
domain: image-generation
tags: [ai-generation, orientation, handedness, collectible-photography, catalog-consistency]
context: generating or reviewing an AI image of a box/product view that must match a catalog's own fixed orientation/handedness convention, where the source reference photo used to brief the generation may legitimately show either side
trigger: use this when briefing or reviewing an AI-generated image that must match a domain's fixed orientation/handedness convention (e.g. a collectible box's 3/4 turn always shown from one named side), not just reproduce a reference photo's own rotation direction
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-09 (owner-stated): 'El giro 3/4 de las cajas SIEMPRE muestra el lateral IZQUIERDO (patrón del catálogo). Una IA que copia el ángulo de una foto real girada al otro lado rompe el patrón; el owner se molestó (no es la primera vez).'"
provenance: owner-stated
created: 2026-11-11
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** an AI-generation step for a collectible box's 3/4-turn view copied the rotation DIRECTION
of whatever real reference photo it was given. The catalog's own established convention is that this
specific view always shows the box's LEFT side, regardless of which side the reference photo happened to
show. The generated image broke that catalog-wide visual consistency — and the owner flagged this was
not the first time the same class of mistake had happened.

**Lesson:** "match the reference photo's rotation" and "match the catalog's fixed orientation
convention" are different instructions that happen to agree only when the reference photo was itself
already turned the correct way. A reference can legitimately be photographed from either side, so an AI
generation step that implicitly derives orientation from "copy what the reference shows" will silently
violate a domain's absolute handedness convention whenever the reference disagrees with it — with no
error signal, because the output still looks like a correctly-posed 3/4 turn.

**Apply next time:** when a domain has a fixed orientation/handedness convention for a specific view
(left-vs-right turn, front-vs-back, which hand holds an object), state that ABSOLUTE convention
explicitly in both the generation prompt and the review checklist, as its own named check — never derive
it implicitly from "match the reference's own rotation." A recurring instance of this exact defect class
(the owner noted "not the first time") is itself a signal to add a standing, explicit check rather than
patch the one occurrence and move on (see LESSON-0240).
