---
id: LESSON-0313
type: anti-pattern
domain: ux-patterns
tags: [navigation, drill-in, breadcrumb, dead-end]
context: implementing a "see all N" / "view more" action that replaces the current view with an expanded one
trigger: use this when a "see all"/"view more" control is about to fully REPLACE the current view (rather than expand inline) to show more items of a group
source: "funko-tracker .pandacorp/comms/iteration.md ronda 6, 2026-10 (owner-stated): a 'Ver las 75' action replaced the current view with no back control or breadcrumb, leaving no way to return to where the user came from"
provenance: owner-stated
created: 2026-10-13
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: []
---

**Situation:** a "see all N" drill-in control replaced the current (filtered/grouped) view with an
expanded list view, with no breadcrumb, back button, or any other visible way to return to the view the
user came from — a navigational dead end.

**Lesson:** any interaction that fully replaces the current view (rather than expanding inline in place)
implicitly promises a way back; omitting it traps the user in the drilled-in view with no obvious
recourse (other than browser-back, if even available). This is easy to miss during design because the
drill-in screen itself looks complete and correct in isolation — the defect is only visible when tracing
the round-trip.

**Apply next time:** any drill-in/expand action that replaces the current view must ship with an
explicit, visible way back (a breadcrumb, a back button/link, or — often simpler — an inline "show
less"/collapse that avoids a view replacement altogether); treat "where does the user end up if they
regret clicking this" as a mandatory design check for every drill-in control.
