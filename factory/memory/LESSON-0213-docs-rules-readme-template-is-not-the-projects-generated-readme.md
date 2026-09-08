---
id: LESSON-0213
type: gotcha
domain: factory-engineering
tags: [upgrade, docs-rules, drift-check, scaffold, templates]
context: manually checking a project's docs/rules/README.md for drift against the factory's own templates during an /pandacorp:upgrade or ad hoc conformance review
trigger: use this when comparing a project's docs/rules/README.md against a factory template file to detect drift
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-07, agent-inferred"
provenance: agent-inferred
created: 2026-09-08
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0127]
---

**Situation:** `plugin/templates/rules/README.md` LOOKS like the template a project's
`docs/rules/README.md` is copied from (same filename, same folder shape), but it is not — it is the
factory's own internal catalog documenting the injection MECHANISM for plugin developers (the
`applies_when` tokens, how rule files are chosen). The actual generation spec for a project's
`docs/rules/README.md` (imports plus a filtered table of only the rule files that actually landed in that
project) lives in `plugin/skills/scaffold/SKILL.md` under "Generating `docs/rules/README.md`", referenced
by `architecture`, `upgrade`, and `adopt` alike.

**Lesson:** diffing a project's `docs/rules/README.md` directly against `plugin/templates/rules/README.md`
produces a large false-positive drift report — the two files serve different audiences and have entirely
different expected content, despite living in matching-named locations.

**Apply next time:** to check a project's `docs/rules/README.md` for real drift, regenerate it per the
spec in `plugin/skills/scaffold/SKILL.md` ("Generating `docs/rules/README.md`") and diff against THAT
output — never diff directly against `plugin/templates/rules/README.md`. See BL-0127 for the proposed
disambiguating fix to reduce this confusion at the source.
