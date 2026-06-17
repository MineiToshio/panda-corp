---
id: WO-15-003
type: work-order
slug: sync-route
title: WO-15-003 — `app/api/plugin-sync` route handler
status: DRAFT
parent: FRD-15
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-17'
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

## Status Note

**What was built:** `GET /api/plugin-sync` route handler (`app/api/plugin-sync/route.ts`) — the Node.js route that exposes `getPluginSyncState()` (IF-15-sync) as a JSON endpoint so the client banner can poll it.

**Interfaces/contracts exposed (`CMP-15-route`):**

```ts
// app/api/plugin-sync/route.ts

export const runtime = "nodejs";          // child_process needed for git probes
export const dynamic = "force-dynamic";   // never cached — drift is live state

export function GET(_request: Request): Response;
// Returns: Response.json(getPluginSyncState(), { status: 200, headers: { "Cache-Control": "no-store" } })
// Always 200, even when reason === "unknown" (AC-15-003.4).
// Read-only: only calls getPluginSyncState(), no writes (AC-15-003.2, REQ-15-005).
```

**Integration seam for WO-15-004 (banner component):**
```ts
// Poll GET /api/plugin-sync on mount and on interval.
// Response body is PluginSyncState — render banner only when body.drift === true.
// body.reason selects the banner copy; body.detail is the Spanish subtitle one-liner.
import type { PluginSyncState } from "@/lib/plugin-sync";
```

**Acceptance criteria coverage:**
- AC-15-003.1: all 5 `reason` branches return 200 + full `PluginSyncState` JSON (7 shape tests).
- AC-15-003.2: mock spy confirms `getPluginSyncState` called once per request, no arguments, no writes (3 tests).
- AC-15-003.3: `Cache-Control: no-store` header verified + `dynamic` export asserted (2 tests).
- AC-15-003.4: `reason="unknown"` still returns 200, `drift=false` in body, no throw (3 tests).
- Content-Type `application/json` verified (1 test).
- `runtime="nodejs"` and `dynamic="force-dynamic"` exports asserted directly (2 tests).

**Test files covering this WO:**
- `app/api/plugin-sync/route.test.ts` — 17 tests (RED → GREEN), all ACs covered via `vi.mock("@/lib/plugin-sync")`.

**Gate:** 17/17 tests GREEN. verify.sh green: 126 files, 3565 tests pass + 2 expected-fail + 5 skipped, biome clean, tsc clean.
