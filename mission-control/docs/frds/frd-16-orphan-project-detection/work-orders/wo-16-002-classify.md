---
id: WO-16-002
type: work-order
slug: classify
title: WO-16-002 — `lib/orphans` classification + `getOrphans` verdict
status: DRAFT
parent: FRD-16
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-17'
---
# WO-16-002 — `lib/orphans` classification + `getOrphans` verdict

> Source-of-truth: [`blueprint.md`](../blueprint.md) (`IF-16-scan`, truth table) · [architecture §4.4](../../../product/architecture.md).

## Goal
Classify each candidate folder as `orphan`, `unlisted`, or not-a-candidate, and compose `getOrphans()`.

## Scope
- `classifyCandidate(path, registeredPaths): Candidate | null` per the blueprint truth table.
- `getOrphans(): Candidate[]` — compose `resolveProjectsPath` + `listProjectFolders` +
  `classifyCandidate`, reading registered paths from `lib/portfolio.ts`.

## Acceptance criteria
- **AC-16-002.1** (REQ-16-001) git repo, NO `.pandacorp/status.yaml`, NOT in portfolio → `kind: "orphan"`.
- **AC-16-002.2** (REQ-16-003) git repo, HAS marker, NOT in portfolio → `kind: "unlisted"`.
- **AC-16-002.3** git repo, HAS marker, IN portfolio → `null` (not a candidate, no nudge).
- **AC-16-002.4** git repo, NO marker, IN portfolio → `null` (already known to the factory; do not nag).
- **AC-16-002.5** `Candidate` carries `name`, absolute `path`, `kind`, `hasMarker`, `inPortfolio`.
- **AC-16-002.6** Portfolio path comparison tolerates trailing-slash / relative-vs-absolute differences
  (normalize before matching) so a registered project is not misreported as an orphan.
- **AC-16-002.7** (REQ-16-005) Broken portfolio rows / missing portfolio → those candidates classify
  against the readable subset; never throws.

## TDD
Extend `lib/orphans.test.ts` with fixtures covering all four truth-table rows and the normalization case.

## Definition of done
- All truth-table rows + normalization tested RED → GREEN. `.pandacorp/verify.sh` green.

## Dependencies
- WO-16-001; FRD-01 `lib/portfolio.ts` (shipped).

## Status Note

**Built:** `classifyCandidate` and `getOrphans` added to `lib/orphans.ts`, extending the WO-16-001 foundation. `OrphanKind`, `Candidate` types exported from the same module.

**Interfaces/contracts exposed:**

```ts
// lib/orphans.ts
export type OrphanKind = "orphan" | "unlisted";
export type Candidate = {
  name: string;       // folder basename
  path: string;       // absolute path
  kind: OrphanKind;
  hasMarker: boolean; // .pandacorp/status.yaml present
  inPortfolio: boolean;
};

// Truth table: (hasMarker=false, inPortfolio=false) → "orphan"
//              (hasMarker=true,  inPortfolio=false) → "unlisted"
//              inPortfolio=true → null (no nudge, AC-16-002.3 + AC-16-002.4)
export function classifyCandidate(
  candidatePath: string,
  registeredPaths: string[],
): Candidate | null;

// Compose: resolveProjectsPath + listProjectFolders + classifyCandidate
// Reads portfolio from <factoryRoot>/factory/portfolio.md via lib/portfolio.ts
export function getOrphans(factoryRoot: string): Candidate[];
```

**Integration seams:**
- `getOrphans(factoryRoot)` is the single entry point for WO-16-003 (`app/api/orphans/route.ts`) — call it with the factory root and serialize the result as JSON.
- Path normalization (`path.resolve` + trailing-sep strip) is internal to `classifyCandidate`; callers pass raw paths from the portfolio.
- Marker check is `fs.accessSync(<path>/.pandacorp/status.yaml)` — read-only, no subprocess.

**Test files covering this WO:**
- `lib/orphans.test.ts` — AC-16-002.1–7 (24 new tests, all 57 pass including the 33 from WO-16-001).
- `lib/orphans.adversarial.test.ts` — WO-16-001 adversarial coverage (16 tests; still green; no changes needed for WO-16-002).

**Gate at commit `73d560b`:** biome clean · tsc clean · 3631/3631 tests pass.
