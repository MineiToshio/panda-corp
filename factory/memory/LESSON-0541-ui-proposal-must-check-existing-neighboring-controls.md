---
id: LESSON-0541
type: pattern
domain: design-process
tags: [ui-proposal, mockup, neighboring-controls, layout-collision, owner-review]
context: proposing a UI change (a new control, a repositioned element) on a card/component that already has other controls or decorations nearby
trigger: use this when drafting or reviewing a UI proposal/mockup that adds or repositions a control on a component that already has OTHER controls, decorations, or interactive affordances nearby (e.g. carousel arrows, existing buttons, badges)
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-25 (owner-stated) — the first 'Reservado' footer mockup kept Reservar below Lo tengo but omitted checking the carousel arrows' space, which the owner had to point out before approving"
provenance: owner-stated
created: 2026-10-28
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0421, LESSON-0304, LESSON-0317]
---

**Situation:** a first mockup for a new "Reservado" control correctly preserved the relative order of
an existing control (keep Reservar below Lo tengo) but did not check whether the new control's
footprint collided with or crowded another pre-existing interactive element on the same card — the
photo carousel's side arrows. The owner had to flag the omission before the proposal could be approved.

**Lesson:** a UI proposal that only reasons about the NEW element in isolation (or about one other
element it explicitly supersedes) misses collisions with everything else already occupying that same
space. This is a sibling of LESSON-0421's "full journeys, not one polished screen" (which is about
content realism across a flow) applied at the scale of a single component: evaluating a proposed
control's fit requires explicitly checking it against every OTHER control/affordance already present
on the same surface, not just the one it is conceptually replacing or sitting next to.

**Apply next time:** when proposing a UI change to an existing component, before presenting the
mockup for review, enumerate every other control/decoration already on that component (carousel
arrows/dots, existing buttons, badges, metadata) and explicitly verify the new element's placement
does not crowd, overlap, or change the usability of any of them — include that check in the mockup
itself (e.g. render the carousel in its actual state), not just in a written note that it was
"considered."
