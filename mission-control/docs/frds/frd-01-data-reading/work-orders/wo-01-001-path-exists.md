---
id: WO-01-001
type: work-order
slug: path-exists
title: WO-01-001 — `pathExists` read-only probe
status: ACTIVE
parent: FRD-01
implementation_status: VERIFIED
source_requirements: []
dependsOn: [WO-01-000]
last_updated: '2026-06-16'
---
# WO-01-001 — `pathExists` read-only probe

**Module:** `lib/fs-utils.ts` (new tiny module — see report)
**IDs touched:** `IF-01-pathExists`; REQ-01-010
**Dependencies:** WO-01-000 (fixtures)

## EARS criteria (from FRD-01)

- AC-01-010.1 — IF a project's path does not exist, THEN the system SHALL mark it as not found and
  SHALL NOT break the rest of the view.

## Contract

```ts
export function pathExists(p: string): boolean;   // never throws; false on absent or on error
```

Read-only existence probe used by `readStatus`, `readProjectDocs` and the FRD-03 not-found badge.
Synchronous (Server Component friendly), backed by `fs.existsSync` wrapped to swallow errors.

## Definition of done

- [x] `lib/fs-utils.test.ts` (RED first): returns `true` for a known fixture path, `false` for a
  non-existent path, `false` (no throw) for an invalid/permission-error path.
- [x] Never writes, never throws.
- [x] `.pandacorp/verify.sh` green.

## Status: DONE

**Evidence:** `bash .pandacorp/verify.sh` — 249 tests passed, biome+tsc clean (2026-06-16).
Implementer commit: `fa49710`. Reviewer verdict: APPROVED (`docs/reviews/wo-01-001-review.md`).
Adversarial suite (13 tests): `lib/fs-utils.adversarial.test.ts` — all green.
