---
id: BL-0127
type: change
area: templates
title: "Disambiguate plugin/templates/rules/README.md from a project's generated docs/rules/README.md"
status: open
severity: p2
opened: 2026-09-08
closed:
source: "factory/memory/LESSON-0213 (personal-page-v2 .pandacorp/run/lessons.md 2026-09-07, agent-inferred) — an agent doing a manual drift check diffed a project's docs/rules/README.md directly against plugin/templates/rules/README.md and got a large false-positive drift report"
closes:
links: [LESSON-0213]
---

## Problem
`plugin/templates/rules/README.md` and every project's generated `docs/rules/README.md` share a filename
and a folder shape (`rules/README.md`), which strongly implies one is copied from the other — but they are
not. `plugin/templates/rules/README.md` is the factory's own internal catalog explaining the injection
mechanism (the `applies_when` tokens) for PLUGIN DEVELOPERS. A project's `docs/rules/README.md` is a
different, generated artifact — an index of exactly the rule files that landed in THAT project, produced
by the spec in `plugin/skills/scaffold/SKILL.md` under "Generating `docs/rules/README.md`" (also used by
`architecture`, `upgrade`, `adopt`). An agent doing a manual drift/conformance check that diffs the
project copy against the template file (the naturally-reached-for comparison, given the matching names)
gets a large false-positive drift report, because the two files are supposed to have entirely different
content.

## Root cause
No signal in either file's content warns a reader that they are NOT a source/copy pair, despite occupying
matching-named locations (`templates/rules/README.md` vs `docs/rules/README.md`). The real generation spec
lives in a third location (`plugin/skills/scaffold/SKILL.md`) that isn't discoverable from either file
alone.

## Fix plan
Add a short, explicit header note (a comment block or an early paragraph) to `plugin/templates/rules/README.md`
stating plainly: "This file is NOT copied into projects. A project's own `docs/rules/README.md` is
generated separately — see `plugin/skills/scaffold/SKILL.md` § Generating `docs/rules/README.md` for that
spec." Cross-reference in the other direction is optional (the generated project README is produced
programmatically, not hand-maintained, so a header there is lower value, but consider a one-line HTML
comment at the top of the generated output if the generator supports it cheaply).

## Tests (prove the fix — TDD, RED → GREEN)
Manual repro: before the fix, `plugin/templates/rules/README.md` has no text indicating it isn't the
project template; after the fix, a `grep` for the disambiguating sentence in the file succeeds. No gate
canary needed — this is a documentation-clarity fix, not a behavior change; automated proof beyond the
grep check is not applicable (doc-lint, if it checks required substrings, may be extended to assert this
header is present, but that is optional polish, not required for `done`).

## Done when
`plugin/templates/rules/README.md` carries the disambiguating header pointing to `plugin/skills/scaffold/SKILL.md`;
plugin version bumped per semver (PATCH — doc clarity, no behavior change); LESSON-0213 back-linked.

## Out of scope
Restructuring where either README lives, or changing the generation mechanism itself.
