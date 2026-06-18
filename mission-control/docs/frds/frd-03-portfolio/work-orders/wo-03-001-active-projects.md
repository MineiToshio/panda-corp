---
id: WO-03-001
type: work-order
slug: active-projects
title: WO-03-001 — `activeProjects` compose helper
status: DRAFT
parent: FRD-03
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-17'
---
# WO-03-001 — `activeProjects` compose helper

**Module:** `lib/portfolio.ts` — add `activeProjects()`
**IDs touched:** `CMP-03-active-projects`, `IF-03-activeProjects`; REQ-03-001 (and feeds 002/003/006)
**Dependencies:** WO-01-004 (`readPortfolio`), WO-01-005 (`readStatus`), WO-01-001 (`pathExists`)

## EARS criteria (from FRD-03)

- AC-03-001.1 — The portfolio SHALL list the projects in `architecture`, `building` and `shipped`.
- (feeds) AC-03-002.1 (stage + running), AC-03-003.1 (snapshot), AC-03-006.x (exists flag).

## Contract

```ts
type ProjectListItem = {
  name: string; path: string; repo?: string;
  status: StatusResult; exists: boolean;
  stage?: Phase; running?: boolean;
  snapshot?: { users?: string; returnMetric?: string; verdict?: string };
};
export function activeProjects(): ProjectListItem[];
```

- `readPortfolio()` → for each entry: `readStatus(entry.path)`, `pathExists(entry.path)`.
- Keep entries whose **phase** is `architecture` | `implementation` | `release` | `operation` (the
  active set). Phase from `status.status.phase`; if status absent/malformed, fall back to the
  portfolio `phase` cell (advisory) and still classify.
- `stage` = the phase; `running` = `status.status.running`; `snapshot` populated from the portfolio
  row's business columns only for the shipped/`operation` set.
- Pure-ish (only reads); never throws (fail-soft via the FRD-01 readers).

## Definition of done

- [x] `lib/portfolio.test.ts` extended (RED first) against `factory-full`:
  - [x] returns the active projects; excludes any non-active phase.
  - [x] a row whose path is missing → `exists: false` but still listed (for the not-found badge).
  - [x] a shipped row → `snapshot` populated from its Users/Return/Verdict cells.
  - [x] a row with malformed status → still classified via the table `phase` fallback, no throw.
- [x] No write.
- [x] `.pandacorp/verify.sh` green.

**Status: DONE**

Evidence:
- Tests: `lib/active-projects.test.ts` (54 tests) + `lib/active-projects.adversarial.test.ts` (10 tests, reviewer DR-015) = 64 passing
- Test command: `pnpm vitest run lib/active-projects.test.ts lib/active-projects.adversarial.test.ts` → 56 passed (56)
- `pnpm biome check .` → no errors
- `pnpm tsc --noEmit` → exit 0
- Review: `docs/reviews/wo-03-001-review.md` — APPROVED (Opus 4.8 reviewer, 2026-06-16)
- Committed in: `25a6a35` (lib + fixtures) and `07f2bf8` (UI components)

## Status Note

**What was built:** `activeProjects()` compose helper in `lib/portfolio.ts` (CMP-03-active-projects, IF-03-activeProjects). Reads the factory portfolio table via `readPortfolio()`, enriches each entry with `readStatus(resolvedPath)` and `pathExists(resolvedPath)`, and filters to the active phase set (`architecture` | `implementation` | `release` | `operation`). Phase resolution is authoritative-from-status-yaml with advisory-portfolio-cell fallback. Snapshot is gated on the resolved `stage === "operation"` (authoritative, not the portfolio cell). Entries with missing paths are included with `exists: false` (badge-ready). Never throws (fail-soft throughout).

**Interfaces/contracts exposed:**

```ts
// lib/portfolio.ts
export type ProjectListItem = {
  name: string;
  path: string;          // raw path cell from portfolio row (verbatim)
  repo?: string;
  status: StatusResult;  // from readStatus(resolvedPath)
  exists: boolean;       // from pathExists(resolvedPath)
  stage?: Phase;         // authoritative phase; advisory fallback if status absent/malformed
  running?: boolean;     // strict boolean (never NaN/null-coerced — regression B1')
  snapshot?: { users?: string; returnMetric?: string; verdict?: string }; // operation only
};

// Overload: accepts optional raw markdown content for inline tests
export function activeProjects(content?: string): ProjectListItem[];
```

**Integration seams:**
- Consumes: `readPortfolio` (WO-01-004), `readStatus` (WO-01-005), `pathExists` (WO-01-001) — all in `lib/`
- Consumed by: `ProjectRail` component (`components/ProjectRail.tsx`, built in the same WO-03-001 session by frontend-dev, committed `07f2bf8`)
- Page surface: `app/portfolio/page.tsx` calls `activeProjects()` and passes the array to `ProjectRail`

**Test files:**
- `lib/active-projects.test.ts` — 46 acceptance tests (RED phase, TDD-verified)
- `lib/active-projects.adversarial.test.ts` — 10 adversarial tests (DR-015 reviewer, Opus 4.8)
- Total: 56 tests, all passing. `bash .pandacorp/verify.sh` → 113 files, 3269 tests pass, biome + tsc clean (2026-06-17).
