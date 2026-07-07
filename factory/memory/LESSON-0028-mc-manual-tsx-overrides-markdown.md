---
id: LESSON-0028
type: gotcha
domain: mission-control
tags: [mission-control, manual, tsx, markdown, content-source]
context: editing a Mission Control Manual page's content
trigger: use this when editing a Mission Control Manual page under content/manual/ and the change doesn't show up
source: "panda-corp Mission Control 2026-07-02 — hit updating the autoaprendizaje page to loop v2"
provenance: agent-inferred
created: 2026-07-03
status: candidate
promotion: none
confidence: medium
times_applied: 1
applied_in: [mission-control]
links: []
---

**Situation:** a Mission Control Manual page was updated by editing its
`content/manual/<group>/<slug>.md` file, but the visible page did not change at all.

**Lesson:** a Manual page whose slug is registered in `MANUAL_PAGE_COMPONENTS`
(`src/app/manual/manualPages.tsx`) renders from the TSX component, not from the markdown file — the
markdown only feeds the index/fallback listing. Editing the `.md` alone silently does nothing on the
live page for any slug in that registry.

**Apply next time:** before editing a Mission Control Manual page's content, check whether its slug is
registered in `manualPages.tsx`; if so, update the TSX component (and its diagram in
`components/modules/manual-diagrams/` if one exists) — the markdown edit alone will not surface.
