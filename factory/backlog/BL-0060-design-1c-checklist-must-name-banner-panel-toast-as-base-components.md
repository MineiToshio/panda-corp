---
id: BL-0060
type: change
area: standards
title: "design.md §1c anti-omission checklist should explicitly name Banner/Alert, Panel/Surface and Toast as base components (or assume a mandatory back-port round)"
status: open
severity: p2
opened: 2026-07-10
closed:
source: "pandacast .pandacorp/run/lessons.md 2026-07-10 (agent-inferred, paired with LESSON-0136): Stage 1 (single-pass design-system generation) omitted Banner, Panel and Toast entirely; all three were discovered only while building screens in Stage 2 (login needed a status banner, connections needed a form panel, a toast pattern surfaced separately)"
closes:
links: [LESSON-0136]
---

## Problem
`factory/standards/design.md` §1c's anti-omission checklist enumerates the components/states a Stage-1
design-system generation prompt must cover, but does not name a base component category for
notification/feedback surfaces. On pandacast, Stage 1 (a single exhaustive prompt, one pass) produced a
system missing THREE such components (Banner/Alert, Panel/Surface, Toast) — each discovered only while
building an individual screen in Stage 2, requiring an ad-hoc back-port each time instead of a single,
anticipated round.

## Root cause
§1c's checklist was authored against components visible in the portfolio/content product shape it was
generalized from; feedback/notification-surface components (banners, toasts, elevated panels) are a
near-universal base category across product shapes but were never named explicitly, so a single Stage-1
pass has no prompt to include them and no signal to the reviewer that their absence is a gap rather than
a legitimate omission.

## Fix plan
Add to `design.md` §1c's anti-omission checklist an explicit base-component category: "feedback/
notification surfaces — Banner/Alert (with a live-region variant, see accessibility line), Panel/Surface
(elevated content container), Toast (transient notification)" — required in every Stage-1 prompt unless
explicitly justified absent for that product. Alternatively/additionally, document in
`canvas-procedure.md` that Stage 1 is expected to need ONE back-port round per screen family for
components discovered only during Stage 2, so this isn't treated as a review failure when it happens.

## Tests (prove the fix — TDD, RED → GREEN)
Documented manual repro: before the fix, a Stage-1 checklist review has no explicit line requiring
Banner/Panel/Toast, so their absence passes the checklist; after the fix, their absence is flagged
against the named checklist line, forcing an explicit justification or a back-port.

## Done when
`design.md` §1c names the feedback/notification-surface category explicitly; plugin version bumped;
Manual reference regenerated if it derives from this standard.

## Out of scope
Prescribing the exact visual design of these components — only that the checklist names the category so
Stage 1 anticipates it.
