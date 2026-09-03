---
id: BL-0084
type: bug
area: mission-control
title: "Manual page estandares-y-reglas.md:27 still asserts Codex is read-only/review, stale since PORT-5 promoted the attended_foreground Codex profile"
status: done
severity: p2
opened: 2026-07-16
closed: 2026-09-02
source: "factory/memory/_inbox.md note (undated, agent-inferred); PORT-5 promoted e6533be6, 2026-07-15"
closes: "DR-046 sync restored for the Manual's portability prose; the page now states DR-120's read/review-only freeze"
links: [DR-046, DR-113, DR-120]
---

## Problem
Mission Control's Manual page `estandares-y-reglas.md` (line 27 as of this note) still asserts
"Codex es solo lectura/review sobre estado de build" — this was true before 2026-07-15 but is now STALE:
`factory/decision-log.md`'s 2026-07-15 "Codex may build one attended target experimentally" entry and
`factory/standards/agent-portability.md`'s PORT-5 section promoted a narrow but real Codex write
capability, `EXPERIMENTAL/attended_foreground/targeted-only` (one FRD or ready change, foreground,
`<=7200` cumulative seconds, zero automatic restarts). The Manual's R0/PORT-1..6 portability prose
paragraph around that line was not re-synced against the updated `agent-portability.md` standard when
PORT-5 shipped, breaking DR-046 ("Mission Control's Manual reflects the factory" — every change to the
factory's operable surface must also surface in the Manual in the same change).

## Root cause
DR-046 requires hand-authored Guides/Concepts pages to be updated in the SAME change that alters the
underlying standard/rule; the PORT-5 promotion commit (e6533be6, 2026-07-15) updated
`agent-portability.md` and `AGENTS.md` but missed the Manual's own prose paragraph describing the same
Codex-write boundary, which duplicates (rather than derives) that content.

## Fix plan
Re-sync the `estandares-y-reglas.md` Manual page's R0/PORT-1..6 portability paragraph against the current
`factory/standards/agent-portability.md` (PORT-5 section): replace the blanket "read-only/review" claim
with the current `EXPERIMENTAL/attended_foreground/targeted-only` boundary (one FRD/change, foreground,
`<=7200`s, zero auto-restart, never hardening/release/background/cross-runtime). While in the file, check
whether this page could instead DERIVE this paragraph from `agent-portability.md`'s frontmatter/content
programmatically (same spirit as the Reference catalogs, DR-046) rather than staying hand-duplicated
prose that can drift again on the next PORT-5+N promotion.

## Tests (prove the fix — TDD, RED → GREEN)
No unit test applies to Manual prose content directly; prove it by grepping the updated page for the
stale "solo lectura/review" claim (should be gone) and confirming the new text matches PORT-5's actual
current policy. If a derivation approach is chosen instead, add/extend a Manual-drift test asserting the
portability paragraph is generated from (not duplicated from) `agent-portability.md`.

## Done when
The Manual page states the current Codex `attended_foreground` boundary accurately; the stale claim is
gone; DR-046 sync discipline is restored for this page.

## Out of scope
A general "detect drift between every Manual Guide/Concept page and its source standard" mechanism (a
broader project) — this item only fixes the one page/paragraph named above.

## Resolution — 2026-09-02
Closed while recording DR-120 (the Codex freeze). The Manual no longer carries a stale claim in either direction: `mission-control/content/manual/concepts/estandares-y-reglas.md:27` now states the current policy (every non-Claude runtime read/review-only, the `attended_foreground` profile withdrawn, R10/R11 suspended, the verbatim reopen trigger) instead of the pre-2026-07-15 "R0 + R2/R3/R6" wording. The same sweep also corrected the surfaces the original card did not name but that render the same fact: `concepts/multi-runtime.md`, `ConceptMultiRuntime` in `mission-control/src/app/manual/manualPages.tsx`, `manual-diagrams/RuntimeComparison.tsx` and `guides/g-implement-parcial.md`.

The card's optional suggestion — DERIVE the paragraph from `agent-portability.md` instead of duplicating it — was NOT done and is deliberately left undone: it is a Mission Control change (product plane, routed via `/pandacorp:change`), and the derivation design is bigger than this decision-recording change. The drift class therefore still exists for this paragraph; BL-0084 closes on the stale claim, not on the duplication.
