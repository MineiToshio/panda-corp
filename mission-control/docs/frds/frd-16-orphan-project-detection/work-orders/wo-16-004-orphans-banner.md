---
id: WO-16-004
type: work-order
slug: orphans-banner
title: WO-16-004 — `OrphansBanner` client component (dismiss + self-clear)
status: DRAFT
parent: FRD-16
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-16'
---
# WO-16-004 — `OrphansBanner` client component (dismiss + self-clear)

> Source-of-truth: [`blueprint.md`](../blueprint.md) (`CMP-16-banner`, `CMP-16-steps`) · [architecture §3, §4.8, §7](../../../product/architecture.md).

## Goal
Render one dismissible banner per candidate (orphan → adopt; unlisted → sync-portfolio) with its path
and the copyable command; remember dismissals client-locally; self-clear when adopted.

## Scope
- `components/orphans-banner.tsx` (`"use client"`): poll `/api/orphans`; render one banner per
  candidate not currently dismissed; collapse to a compact stacked banner when several.
- Dismissal persisted in `localStorage` keyed by absolute `path` (client-local UI state — NOT a
  factory write, architecture §4.8).
- Per `kind`: `orphan` → "Proyecto sin registrar: `<name>` — ¿adoptarlo?" + path + `/pandacorp:adopt`
  recall; `unlisted` → "Proyecto con marcador pero fuera del portfolio" + `/pandacorp:sync-portfolio`.

## Acceptance criteria
- **AC-16-004.1** (REQ-16-001) WHEN the probe returns an `orphan`, the banner shows the name, path, and
  the `/pandacorp:adopt` steps.
- **AC-16-004.2** (REQ-16-003) WHEN the probe returns `unlisted`, the banner shows `/pandacorp:sync-portfolio`
  (NOT adopt).
- **AC-16-004.3** (REQ-16-002) The path and command are shown as copyable text (copy button copies the command).
- **AC-16-004.4** (REQ-16-004) Clicking "descartar" hides that banner and persists the dismissal across
  refresh (localStorage by path); a candidate that disappears from the probe (adopted) is gone on next poll.
- **AC-16-004.5** (REQ-16-005) No action executes anything — copy/dismiss/navigate only; no non-GET fetch.
- **AC-16-004.6** Spanish copy + `aria-label`s (DR-009); state not by color alone (FRD-13).
- **AC-16-004.7** Empty candidate list → renders nothing (no empty shell).

## TDD
`components/orphans-banner.test.tsx` (`@testing-library/react` + `jsdom`); mock `fetch` per scenario;
assert per-kind copy, dismiss persistence (localStorage), self-clear, copy.

## Definition of done
- ACs RED → GREEN. Dismiss remembered; self-clears; per-kind command; Spanish. `.pandacorp/verify.sh` green.

## Dependencies
- WO-16-003 (the route).
- FRD-02 `CopyButton` (cross-feature; fallback inline copy if not yet available).

## Status Note

**Built:** `OrphansBanner` client component (`"use client"`) with full dismiss + self-clear lifecycle.

**Files delivered:**
- `components/orphans-banner.tsx` — `CMP-16-banner` + `CMP-16-steps` (per-kind recall)
- `components/orphans-banner.test.tsx` — 33 tests RED→GREEN covering all 7 ACs

**Interfaces / contracts exposed:**
```tsx
export function OrphansBanner(): React.JSX.Element | null
// No props — self-contained polling + localStorage dismiss state
```
- Polls `GET /api/orphans` on mount + every 30 s (`POLL_INTERVAL_MS = 30_000`)
- `localStorage` key per dismissed path: `"mc:orphan-dismissed:<absolute-path>"` = `"1"`
- Per-kind command: `orphan` → `/pandacorp:adopt`; `unlisted` → `/pandacorp:sync-portfolio`
- Reuses `CopyButton` from `components/CopyButton.tsx` (FRD-02)

**Integration seams:**
- Drop `<OrphansBanner />` into the dashboard health-banner stack (FRD-18 placement); no props needed
- The component imports `type Candidate` from `@/lib/orphans` for type safety only (no runtime dep on the scanner — all data comes via the API route)

**`data-testid` surface:**
- `orphans-banner` — root wrapper (role="alert", aria-label in Spanish)
- `orphan-icon` — warning triangle icon (state not by color alone, FRD-13)
- `orphan-item-<name>` — one per visible candidate
- `orphan-path-<name>` — absolute path text
- `orphan-copy-cmd-<name>` — wrapper around `CopyButton` (inner testid: `copy-button`)
- `orphan-dismiss-<name>` — dismiss button with aria-label

**Test coverage:** `components/orphans-banner.test.tsx` (33 tests)
- AC-16-004.1: orphan name/path/adopt recall (5 tests)
- AC-16-004.2: unlisted sync-portfolio copy (4 tests)
- AC-16-004.3: copyable path + copy button writes correct command (4 tests)
- AC-16-004.4: dismiss hides + persists in localStorage + self-clears on poll (6 tests)
- AC-16-004.5: read-only GET only (2 tests)
- AC-16-004.6: Spanish copy + aria-labels + icon presence (6 tests)
- AC-16-004.7: empty list renders nothing (5 tests + error/non-ok cases)

**Gate:** 131 files, 3683 tests GREEN + 2 expected-fail + 5 skipped; tsc clean; biome clean.
