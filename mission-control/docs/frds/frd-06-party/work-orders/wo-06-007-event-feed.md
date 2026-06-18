---
id: WO-06-007
type: work-order
slug: event-feed
title: 'WO-06-007 — Bitácora (event feed: vocabulary, failure-first, auto-scroll, cap, Live/No-signal)'
status: DRAFT
parent: FRD-06
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-18'
---
# WO-06-007 — Bitácora (event feed)

**Components/Interfaces:** `CMP-06-feed` · **Traces:** REQ-06-011, REQ-06-010
**Deploy unit:** Party tab (Client Component) · **Location:** `app/projects/[slug]/_party/EventFeed.tsx` (+ `.test.tsx`)

> **REOPENED → PLANNED (2026-06-18, La Fragua redesign).** The feed is largely correct but must:
> read `roleColorKey` (renamed from `agentColorKey`, WO-06-001); render the new **hand-off / contract /
> gate** lines; and **host the Live / No-signal badge** (folded in from the descoped WO-06-010) reading
> `lastEventAt`. Behavior changes → reopened. See the Status Note.

## Acceptance criteria (verbatim EARS)
- AC-06-011.1: THE system SHALL show a **bitácora del gremio** — a feed of the real build events (work starting, the `Status Note` hand-off, the deep contract, the gate opening), each row using the fixed bounded iconic vocabulary, the role color, and a `tabular-nums` timestamp, with **failure as a first-class state** (never hidden), auto-scroll to newest + a pin button, and an in-memory cap (≤200, drop oldest).
- AC-06-010.3: WHILE events from more than one project are present, THE system SHALL distinguish them with a **project-color (left border) + role-color (second border)**.

## Scope
- Renders the event list from `EventVM[]` (WO-06-001): icon + tool icon, **role-color** marker, Spanish label, `tabular-nums` timestamp — including the `handoff`/`contract`/`gate` lines.
- **Failure rows** visually distinct (danger token + ❌ + label) and never filtered.
- **Auto-scroll** to newest; scroll-up shows a **pin/"jump to latest"** button; clicking re-pins.
- **Cap** at ≤200 in the rendered set (drop oldest).
- Multi-project: project-color left border + role-color second border when `projectColorKey` present.
- **Live / No-signal badge** in the feed header (folded in from WO-06-010): reads `lastEventAt`, state by icon + label (never color-only), `tabular-nums` timestamp.
- `aria-live="polite"` for new rows.

## Dependencies
- WO-06-001 (`EventVM`, icon map — enriched/role-keyed), FRD-13 tokens (colors, tabular-nums, a11y).

## TDD / Definition of done
- Component tests: renders rows with the right icons; a failure event renders the danger treatment and is present (not hidden); adding >cap events keeps the list capped (oldest gone); scrolling up reveals the pin button and pauses auto-scroll; clicking it re-enables; a `project`-tagged event shows both borders.
- Gate green.

## Status Note (La Fragua redesign — what the retry must build)

**Why reopened:** the shipped feed reads `data-agent-color` (rename to role-color), and predates the
`handoff`/`contract`/`gate` lines and the Live/No-signal badge (which moved here from the descoped
WO-06-010). The retry: switch to `roleColorKey`; render the new vocabulary rows; add a `live` +
`lastEventAt` prop and the Live/No-signal badge in the feed header (icon + label, `tabular-nums`). Keep
the cap, pin and first-class failure behavior. Extend the tests for the new rows + the badge.

---

### Previous build (obsoleted by the redesign — kept for history)

**Built:** `CMP-06-feed` — `EventFeed` client component at `app/projects/[slug]/_party/EventFeed.tsx`.

**What it delivers:**
- Renders `EventVM[]` as a bounded event log (tail cap 100–200, default 200; oldest dropped).
- Icon + optional tool icon per row using vocabulary from `event-vm.ts` (WO-06-001).
- Agent-color left border via `data-agent-color` attribute; project-color left border + agent-color outline (multi-project, REQ-06-011).
- Failure rows: `data-failure="true"`, danger CSS tokens (`--color-failure-bg`, `--color-failure-text`), never hidden (AC-06-013.1).
- Auto-scroll to newest on mount and on update when `isPinned=false`.
- Pin button (`data-testid="event-feed-pin"`) appears when user scrolls up; click re-enables auto-scroll (AC-06-014.1).
- `showPin` prop for test control (forces pin button visible).
- `aria-live="polite"` on the `<ol>` list (FRD-13, AC-06-014.1).
- `tabular-nums` on all timestamps via `fontVariantNumeric`.
- Zero hardcoded colors — all via CSS custom properties.

**Interfaces/contracts exposed:**
```ts
export interface EventFeedProps {
  events: EventVM[];
  cap?: number;       // default 200 (AC-06-014.1)
  showPin?: boolean;  // test only: force pin button visible
}
export function EventFeed(props: EventFeedProps): React.JSX.Element
```

**Integration seams:**
- Consumes `EventVM` from `app/projects/[slug]/_party/event-vm.ts` (WO-06-001).
- Consumed by `PartyTab` (WO-06-005) which passes the capped `events: EventVM[]` snapshot from the server.
- CSS variables expected: `--color-failure-bg`, `--color-failure-text`, `--color-failure`, `--color-surface`, `--color-surface-panel`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-accent-text`, `--radius`, `--spacing`, `--shadow-panel` (all from FRD-13 design tokens).

**data-testid:**
- `event-feed` — `<section>` container
- `event-feed-empty` — empty state `<div>` (no events)
- `event-feed-list` — `<ol>` list when events present
- `event-feed-row` — each `<li>` row
- `event-feed-pin` — jump-to-latest button (when user has scrolled up)

**Test files:** `app/projects/[slug]/_party/EventFeed.test.tsx` — 22 tests GREEN covering AC-06-006.1, AC-06-013.1, AC-06-011.1, AC-06-014.1 (cap + pin), accessibility (FRD-13), data-testid invariants.

**Gate at hand-off:** 140 test files, 3821 tests GREEN + 2 expected-fail + 5 skipped. `tsc --noEmit` clean. `biome check` clean. `verify.sh` green.
