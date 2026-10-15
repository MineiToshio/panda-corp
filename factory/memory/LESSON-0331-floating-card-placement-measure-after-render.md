---
id: LESSON-0331
type: pattern
domain: ui-layout
tags: [positioning, map-ui, tooltip, collision-detection, responsive]
context: placing a floating info card/tooltip next to a variable-position anchor (a map pin, a marker) where a static "opposite corner" rule can still overlap other content
trigger: use this when a floating card/tooltip must be positioned next to a variable anchor (map pin, marker, hover target) and other elements (other pins, labels) can occupy any side
source: "pandasaga .pandacorp/run/lessons.md 2026-10-13/14 (agent-inferred): a static 'opposite side' placement rule for a map-pin info card ignored other pins/labels and the card's own real rendered height (60-77% of a small map), causing frequent overlaps"
provenance: agent-inferred
created: 2026-10-15
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a floating card shown next to a clicked map pin used a fixed "place it on the side
opposite the click" rule. On a small map this card's real height could be 60-77% of the map's own
height, and the rule took no account of OTHER pins/labels nearby — the card routinely covered content it
was never supposed to hide.

**Lesson:** a static directional placement rule for a floating element next to a variable anchor cannot
account for the anchor's actual neighbors or the card's own real rendered size, computed only at render
time. The robust approach measures AFTER render: try each candidate corner/side in turn, keep the first
whose bounding rect intersects no other pin/label rect, and fall back to a docked (non-floating) position
if none is free.

**Apply next time:** for any floating element anchored to a variable-position element with other
occupants nearby, measure the element's real rendered bounding box and the candidate positions' rects
AFTER layout (not before), iterate corners/sides in a fixed preference order, and keep a docked fallback
for when every floating position collides.
