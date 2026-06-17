---
id: WO-16-003
type: work-order
slug: orphans-route
title: WO-16-003 — `app/api/orphans` route handler
status: DRAFT
parent: FRD-16
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
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
