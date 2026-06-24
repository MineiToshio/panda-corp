---
id: WO-06-001
type: work-order
slug: event-vocabulary-vm
title: WO-06-001 — Iconic event vocabulary + event view-model mapper (enriched + hand-off/contract/gate)
status: DRAFT
parent: FRD-06
implementation_status: VERIFIED
source_requirements: []
dependsOn: [WO-06-012]
last_updated: '2026-06-18'
---
# WO-06-001 — Iconic event vocabulary + event view-model mapper (enriched + hand-off/contract/gate)

**Components/Interfaces:** `IF-06-icon-map`, `IF-06-event-vm` · **Traces:** REQ-06-010, REQ-06-011
**Deploy unit:** Party tab (pure logic module) · **Location:** `app/projects/[slug]/_party/event-vm.ts` (+ `.test.ts`)

> **REOPENED → PLANNED (2026-06-18, La Fragua redesign).** The mapper was agent-keyed; the faithful feed
> is **work-order / role-keyed** and adds the real engine lines `handoff` (the `Status Note`), `contract`
> (deep `docs/api.md`) and `gate` (the review gate). It must also surface the enriched `wo`/`frd` fields.
> Small, additive change — but it touches the public vocabulary, so it is reopened, not left IN_REVIEW.

## Acceptance criteria (verbatim EARS)
- AC-06-011.1: THE system SHALL show a **bitácora del gremio** — each row using the fixed bounded iconic vocabulary, the role color, and a `tabular-nums` timestamp, with **failure as a first-class state** (never hidden).
- AC-06-010.3: WHILE events from more than one project are present, THE system SHALL distinguish them with a **project-color (left border) + role-color (second border)**; events with no `project` field render with the role color only.

## Scope
- Define `EVENT_ICON: Record<EventType, IconRef>` covering the faithful vocabulary (`read, write, edit, test_ok, test_fail, message, start, end, handoff, contract, gate, blocked, achievement`). Centralized constant — no magic strings.
- `toEventVM(event: Event): EventVM` → `{ icon, toolIcon?, roleColorKey, projectColorKey?, isFailure, label (Spanish), at, wo?, frd?, project? }`.
- `isFailure` true when `status === 'fail'` or `event === 'test_fail'`.
- `roleColorKey` derived from `event.role` (token key, not a hex — FRD-13 owns the value); renamed from the old `agentColorKey`.
- Surface the enriched `wo` and `frd` fields (from WO-06-012's `lib/events`); `projectColorKey` set only when `event.project` is present (AC-06-010.3).
- Add Spanish labels for the new lines: `handoff` → "📜 nota de estado entregada", `contract` → "📄 contrato docs/api.md publicado", `gate` → "tribunal del juez abierto".

## Dependencies
- FRD-01 `lib/events` — the `DashboardEvent` type + `EventType` enum (intra-platform). Use its exported types; do not redefine the schema.

## TDD / Definition of done
- RED→GREEN tests with event fixtures: every `EventType` maps to an icon; a `tool` adds a tool icon; `test_fail`/`status:'fail'` → `isFailure`; an event with `project` → `projectColorKey` set, without → undefined; labels are Spanish.
- Pure, no I/O, no DOM. `pnpm vitest run` green, `tsc --noEmit` clean, biome clean.

## Status Note (Wave 2 — La Fragua redesign — 2026-06-18)

**Built:** `IF-06-icon-map` (extended) and `IF-06-event-vm` (redesigned) — iconic event vocabulary +
role-keyed view-model mapper for the Party bitácora.

**Files delivered / modified:**
- `src/app/projects/[slug]/_party/event-vm/event-vm.ts` — `EventType` union extended to 14 types
  (`contract` and `gate` added); `EVENT_ICON: Record<EventType, string>` updated with `file-text` and
  `gavel` icons; `EventVM` type updated (`roleColorKey` replaces `agentColorKey`, adds `wo` and `frd`
  fields, keeps `workOrder` as backward-compat alias); `toEventVM` pure mapper refactored (helpers
  extracted to satisfy cognitive-complexity budget); Spanish labels updated for `handoff`, `contract`,
  `gate`. Pure, no I/O, no DOM.
- `src/app/projects/[slug]/_party/event-vm/_tests/event-vm.test.ts` — extended from 25 to 49 tests
  covering all Wave 2 additions (contract/gate icons, roleColorKey from event.role, wo/frd pass-through,
  Spanish labels, multi-project AC-06-010.3 combinations, idempotency with enriched fields).
- `src/app/projects/[slug]/_party/EventFeed/EventFeed.tsx` — `agentColorKey` → `roleColorKey` rename
  propagated (required for tsc --noEmit to stay clean).
- `src/app/projects/[slug]/_party/EventFeed/_tests/EventFeed.test.tsx` — same rename.
- `src/app/projects/[slug]/_party/EventFeed/_tests/EventFeed.multiproject.test.tsx` — same rename.

**Interfaces/contracts exposed:**
```ts
export type EventType =
  "read" | "write" | "edit" | "test_ok" | "test_fail" | "message" | "start" | "end" |
  "handoff" | "contract" | "gate" | "blocked" | "review" | "achievement";

export const EVENT_ICON: Record<EventType, string>  // 14-entry centralized vocabulary

export type EventVM = {
  icon: string;
  toolIcon?: string;
  roleColorKey?: string;    // from event.role (renamed from agentColorKey)
  projectColorKey?: string; // from event.project (AC-06-010.3)
  isFailure: boolean;       // status==='fail' || event==='test_fail'
  label: string;            // Spanish label
  at: string;
  wo?: string;              // event.workOrder (new Wave 2)
  frd?: string;             // event.frd (new Wave 2)
  workOrder?: string;       // backward-compat alias for wo
  project?: string;
};

export function toEventVM(event: DashboardEvent): EventVM  // pure, no I/O, no DOM
```

**Integration seams:**
- Consumed by `CMP-06-feed` (`EventFeed.tsx`, WO-06-007) and `CMP-06-party-tab` (`PartyTab.tsx`, WO-06-005).
- Depends on `lib/events.ts` (`Event` type as `DashboardEvent`, already has `frd`/`role` fields from WO-06-012)
  and `app/_design/tokens.ts` (`AGENT_COLOR`, `AgentRole`, updated with `implementer` in WO-13-001).
- EventFeed.tsx downstream consumers (`agentColorKey` → `roleColorKey`) updated in the same change to keep tsc clean.

**Test files:** 49 tests in `event-vm.test.ts` (all GREEN). EventFeed tests unchanged (31 tests, GREEN).

**Gate at hand-off:** 181 test files, 5004 tests GREEN + 2 expected-fail + 5 skipped. `biome check` clean on WO-06-001 files (6 infos = fixable `useLiteralKeys` style suggestions only). `tsc --noEmit` clean. 1 pre-existing failure in `agentColorTokens.integration.reviewer.test.ts` (about `--color-agent-guild` in achievements files — pre-exists this WO, out of scope).
