# WO-13-005 — StateBadge (icon+shape+label, never color-only)

**Components/Interfaces:** `CMP-13-state-badge` · **Traces:** REQ-13-007, REQ-13-008
**Deploy unit:** shared UI · **Location:** `components/StateBadge.tsx` (+ `.test.tsx`)

## Acceptance criteria (verbatim EARS)
- AC-13-007.1: NO state SHALL depend on color alone: each state (working / idle / failed / completed) is paired with an **icon or shape + label**.
- AC-13-008.1: ... `aria-label` in Spanish on icons ... (a11y compliance).

## Scope
- `StateBadge` renders a state (working/idle/failed/completed/blocked/reviewing) as **icon + shape + Spanish label** using `STATE_BADGE` (WO-13-001) and the agent/state color tokens — color is reinforcement, never the only signal.
- Reused by Party sprites/feed (FRD-06), DAG nodes (FRD-12), board/portfolio chips.
- Spanish `aria-label`; the failure state is visually first-class (distinct from completed).

## Dependencies
- WO-13-001 (`STATE_BADGE` vocabulary, color key map).

## TDD / Definition of done
- Component tests: every state renders its icon + label (assert label text present, not color-only); failed and completed are distinguishable by icon+label; Spanish `aria-label` present; unknown state → safe fallback (never crash).
- Gate green.
