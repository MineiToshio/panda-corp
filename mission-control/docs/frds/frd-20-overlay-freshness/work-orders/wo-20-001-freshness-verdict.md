---
id: WO-20-001
type: work-order
slug: freshness-verdict
title: 'WO-20-001 — `lib/overlay-freshness` reader + verdict (semver, defensive)'
status: DRAFT
parent: FRD-20
implementation_status: VERIFIED
source_requirements: [REQ-20-001, REQ-20-003]
last_updated: '2026-06-26'
---
# WO-20-001 — `lib/overlay-freshness` reader + verdict (semver, defensive)

> Source-of-truth: [`blueprint.md`](../blueprint.md) (`IF-20-freshness`) · [architecture §6, §7](../../../product/architecture.md).

## Goal
The pure verdict layer of `lib/overlay-freshness.ts`: read the factory's current overlay version and
compare it to a project's `overlay_version` as semver. Defensive — any missing/unparseable input
yields `reason: "unknown"`, never throws. No UI here (that is WO-20-002).

## Scope
- `readFactoryOverlayVersion(factoryRoot): string | null` — read `plugin/templates/OVERLAY_VERSION`,
  trim, return `null` when missing/empty/unreadable.
- `getOverlayFreshness(projectOverlayVersion, factoryRoot?): OverlayFreshnessState` — normalize the
  project version, read the factory version, semver-compare. Exports the `OverlayFreshnessState` type
  and the `UPGRADE_COMMAND` constant (`/pandacorp:upgrade`).
- Self-contained semver compare (mirrors `lib/plugin-sync`; second occurrence tolerated, rule of three).

## Acceptance criteria (REQ-20-001, REQ-20-003)
- **AC-20-001.1** GIVEN project `overlay_version` strictly older than factory `OVERLAY_VERSION` →
  `reason: "behind"`, detail names both versions.
- **AC-20-001.2** GIVEN project version equal to OR newer than factory → `reason: "up-to-date"`.
- **AC-20-001.3** GIVEN either version missing/unparseable → `reason: "unknown"`.
- **AC-20-003.x** Defensive: missing file, empty/whitespace file, unparseable on either side,
  unreadable root → `unknown`, never throws. Tolerates a leading `v`.

## Tests
`src/lib/overlay-freshness/_tests/overlay-freshness.test.ts` — temp-factory-root fixtures over every
branch above (13 cases). **Status: VERIFIED** (13/13 green).
