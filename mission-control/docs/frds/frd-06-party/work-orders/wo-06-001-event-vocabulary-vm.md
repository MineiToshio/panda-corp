---
id: WO-06-001
type: work-order
slug: event-vocabulary-vm
title: WO-06-001 — Iconic event vocabulary + event view-model mapper (enriched + hand-off/contract/gate)
status: DRAFT
parent: FRD-06
implementation_status: PLANNED
source_requirements: []
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

## Status Note (La Fragua redesign — what the retry must build)

**Why reopened:** the shipped mapper (below) is agent-keyed (`agentColorKey` from `event.agent`) and lacks
the engine's real hand-off lines. The retry: rename `agentColorKey → roleColorKey` (from `event.role`),
add `wo`/`frd` to the `EventVM`, and add the `handoff`/`contract`/`gate` vocabulary + Spanish labels.
Keep `isFailure` first-class and the multi-project `projectColorKey`. Extend the 25 tests accordingly.

---

### Previous build (obsoleted by the redesign — kept for history)

**Built:** `IF-06-icon-map` and `IF-06-event-vm` — the pure event vocabulary and view-model mapper for the Party panel.

**Files delivered:**
- `app/projects/[slug]/_party/event-vm.ts` — `EventType` union (12 canonical types), `EVENT_ICON: Record<EventType, string>` (Lucide identifiers), `EventVM` type, `toEventVM(event: DashboardEvent): EventVM` pure mapper. Fallback icon/label for unknown event types. Spanish label map. Tool icon map (TOOL_ICON with FALLBACK_TOOL_ICON). Agent color key derived from `AGENT_COLOR` in `app/_design/tokens.ts`. Project color key (`--color-project-<slug>`) set only when `event.project` is present.
- `app/projects/[slug]/_party/event-vm.test.ts` — 25 tests covering AC-06-012.1 (vocabulary completeness, icon mapping, toolIcon), AC-06-013.1 (isFailure first-class state), AC-06-011.1 (agentColorKey/projectColorKey), EventVM structure, idempotency.

**Interfaces/contracts exposed:**
- `EventType` — `"read" | "write" | "edit" | "test_ok" | "test_fail" | "message" | "start" | "end" | "handoff" | "blocked" | "review" | "achievement"`
- `EVENT_ICON: Record<EventType, string>` — centralized vocabulary, no magic strings anywhere else
- `EventVM` — `{ icon: string; toolIcon?: string; agentColorKey?: string; projectColorKey?: string; isFailure: boolean; label: string; at: string; workOrder?: string; project?: string }`
- `toEventVM(event: DashboardEvent): EventVM` — pure, no I/O, no DOM

**Integration seams:**
- Consumed by `CMP-06-feed` (`EventFeed.tsx`, WO-06-007) and `CMP-06-party-tab` (`PartyTab.tsx`, WO-06-005).
- Depends on `lib/events.ts` (`Event` type as `DashboardEvent`) and `app/_design/tokens.ts` (`AGENT_COLOR`, `AgentRole`).

**Test files:** `app/projects/[slug]/_party/event-vm.test.ts` (25 tests, all GREEN).

**Gate at hand-off:** 140 test files, 3821 tests GREEN + 2 expected-fail + 5 skipped. `biome check` and `tsc --noEmit` clean on the WO-06-001 files. Pre-existing errors in `layout.test.ts` (WO-06-002) and `ActivityPulse.tsx` (WO-06-009) are untracked files from other work orders outside this scope.
