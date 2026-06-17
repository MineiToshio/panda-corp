---
id: WO-06-001
type: work-order
slug: event-vocabulary-vm
title: WO-06-001 — Iconic event vocabulary + event view-model mapper
status: DRAFT
parent: FRD-06
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-16'
---
# WO-06-001 — Iconic event vocabulary + event view-model mapper

**Components/Interfaces:** `IF-06-icon-map`, `IF-06-event-vm` · **Traces:** REQ-06-012, REQ-06-013, REQ-06-011
**Deploy unit:** Party tab (pure logic module) · **Location:** `app/projects/[slug]/_party/event-vm.ts` (+ `.test.ts`)

## Acceptance criteria (verbatim EARS)
- AC-06-012.1: The events SHALL use a **fixed, bounded iconic vocabulary** (~12 types: read, write, edit, test ✓/✗, message, start, end); tool = extra icon.
- AC-06-013.1: **Failure SHALL be a first-class state** ... agent in a "downed" state + danger color + error icon, distinct from "completed". Never hidden in a log.
- AC-06-011.1: EACH agent SHALL have a **fixed color** reused across the ENTIRE UI (its sprite, the event feed and its cards). If several projects are being built, project-color (left border) + agent-color (second border).

## Scope
- Define `EVENT_ICON: Record<EventType, IconRef>` covering the §5 vocabulary (`read, write, edit, test_ok, test_fail, message, start, end, handoff, blocked, review, achievement`). Centralized constant — no magic strings.
- `toEventVM(event: DashboardEvent): EventVM` → `{ icon, toolIcon?, agentColorKey, projectColorKey?, isFailure, label (Spanish), at, workOrder?, project? }`.
- `isFailure` true when `status === 'fail'` or `event === 'test_fail'`.
- `agentColorKey` derived from `event.agent` (the token key, not a hex — FRD-13 owns the value).
- `projectColorKey` set only when `event.project` is present (multi-project, REQ-06-011).

## Dependencies
- FRD-01 `lib/events` — the `DashboardEvent` type + `EventType` enum (intra-platform). Use its exported types; do not redefine the schema.

## TDD / Definition of done
- RED→GREEN tests with event fixtures: every `EventType` maps to an icon; a `tool` adds a tool icon; `test_fail`/`status:'fail'` → `isFailure`; an event with `project` → `projectColorKey` set, without → undefined; labels are Spanish.
- Pure, no I/O, no DOM. `pnpm vitest run` green, `tsc --noEmit` clean, biome clean.

## Status Note

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
