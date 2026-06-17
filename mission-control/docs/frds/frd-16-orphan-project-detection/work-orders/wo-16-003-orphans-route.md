---
id: WO-16-003
type: work-order
slug: orphans-route
title: WO-16-003 — `app/api/orphans` route handler
status: DRAFT
parent: FRD-16
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-17'
---
# WO-16-003 — `app/api/orphans` route handler

> Source-of-truth: [`blueprint.md`](../blueprint.md) (`CMP-16-route`) · [architecture §3, §8](../../../product/architecture.md).

## Goal
Expose `getOrphans()` over `GET /api/orphans` for the client banner to poll (the directory scan needs
Node outside a Server Component render).

## Scope
- `app/api/orphans/route.ts`: `GET` → `Response.json(getOrphans())`.
- `runtime = "nodejs"`, `dynamic = "force-dynamic"` (live filesystem state, never cached).

## Acceptance criteria
- **AC-16-003.1** `GET /api/orphans` returns 200 with a JSON array of `Candidate`.
- **AC-16-003.2** (REQ-16-005) The handler performs NO write and runs no adopt/git/portfolio write — it
  only calls the read-only `IF-16-scan`.
- **AC-16-003.3** WHEN there are no candidates, returns 200 with `[]` (not 404/500).
- **AC-16-003.4** A degraded scan (unreadable projects path) returns 200 with `[]`, not a 500.

## TDD
Invoke the handler with a `PANDACORP_FACTORY_ROOT` fixture tree (or mock `getOrphans`); assert status,
JSON shape, empty-state, and no-write.

## Definition of done
- ACs green; read-only; empty-tolerant. `.pandacorp/verify.sh` green.

## Dependencies
- WO-16-002.

## Status Note

**Built:** `app/api/orphans/route.ts` — `GET /api/orphans` route handler (CMP-16-route). Minimal implementation: delegates entirely to `getOrphans(FACTORY_ROOT)` and serializes the result as JSON with `Cache-Control: no-store`. Belt-and-suspenders `try/catch` at the route level ensures AC-16-003.4 even if `getOrphans` ever breaks its own defensive contract.

**Interfaces/contracts exposed:**

```ts
// app/api/orphans/route.ts
export const runtime = "nodejs";           // fs.readdirSync + fs.accessSync need Node
export const dynamic = "force-dynamic";    // live filesystem state, never cached

// GET /api/orphans → 200 application/json, Cache-Control: no-store
// Body: Candidate[]  (same type as lib/orphans.ts :: Candidate)
// Always 200 — [] on no candidates (AC-16-003.3) and on degraded scan (AC-16-003.4)
export function GET(_request: Request): Response;
```

**Integration seams:**
- Consumes `getOrphans(factoryRoot: string): Candidate[]` from `lib/orphans.ts` (IF-16-scan, WO-16-002).
- Reads `FACTORY_ROOT` from `lib/config.ts` (the shared env-override-aware factory root resolver).
- WO-16-004 (`CMP-16-banner`) polls this endpoint at `GET /api/orphans`; body shape is `Candidate[]` with fields `{ name, path, kind, hasMarker, inPortfolio }`.

**Test files covering this WO:**
- `app/api/orphans/route.test.ts` — 19 tests RED→GREEN covering AC-16-003.1–4, Content-Type, Cache-Control, and module exports (`runtime`, `dynamic`).

**Gate:** 130 test files, 3650/3650 tests pass (+ 2 expected-fail + 5 skipped), tsc clean, biome clean.
