---
id: WO-01-006
type: work-order
slug: read-project-docs
title: WO-01-006 — `readProjectDocs` (feature-centric tree discovery)
status: ACTIVE
parent: FRD-01
implementation_status: VERIFIED
source_requirements: []
dependsOn: [WO-01-000, WO-01-001]
last_updated: '2026-06-16'
---
# WO-01-006 — `readProjectDocs` (feature-centric tree discovery)

**Module:** `lib/docs.ts`
**IDs touched:** `CMP-01-docs`, `IF-01-readProjectDocs`; REQ-01-007
**Dependencies:** WO-01-000 (fixtures), WO-01-001 (`pathExists`)

## EARS criteria (from FRD-01)

- AC-01-007.1 — The system SHALL read, per project, the feature-centric product documents in
  `docs/` (DR-049): the product layer (`docs/product/prd.md` + `docs/product/architecture.md`), each
  feature module under `docs/frds/frd-NN-<slug>/` (`frd.md`, and when present `fdd.md`,
  `blueprint.md`, `mocks/`, `work-orders/`), plus global `docs/adr/`, `docs/analytics/`,
  `docs/decision-log.md`, and the owner-facing `.pandacorp/` layer (`comms/progress.md`,
  `inbox/decisions.md`, `inbox/bugs/`).

## Contract

```ts
type FrdModule = {
  slug: string; hasFdd: boolean; hasBlueprint: boolean; hasMocks: boolean; hasWorkOrders: boolean;
};
type ProjectDocsIndex = {
  prd?: string; architecture?: string;   // present-path of each product-layer doc
  frds: FrdModule[];
  hasAdr: boolean; hasAnalytics: boolean; hasDecisionLog: boolean;
  comms: { progress?: string; decisions?: string; bugs: string[] };
};

export function readProjectDocs(projectPath: string): ProjectDocsIndex;
```

- **Discovery, not full ingestion:** report which docs exist (and their paths) so FRD-04/05/08 can
  read content on demand. (Heavy content reads belong to those features' `lib/docs`/`work-orders`
  usage; here we index the tree.)
- Enumerate `docs/frds/frd-*` dirs → one `FrdModule` each, probing for the optional artifacts.
- Tolerate any missing layer: absent → empty array / `false` / `undefined`. Never throws.

## Definition of done

- [x] `lib/docs.test.ts` (RED first) against `proj-a`:
  - [x] `prd` and `architecture` paths present.
  - [x] `frds` contains `frd-01-x` with `hasBlueprint: true`, `hasWorkOrders: true`.
  - [x] `hasAdr`, `hasDecisionLog` true; `comms.progress`, `comms.decisions` present; `comms.bugs` has 1.
  - [x] A project with only a bare `docs/` → mostly empty index, no throw.
- [x] No write; fail-soft per blueprint §3.
- [x] `.pandacorp/verify.sh` green.

## Evidence

Status: **DONE**

Verify run: `bash .pandacorp/verify.sh` — 2026-06-16
Result: ✅ all gates green (biome + tsc + vitest) — 874 tests passed across 31 test files.
Implementation: `lib/docs.ts` — `readProjectDocs` function with `FrdModule` + `ProjectDocsIndex` types.
Test file: `lib/docs.test.ts` — 54 tests covering AC-01-007.1, REQ-01-010, REQ-01-011, blueprint §3, regressions B1'/I2/I3.
Commit: `cb1f801` (feat — implement), `28a3eef` (fix — test cleanup).
