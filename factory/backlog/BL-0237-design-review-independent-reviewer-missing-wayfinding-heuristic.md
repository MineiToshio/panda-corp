---
id: BL-0237
type: change
area: plugin-skill
title: "design skill's independent-reviewer discipline has no explicit wayfinding/IA heuristic pass"
status: open
severity: p2
opened: 2026-10-15
closed:
source: "pandasaga .pandacorp/run/lessons.md 2026-10-13/14 (agent-inferred): design-round independent reviews (rounds 2-3) judged spoiler/suppression/consent/a11y correctness only and returned PASS, while missing real wayfinding/IA defects (duplicate nav systems, dead-end destinations at zero progress, mobile disclosure opening below the fold, a chapter page whose H1 did not name its subject) that only a later, differently-scoped review pass caught"
closes:
links: []
---

## Problem

`plugin/skills/design/references/iteration-loop.md` (the per-round discipline used by every design
round) instructs: *"An **independent reviewer** subagent (a different context, read-only) audits each
substantial round against the FRDs and the owner's request; fix its findings and add regression checks
before showing."* This is intentionally generic — it has no named heuristic checklist, unlike the
content-safety sweep (`"domain safety (PandaSaga: no spoiler term before its chapter)"`, line 20 of the
same file) or the a11y/screenshot verification (DR-057/DR-109, explicit scripted checks in
`plugin/skills/design/SKILL.md` step 5).

On pandasaga, this generic framing let the independent reviewer correctly and repeatedly catch
spoiler-suppression, consent and a11y defects (rounds 2-3 both returned PASS on those axes) while
missing real, user-facing navigation/information-architecture defects that only surfaced in a LATER round
when a differently-scoped review pass was run: duplicate/competing navigation systems, dead-end
destinations reachable at zero reading progress, a mobile content-disclosure control opening below the
fold, and a chapter detail page whose own H1 did not name the chapter it was about. None of these are
spoiler/consent/a11y issues — they are wayfinding/clarity issues the reviewer's brief never asked it to
look for.

## Root cause

The independent-reviewer instruction names WHAT to check against (FRDs, the owner's request) but not a
concrete heuristic LENS to apply beyond that — unlike the two other verification passes in the same
pipeline, which both carry an explicit, named checklist. A reviewer reasoning only from "does this match
the FRD/request" has no prompt to evaluate wayfinding/IA quality independently of documented
requirements, since dead-end navigation, duplicate nav systems, and a missing subject-naming H1 are
rarely things an FRD states explicitly — they are general UX heuristics, not acceptance criteria.

## Fix plan

1. In `plugin/skills/design/references/iteration-loop.md`, add a short, named wayfinding/IA heuristic
   checklist to the independent-reviewer instruction (sibling to the existing content-safety and a11y
   checklists) — at minimum: no duplicate/competing navigation systems for the same destination; no
   dead-end screens reachable at any valid state (including a zero-progress/empty state); any
   disclosure/accordion control that reveals primary content is not hidden below the fold on mobile by
   default; and every detail-page H1 names the specific entity/subject the page is about.
2. Cross-reference this checklist from `plugin/skills/design/SKILL.md`'s step 5 verification summary so
   it's visible without opening the reference doc.
3. Note the addition in `plugin/docs/decision-log.md`; bump `plugin/runtime/plugin-metadata.json` per
   semver (PATCH — behavior clarification to an existing skill's review discipline, not a new capability)
   and regenerate manifests.

## Tests (prove the fix — TDD, RED → GREEN)

- Documented manual repro (the design skill's reviewer step has no automated test harness): construct a
  small fixture mockup with one known wayfinding defect from the checklist (e.g. a dead-end screen) and
  no FRD-visible defect; RED = running the CURRENT (unpatched) reviewer instruction against it produces a
  PASS because nothing in the brief asks it to check wayfinding; GREEN = after the fix, the reviewer's
  brief includes the checklist and the same fixture's defect is flagged.

## Done when

- `iteration-loop.md` contains the named wayfinding/IA checklist.
- `SKILL.md` step 5 references it.
- The RED→GREEN manual repro above is documented and passes.
- Plugin version bumped (PATCH) + decision-log entry added.

## Out of scope

- Does not add a new automated/scripted gate (unlike a11y/screenshots) — this is a reviewer-prompt
  change, not a new verification script.
- Does not change the content-safety (spoiler) sweep, which already has its own explicit checklist.
