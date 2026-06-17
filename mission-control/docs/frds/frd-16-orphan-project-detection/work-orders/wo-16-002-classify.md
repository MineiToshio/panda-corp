---
id: WO-16-002
type: work-order
slug: classify
title: WO-16-002 — `lib/orphans` classification + `getOrphans` verdict
status: DRAFT
parent: FRD-16
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
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
