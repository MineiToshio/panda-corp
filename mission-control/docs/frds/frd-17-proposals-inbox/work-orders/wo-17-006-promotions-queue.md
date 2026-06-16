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
