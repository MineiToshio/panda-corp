---
id: WO-20-002
type: work-order
slug: freshness-badge
title: 'WO-20-002 — `VersionFreshness` badge (Banner consumer) + wire into Resumen'
status: DRAFT
parent: FRD-20
implementation_status: VERIFIED
source_requirements: [REQ-20-001, REQ-20-002]
last_updated: '2026-06-26'
dependsOn: [WO-20-001]
---
# WO-20-002 — `VersionFreshness` badge (Banner consumer) + wire into Resumen

> Source-of-truth: [`blueprint.md`](../blueprint.md) (`CMP-20-badge`) · FRD-13 shared `Banner` (DR-057).

## Goal
Render the overlay-freshness verdict at the top of a project's Resumen, and wire it through the
workspace so it computes from the already-read status.

## Scope
- `projects/[slug]/_components/version-freshness/version-freshness.tsx` — `VersionFreshness`, a
  presentational consumer of the shared `Banner` (NOT a new banner, DR-057):
  - `behind` → `Banner tone="warn"` + recall line + `commandRow="/pandacorp:upgrade"` (copyable).
  - `up-to-date` → `Banner tone="ok"`, no command row.
  - `unknown` → `null`.
- `ProjectWorkspace` (summary branch) — `getOverlayFreshness(status.overlayVersion)` → prop.
- `TabSummary` — new optional `overlayFreshness` prop; renders `<VersionFreshness>` above the summary
  panel, omitted when absent.

## Acceptance criteria (REQ-20-001, REQ-20-002)
- **AC-20-001.1** Behind → warn badge with both versions + the copyable `/pandacorp:upgrade` command.
- **AC-20-001.2** Up-to-date → ok badge, no command row.
- **AC-20-002.1 / .2** The command is shown for copying; the app never executes it (read-only).
- **AC-20-001.3** Unknown → nothing rendered.

## Tests
`…/version-freshness/_tests/version-freshness.test.tsx` — RTL over the three branches (tone, command
presence/absence, empty render). **Status: VERIFIED** (3/3 green). Preview Smoke verified live: this
project (overlay 8.42.1 < factory 8.42.3) renders the behind badge in Resumen.
