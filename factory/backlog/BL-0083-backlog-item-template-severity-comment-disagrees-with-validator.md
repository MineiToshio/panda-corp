---
id: BL-0083
type: bug
area: templates
title: "factory/backlog/_item-template.md's severity comment ('optional for a change') disagrees with validate-backlog.sh, which requires it unconditionally"
status: open
severity: p2
opened: 2026-07-16
closed:
source: "factory/memory/_inbox.md note (undated, agent-inferred); confirmed live 2026-07-16: plugin/scripts/validate-backlog.sh REQ includes severity unconditionally and TYPES = %w[bug change] (no 'feature')"
closes:
links: [LESSON-0143]
---

## Problem
`factory/backlog/_item-template.md`'s frontmatter comment for `severity` reads:
`severity: p1  # p0 | p1 | p2 (for bugs; optional for a change)`. This is WRONG:
`plugin/scripts/validate-backlog.sh`'s `REQ` list (`%w[id type area title status severity opened]`) and
its `SEV` enum check apply to every item unconditionally, regardless of `type` — a `type: change` item
with an empty/missing `severity` fails validation exactly like a `type: bug` item would. An agent drafting
a new backlog item by following the template's comment alone would author a schema-invalid item and only
discover the mismatch when `validate-backlog.sh` rejects it.

The template's `type` comment (`type: bug # bug (defect in existing tooling) | change (new/adjusted
capability)`) is correct — the enum is confirmed `bug|change` only, no `feature` — but a writer drafting
from memory/habit before checking the enum can still reach for "feature", another small source of
friction this item can close in passing (tighten the comment's wording, no schema change needed there).

## Root cause
The template's descriptive comment and the validator's actual rule were authored independently and have
drifted (the same "prose duplicated a check" class LESSON-0143 documents) — nothing keeps the comment
truthful when the validator's `REQ`/`SEV` logic changes.

## Fix plan
Edit `factory/backlog/_item-template.md`: change the `severity` comment to state it is required for
every item type (`# p0 | p1 | p2 — required for every item, bug or change`), matching
`validate-backlog.sh`'s actual `REQ`/`SEV` enforcement. Leave the `type` comment as-is (already correct)
but consider tightening its wording to make the closed `bug|change` enum unmistakable.

## Tests (prove the fix — TDD, RED → GREEN)
No script test applies (this is a comment-only fix in a template file, not executable logic); prove it by
re-reading the edited template comment against `plugin/scripts/validate-backlog.sh`'s `REQ`/`SEV`/`TYPES`
constants and confirming they now agree. Optionally extend `plugin/scripts/validate-backlog.sh` (or a new
`test-backlog-template.sh`) to grep the template for a stale "optional for a change" string so a future
re-drift is caught mechanically — nice-to-have, not required to close this item.

## Done when
The template's `severity` comment states the field is required for every item type, matching the
validator; the drift is gone.

## Out of scope
Adding new automated drift-detection between the template's comments and the validator's enums beyond the
optional grep check above — the template is prose read by an agent, not itself validated.
