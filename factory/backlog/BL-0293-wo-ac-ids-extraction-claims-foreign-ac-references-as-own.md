---
id: BL-0293
type: bug
area: build-engine
title: "woAcIds extracts any AC-id-shaped token in the Acceptance Criteria section, including foreign references, causing false ac-uncited refusals"
status: open
severity: p2
opened: 2026-10-31
closed:
source: "factory/memory/_inbox.md 2026-10-30 note (agent-inferred) — Mission Control WO-11-003/WO-02-020; see LESSON-0564 for the generalizable authoring workaround"
closes:
links: [LESSON-0564, LESSON-0008]
---

## Problem

`plugin/scripts/build-mech-lib.mjs`'s `woAcIds(text)` (used by `pandacorp-build-mech.mjs commit-wo`'s
AC-citation floor, `acCitation`) extracts the WO's own acceptance-criteria ids by slicing the document
down to the body between the `## ... Acceptance Criteria ...` heading and the next `## ` heading, then
running `AC_ID_RE` over that WHOLE slice (`build-mech-lib.mjs:212-218`, `pandacorp-build-mech.mjs:200`).
It does not distinguish between an id that is actually one of this WO's own assigned criteria (e.g. a
bulleted `AC-11-003.2: ...` line) and an id that merely appears in explanatory prose inside that same
section, referencing a DIFFERENT work order's AC for context.

**Concrete evidence:** WO-11-003's Acceptance Criteria section included a sentence referencing
WO-02-020's own `AC-02-020.3` for context (the shared computation both WOs touch). `woAcIds` returned
that foreign id as one of WO-11-003's own ACs. `acCitation` then required some test file in WO-11-003's
change to cite `AC-02-020.3` — which no test does, since it is not WO-11-003's criterion — and
`commit-wo` refused the commit with `ac-uncited`, even though every ACTUAL criterion of WO-11-003 was
correctly tested and cited.

**Impact:** a WO author referencing a sibling's AC id for legitimate context inside the Acceptance
Criteria section (rather than in Out of Scope) gets a false `ac-uncited` refusal that has nothing to do
with whether the WO's own criteria are tested. The current workaround (documented as LESSON-0564) is
purely social — write such references in "## Out of Scope" instead — which works but is easy to forget
and gives no feedback until the commit is refused.

## Root cause

`AC_ID_RE` matching is unconditional over the whole Acceptance-Criteria section's raw text
(`build-mech-lib.mjs:217`, `scope.match(AC_ID_RE)`) — it has no notion of "this token sits inside a
bullet that assigns an AC to this WO" vs "this token merely appears inside a sentence". Any correctly
formatted foreign AC id written anywhere in that section's prose is indistinguishable, to the regex, from
one of the WO's own assigned criteria.

## Fix plan

In `plugin/scripts/build-mech-lib.mjs`'s `woAcIds`:
1. Restrict extraction to ids that are structurally the WO's OWN criteria — e.g. only ids whose prefix
   matches the current WO's own id (`AC-<same-frd>-<same-wo-number>.<n>`), or only ids that open a
   list-item/bullet line (`^\s*[-*]\s*AC-...`), rather than any occurrence anywhere in the section's
   free text. Prefer the WO-id-prefix match since it also naturally excludes a sibling's foreign AC
   regardless of formatting.
2. Keep the "no AC id found" (`skipped`) and `tests: none` paths unchanged.
3. If ids legitimately NEED cross-referencing a sibling's AC inside the Acceptance Criteria section for
   some other reason, consider recognizing a documented "(see WO-XXX)"-style inline marker as
   non-extractable — but the simpler WO-id-prefix restriction likely makes this unnecessary.

Bump plugin semver (PATCH — this is a targeted bug fix with no skill/agent-visible behavior change beyond
tightening a false-positive) once landed; no `OVERLAY_VERSION` change expected (engine script only).

## Tests (prove the fix — TDD, RED → GREEN)

Add a case to `plugin/scripts/test-build-mech.mjs` (same suite as the existing `ac-uncited` coverage,
`pandacorp-build-mech.mjs:208` / `test-build-mech.mjs:128-137`): a WO body whose Acceptance Criteria
section contains both (a) its own correctly bulleted AC id, cited by a test, and (b) a sentence
referencing a DIFFERENT WO's AC id for context, NOT cited by any test in this WO's change. **Before the
fix:** `commit-wo` refuses with `ac-uncited` naming the foreign id. **After the fix:** `commit-wo`
succeeds — only the WO's own AC ids are checked for citation; the foreign reference is ignored.

## Done when

- The new `test-build-mech.mjs` case passes (RED before, GREEN after); existing `ac-uncited` tests
  (`test-build-mech.mjs:128-137,238`) still pass unchanged.
- `woAcIds` only extracts ids that are structurally this WO's own (WO-id-prefix match or bulleted-line
  match, whichever the implementation lands on).
- Plugin semver bumped; LESSON-0564 back-linked (`promotion` left as-is unless the owner decides this
  warrants a standard-level callout).

## Out of scope

Does not change `tests: none`/`tests_reason` handling, the `--extra`/undeclared-path machinery, or any
other `commit-wo` refusal class. Does not relax the AC-citation floor itself — only tightens WHICH ids it
holds a WO accountable for.
