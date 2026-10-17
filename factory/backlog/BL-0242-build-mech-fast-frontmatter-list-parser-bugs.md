---
id: BL-0242
type: bug
area: build-engine
title: "build-mech-fast.mjs frontmatter list parser breaks on comma-bearing inline lists and merges a second block list"
status: open
severity: p1
opened: 2026-10-17
closed:
source: "pandasaga .pandacorp/run/lessons.md 2026-10-15 (agent-inferred): \"plugin/scripts/build-mech-fast.mjs fmList splits inline lists on ',' (breaks brace globs like src/{a,b}/** in artifacts: [...]) and its block-list branch collects EVERY later indented '- ' line, not stopping at the next key (a second block list after it merges in). Work-order frontmatter must keep inline lists comma-free and put the only block list (artifacts) last; the work-order template/skill should say so or the parser should be fixed.\""
closes:
links: []
---

## Problem

`plugin/scripts/build-mech-fast.mjs`'s `fmList` frontmatter-list parser has two distinct bugs when reading
a work order's YAML-ish frontmatter without a real YAML parser:

1. **Inline lists split on bare `,`** — an inline list value like `artifacts: [src/{a,b}/**, other/file.ts]`
   gets split into `src/{a`, `b}/**`, ` other/file.ts` because the splitter has no awareness of brace
   globs (or any other comma-bearing token) inside the brackets.
2. **Block-list collection has no stop condition at the next key** — when a frontmatter field is written
   as a YAML block list (`artifacts:\n  - foo\n  - bar`), the block-list branch keeps consuming every
   subsequent indented `- ` line it finds, even past the next top-level `key:` line, so a SECOND block
   list appearing later in the same frontmatter gets silently merged into the first field's value.

Both bugs are real parsing defects in this specific script (this is a hand-rolled frontmatter reader, not
a YAML library) and both produce silently wrong data (a few-entries list polluted or truncated) rather than
a loud failure — the kind of bug most likely to be noticed only when a downstream mechanical step (e.g.
gate verification against `artifacts`) behaves unexpectedly.

## Root cause

`fmList`'s inline-list branch does a naive `.split(',')` with no bracket/brace-depth awareness. Its
block-list branch's loop condition checks only "is this line indented and does it start with `- `"
without also checking "have we not yet reached a line matching `^[a-zA-Z_]+:`" (the start of the next key),
so it has no natural termination point once a SECOND block list exists anywhere below the first in the
same file.

## Fix plan

1. In `build-mech-fast.mjs`'s inline-list branch, split on `,` only at bracket-depth 0 (track `{`/`}` and
   `[`/`]` depth while scanning, same technique as a minimal CSV/array tokenizer) so brace globs and other
   bracketed tokens inside an inline list survive intact.
2. In the block-list branch, stop consuming lines the moment a line matches the start of a new top-level
   frontmatter key (`^[a-zA-Z_][a-zA-Z0-9_]*:`), not just "no longer indented `- `".
3. As an interim/complementary mitigation (not a substitute for the parser fix), update the work-order
   frontmatter template/skill instructions to say: inline lists must stay comma-free inside any bracketed
   token (or avoid brace globs there), and `artifacts` (the one block-list field) should be placed LAST in
   the frontmatter so no second block list can follow it. State this explicitly so authors aren't relying
   on the parser bug being fixed before using brace globs.

## Tests (prove the fix — TDD, RED → GREEN)

- RED: a unit test calling `fmList` against a frontmatter fixture with `artifacts: [src/{a,b}/**,
  other/file.ts]` returns a split/corrupted list today; a fixture with TWO block lists (one after
  `artifacts`) merges the second into the first today.
- GREEN: after the fix, both fixtures parse into the correct, distinct list values.

## Done when

- Both reproduced bugs have a passing unit test in the build engine's own test suite.
- The work-order frontmatter template/skill documents the comma-free / artifacts-last guidance regardless
  (defense in depth).
- Plugin version bumped (PATCH — bug fix to existing build-engine behavior) + decision-log entry added.

## Out of scope

- Does not replace `fmList`'s hand-rolled approach with a full YAML parser — scope is fixing these two
  specific parsing bugs within the existing design.
