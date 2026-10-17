---
id: LESSON-0366
type: gotcha
domain: factory-engineering
tags: [dr-033, framework-vs-personal-data, project-id, in-repo-tool, portability]
context: an in-repo embedded tool (e.g. Mission Control, which lives inside the factory's own repo) has a local identity/identifier value that is specific to THIS machine's clone
trigger: use this when an in-repo embedded tool needs to persist its own locally-scoped identity/identifier and a committed framework file looks like the convenient place to put it
source: "factory/memory/_inbox.md agent-inferred note — Mission Control, 2026-10-17: a local identity (projectId) was found versioned inside the shared framework; leaves orphaned references when another owner clones the factory — sibling projects keep their reference per their own repo's contract instead"
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0090, DR-033]
---

**Situation:** Mission Control, living inside the factory's own repo (an in-repo embedded tool, not a
sibling project with its own repo), had a locally-scoped identity value (`projectId`) committed into the
shared, cloneable framework. Any OTHER owner cloning the factory would inherit that same value — an
orphaned reference pointing at nothing meaningful in their own clone, since sibling projects normally carry
their own identity per their own repo's contract (gitignored or self-contained), not via the shared
framework.

**Lesson:** an in-repo embedded tool is still subject to DR-033's framework-vs-personal-data split, even
though it physically lives inside the committed repo tree rather than a sibling folder — any identifier that
is specific to ONE clone/owner (not a structural fact every clone needs) does not belong committed to the
shared framework, the same way `factory/profile.md` or `portfolio.md` don't.

**Apply next time:** before committing an identifier/config value for an in-repo embedded tool to the
shared framework, ask whether every future clone of the factory needs the SAME value (framework) or whether
it is specific to this one owner's local state (personal, gitignored, backed up per `pandacorp-vault` like
any other gitignored owner data) — never default to committing it just because the tool happens to live
inside the versioned repo tree.
