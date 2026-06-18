---
id: WO-17-006
type: work-order
slug: promotions-queue
title: WO-17-006 — Promotions queue
status: DRAFT
parent: FRD-17
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-17-006 — Promotions queue

> Source-of-truth: [`blueprint.md`](../blueprint.md) (`CMP-17-promoqueue`) · [architecture §4.6, §7](../../../product/architecture.md).

## Goal
The durable, reviewable list of `promotion: proposed` lessons — each with its target
(standard/rule/skill), rationale, evidence, and the `/pandacorp:learn` command to promote. MC never
promotes (read-only).

## Scope
- Render `promotionQueue()` (WO-17-002): per lesson, show target, rationale, evidence
  (`LESSON-NNNN` + `source` + `links`), and the `/pandacorp:learn` command via `CopyButton`.
- **Approve** affordance = surface the `/pandacorp:learn` command to copy (→ owner runs it →
  `promotion: approved`). **Reject** is informational (the skill sets `promotion: rejected`; MC only
  shows the current state). No write from MC.

## Acceptance criteria (REQ-17-006)
- **AC-17-006.1** The queue lists exactly the `promotion: proposed` lessons; it persists across visits
  (it is a view of the lesson's `promotion` field — single source of truth).
- **AC-17-006.2** Each entry shows target, rationale, and evidence (lesson id + source/links).
- **AC-17-006.3** The approve affordance is the copyable `/pandacorp:learn` command — MC never promotes.
- **AC-17-006.4** Reject is shown as state only (no MC write); a lesson already `rejected` is rendered
  as such (the lesson stays, never becomes a rule).
- **AC-17-006.5** High-risk targets (MUST standard, skill/agent, DR) are display-only (REQ-17-009).
- **AC-17-006.6** Empty queue → calm *al día* state. Spanish + a11y.

## TDD
`components/promotions-queue.test.tsx` with fixture proposed/rejected lessons; assert listing, target/
evidence rendering, copy command, no write affordance, empty state.

## Definition of done
- ACs RED → GREEN; read-only; durable view; Spanish. `.pandacorp/verify.sh` green.

## Dependencies
- WO-17-002; FRD-02 `CopyButton`.

## Status Note

**Built (2026-06-18):** Implemented the `PromotionsQueue` component (CMP-17-promoqueue) end-to-end with TDD (31 RED then GREEN tests).

**What was built:**
- `src/components/modules/PromotionsQueue/PromotionsQueue.tsx` — Server Component compatible (no `"use client"`). Accepts pre-fetched `Lesson[]` props. Filters to `promotion: "proposed"` and `"rejected"`. Proposed entries show evidence block (lesson id, source, links), rationale (body), target (type · domain), a `code` element showing `/pandacorp:learn LESSON-NNNN`, and a `CopyButton` (MC never promotes). Rejected entries show informational "Rechazada" badge with no copy affordance. High-risk lessons (DR-* links or `must-*` domain) show "Alto riesgo" badge. Empty state: calm Spanish "Sin propuestas pendientes — todo al día." with no urgency.
- `src/components/modules/PromotionsQueue/_tests/PromotionsQueue.test.tsx` — 31 tests covering AC-17-006.1 through AC-17-006.6 (listing, target/evidence rendering, copy command, no write affordance, rejected state, high-risk badge, empty state, a11y).

**Interfaces/contracts exposed:**
```tsx
// src/components/modules/PromotionsQueue/PromotionsQueue.tsx
export type PromotionsQueueProps = { lessons: Lesson[] };
export function PromotionsQueue({ lessons }: PromotionsQueueProps): React.JSX.Element

// data-testid contract:
// "promotions-queue"                    — root <section aria-label="Cola de promociones">
// "promotion-entry-{id}"               — each lesson <article>
//   data-promotion-state="proposed"    — on proposed entry
//   data-promotion-state="rejected"    — on rejected entry
//   "promotion-target"                 — <h3>type · domain</h3>
//   "promotion-rationale"              — <p> body excerpt </p> (proposed only)
//   "promotion-lesson-id"              — <span>LESSON-NNNN</span>
//   "promotion-source"                 — <span> source evidence </span>
//   "promotion-links"                  — <span> DR-* links </span>
//   "promotion-learn-command"          — <code>/pandacorp:learn LESSON-NNNN</code> (proposed)
//   "copy-button"                      — CopyButton (proposed only)
//   "promotion-high-risk-badge"        — if DR-* link or must-* domain (proposed)
//   "promotion-rejected-badge"         — if promotion: rejected
// "promotions-queue-empty"             — empty state <div>
```

**Integration seams:**
- Consumer (e.g. `app/proposals/page.tsx`) imports `PromotionsQueue` from `@/components/modules/PromotionsQueue/PromotionsQueue` and passes `promotionQueue()` result (from `@/lib/memory/memory`, WO-17-002) as `lessons` prop.
- `CopyButton` is from `@/components/core/CopyButton/CopyButton` (CMP-02, FRD-02).
- `Lesson` type imported as `import type` from `@/lib/memory/memory` (IF-17-memory).

**Test files:**
- `src/components/modules/PromotionsQueue/_tests/PromotionsQueue.test.tsx` — 31 tests, AC-17-006.1 through AC-17-006.6.

**Verification:** 31/31 tests GREEN. tsc --noEmit clean. biome check clean. Full suite 5413/5413 pass + 2 expected fail + 5 skipped.
