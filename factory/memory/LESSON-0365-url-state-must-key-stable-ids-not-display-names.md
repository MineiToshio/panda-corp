---
id: LESSON-0365
type: pattern
domain: frontend
tags: [url-state, routing, persistent-navigation, stable-identifiers]
context: designing persistent/shareable URL state (selected entity, tab, detail location) for an app whose entities can be renamed or newly registered over time
trigger: use this when designing URL-encoded navigation state for an app's selected item/tab/detail location, before choosing what identifies each piece of state in the URL
source: "factory/memory/_inbox.md owner-stated note — Mission Control, 2026-10-17: selected idea/project, tab and reader/detail location must be encoded in URLs so refresh and future project registration preserve navigation, and a display-name change must never break a project's address; the full route inventory had to be researched before implementation"
provenance: owner-stated
created: 2026-10-17
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** designing persistent navigation URLs (so refresh and bookmarking preserve the selected
idea/project, tab, and detail location), the requirement explicitly called out that a later display-name
change must never break an existing project's URL — meaning the URL cannot key state off a human-readable
name that is expected to change.

**Lesson:** a URL segment chosen for human readability (a project's display name, a title) is a liability
the moment that value is allowed to change — every bookmark, share link or browser-history entry keyed on it
breaks silently the next time it's renamed. A stable, never-reused internal ID is the only identifier safe
to encode in a URL meant to survive renames and future registrations.

**Apply next time:** when designing URL state for selectable entities/tabs/detail locations, key every
segment on a STABLE internal identifier (never a display name, title, or anything the owner can rename),
and research the FULL existing route inventory before implementing persistent URLs — retrofitting
stable-ID routing after shareable URLs are already in use is far more disruptive than designing for it up
front.
