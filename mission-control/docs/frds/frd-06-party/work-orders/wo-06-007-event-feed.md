---
id: WO-06-007
type: work-order
slug: event-feed
title: 'WO-06-007 — Bitácora (event feed: vocabulary, failure-first, auto-scroll, cap, Live/No-signal)'
status: DRAFT
parent: FRD-06
implementation_status: VERIFIED
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

## Status Note (Wave 3 / La Fragua redesign — hand-off)

**Built:** `CMP-06-feed` — `EventFeed` client component at
`src/app/projects/[slug]/_party/EventFeed/EventFeed.tsx`.

**What it delivers (Wave 3 additions over the previous build):**
- `data-agent-color` attribute renamed to `data-role-color` (aligned with `roleColorKey` rename in WO-06-001).
- Renders `handoff` / `contract` / `gate` vocabulary rows already present in `EventVM` (via `event-vm.ts`, WO-06-001); no filtering — all row types render.
- Live / No-signal badge in the feed header (folded from descoped WO-06-010): reads optional `live: boolean` + `lastEventAt: string | null` props; icon + label (never color-only, FRD-13); `tabular-nums` timestamp when `lastEventAt` is set; backward-compat — omitting `live` renders without badge.
- `FeedHeader` sub-component with `role="status"` and Spanish `aria-label` for accessibility.
- All previous behavior retained: cap (default 200, tail semantics), auto-scroll + pin button, first-class failure rows (`data-failure="true"`), multi-project double-border (`data-role-color` + `data-project-color`), `aria-live="polite"`, zero hardcoded colors.

**Interfaces/contracts exposed:**
```ts
export interface EventFeedProps {
  events: EventVM[];
  cap?: number;             // default 200 (AC-06-014.1)
  showPin?: boolean;        // test only: force pin button visible
  live?: boolean;           // Wave 3: Live/No-signal badge (omit = no badge)
  lastEventAt?: string | null; // Wave 3: ISO 8601 timestamp shown in badge
}
export function EventFeed(props: EventFeedProps): React.JSX.Element
```

**Integration seams:**
- Consumes `EventVM` from `src/app/projects/[slug]/_party/event-vm/event-vm.ts` (WO-06-001). Uses `roleColorKey`, `projectColorKey`, `isFailure`, `icon`, `toolIcon`, `label`, `at`, `wo`, `workOrder`.
- Consumed by `PartyTab` (WO-06-005) which passes `events: EventVM[]` + optional `live`/`lastEventAt` from server snapshot.
- CSS variables expected: `--color-failure-bg`, `--color-failure-text`, `--color-failure`, `--color-surface`, `--color-surface-panel`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-accent-text`, `--color-live-bg`, `--color-live`, `--color-no-signal-bg`, `--color-border`, `--radius`, `--spacing`, `--shadow-panel`, `--hairline` (all from FRD-13 design tokens).

**data-testid:**
- `event-feed` — `<section>` container
- `event-feed-empty` — empty state `<div>` (no events)
- `event-feed-list` — `<ol>` list when events present
- `event-feed-row` — each `<li>` row (attrs: `data-failure`, `data-role-color`, `data-project-color`)
- `event-feed-pin` — jump-to-latest button (when user has scrolled up)
- `event-feed-live-badge` — Live badge in header (when `live=true`)
- `event-feed-no-signal-badge` — No-signal badge in header (when `live=false`)
- `event-feed-badge-icon` — icon inside badge
- `event-feed-badge-label` — label text inside badge
- `event-feed-badge-timestamp` — timestamp inside badge (when `lastEventAt` is set)

**Test files:**
- `src/app/projects/[slug]/_party/EventFeed/_tests/EventFeed.test.tsx` — 22 tests (core feed + cap + pin + accessibility + data-testid; updated `data-agent-color` → `data-role-color` attribute expectations).
- `src/app/projects/[slug]/_party/EventFeed/_tests/EventFeed.wave3.test.tsx` — 18 tests covering handoff/contract/gate rows, Live/No-signal badge, `data-role-color` Wave 3 rename.
- `src/app/projects/[slug]/_party/EventFeed/_tests/EventFeed.multiproject.test.tsx` — 10 tests covering multi-project double-border (updated `data-agent-color` → `data-role-color`).

**Self-test result:** 50 / 50 EventFeed tests GREEN. `tsc --noEmit` clean for EventFeed files. `biome check src/app/projects/[slug]/_party/EventFeed/` clean (0 errors).

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
