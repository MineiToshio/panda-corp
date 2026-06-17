---
id: WO-15-003
type: work-order
slug: sync-route
title: WO-15-003 — `app/api/plugin-sync` route handler
status: DRAFT
parent: FRD-15
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
---
# WO-15-003 — `app/api/plugin-sync` route handler

> Source-of-truth: [`blueprint.md`](../blueprint.md) (`CMP-15-route`) · [architecture §3, §8](../../../product/architecture.md).

## Goal
Expose `getPluginSyncState()` over `GET /api/plugin-sync` so the client banner can poll it (the git
probe needs Node outside a Server Component render — architecture §3).

## Scope
- `app/api/plugin-sync/route.ts`: `GET` → `Response.json(getPluginSyncState())`.
- `export const runtime = "nodejs"` (needs `child_process`) and `export const dynamic = "force-dynamic"`
  (drift is live state — never cached).

## Acceptance criteria
- **AC-15-003.1** `GET /api/plugin-sync` returns 200 with a JSON body matching the `PluginSyncState` shape.
- **AC-15-003.2** (REQ-15-005) The handler performs NO write and never executes the update command —
  it only calls the read-only `IF-15-sync`.
- **AC-15-003.3** The response is uncacheable (`dynamic = "force-dynamic"`; no stale drift).
- **AC-15-003.4** WHEN `IF-15-sync` returns `reason === "unknown"`, the handler still returns 200 (the
  banner decides not to show) — a degraded probe is not a 500.

## TDD
Test the route by importing the handler and invoking `GET` with a `PANDACORP_FACTORY_ROOT` fixture
(or by mocking `getPluginSyncState`); assert status, JSON shape, and that no fs write occurred.

## Definition of done
- ACs green; route returns the verdict; no write path. `.pandacorp/verify.sh` green.

## Dependencies
- WO-15-002.
