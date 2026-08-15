---
id: LESSON-0189
type: pattern
domain: react
tags: [debugging, overlay, popup, clipping, portal, code-reuse, diagnosis]
context: "diagnosing a UI overlay/popup bug (clipping, z-index, positioning) in a component that has a sibling component solving the same underlying UI problem elsewhere in the same codebase"
trigger: "use this when diagnosing an overlay/popup/dropdown clipping or z-index bug — before designing a new fix, check whether a sibling component in the same codebase already solves the same underlying positioning problem"
source: "factory/memory/_inbox.md agent-inferred note (pandatrack project) — a date-picker popup rendered truncated inside a modal (`DatePickerInput.tsx`, positioned `position:absolute` as a plain DOM descendant of a modal with `overflow-hidden`/`overflow-y-auto`), while a sibling component in the same codebase, `DateRangePickerInput.tsx`, already had the correct fix (Portal-rendered + `position:fixed` computed from `getBoundingClientRect()` + reposition on open/resize/scroll + flip on both axes on overflow) — it had simply never been ported to the single-date component"
provenance: agent-inferred
created: 2026-08-11
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0065]
---

**Situation:** a date-picker popup clipped inside a modal because it was positioned `absolute` as a plain
DOM descendant of an `overflow-hidden`/`overflow-y-auto` modal panel — a variant of the same containing-
block/overflow-clipping class LESSON-0065 documents for `position: fixed`. The correct fix already existed
in the same codebase, in a sibling component (same folder, similar name, same underlying UI primitive)
that had solved the identical problem: Portal-rendered, `position: fixed` computed live via
`getBoundingClientRect()`, repositioned on open/resize/scroll, and flipped on both axes when it would
overflow the viewport. The two components had silently drifted apart on the same concern — the fix was
never ported from one to the other.

**Lesson:** when two or more components in a codebase implement the same UI primitive (e.g. two date-
picker variants, two dropdown variants), they tend to drift apart independently, and a hard-won fix in one
sibling often never gets ported to the others. This means a working, already-battle-tested reference
implementation for the exact bug class you are diagnosing frequently already exists a few files away — a
cheaper and lower-risk source of the fix than designing a new one from scratch (and reinventing it risks
re-introducing a bug the sibling already avoided, or diverging further).

**Apply next time:** before designing a fix for an overlay/popup clipping, z-index, or positioning bug,
grep the codebase for sibling components solving the same underlying UI problem (same folder, similar
name, same primitive — e.g. `Foo*Input.tsx` variants, `*Dropdown.tsx` variants). If a working reference
implementation exists, port its technique rather than inventing a new one; if it doesn't, treat the
absence itself as a signal these components have already drifted and consider extracting the shared
positioning logic into one hook/utility so the next bug fix doesn't need porting at all.
