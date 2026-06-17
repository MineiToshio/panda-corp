---
id: WO-16-004
type: work-order
slug: orphans-banner
title: WO-16-004 — `OrphansBanner` client component (dismiss + self-clear)
status: DRAFT
parent: FRD-16
implementation_status: PLANNED
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
