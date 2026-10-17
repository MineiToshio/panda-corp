---
id: LESSON-0364
type: pattern
domain: css
tags: [max-width, layout-containment, scoping, owner-correction]
context: a request to make some content "fill the available width" inside an app that has more than one nested max-width constraint
trigger: use this when asked to make a section/panel fill the available width and more than one nested max-width wrapper is present in the layout
source: "factory/memory/_inbox.md owner-stated note — Mission Control, 2026-10-16/17: tab content should fill the app host, not the browser viewport; the outer centered 1240px app max-width had to be preserved while only the narrower inner 920px panel cap was removed — an earlier change had misread the request and removed the outer cap instead"
provenance: owner-stated
created: 2026-10-17
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** asked to make tab content "fill the available width," an earlier change removed the OUTER
app-level max-width constraint (the 1240px centered app container), when the owner's actual intent was to
remove only a NARROWER inner panel cap (920px) nested inside it — the outer constraint was supposed to stay,
defining the whole app's layout envelope.

**Lesson:** a layout can carry more than one nested max-width constraint serving different purposes (an
outer app-shell envelope vs. an inner content-panel cap). A request phrased generically ("fill the available
width") can be satisfied by removing either one, but only ONE of them matches what was actually asked —
removing the wrong one changes the whole app's layout intent, not just the targeted element.

**Apply next time:** before removing a width constraint to satisfy a "fill the width"-style request, locate
and name EVERY nested max-width wrapper between the target element and the viewport, identify which one the
request is actually about (usually the innermost one scoping the specific content, not the outermost
app-shell envelope), and remove only that one — confirm the result against the original overall layout
intent, not just the targeted element looking wider.
