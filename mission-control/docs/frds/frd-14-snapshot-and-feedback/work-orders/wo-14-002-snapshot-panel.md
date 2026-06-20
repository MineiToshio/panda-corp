---
id: WO-14-002
type: work-order
slug: snapshot-panel
title: 'WO-14-002 — SnapshotPanel: último commit en verde + worktree command'
status: DRAFT
parent: FRD-14
implementation_status: PLANNED
artifacts:
  - 'src/app/projects/[slug]/_components/snapshot-panel/**'
source_requirements: [REQ-14-001, REQ-14-002, REQ-14-003]
last_updated: '2026-06-19'
---
# WO-14-002 — SnapshotPanel: último commit en verde + worktree command

## Goal
Re-implement the **snapshot panel** so it renders faithfully to the prototype `snapshotPanel()` /
`bStalenessPanel()` on the frozen tokens, with the **clear** canonical copy and its warning refactored
onto the shared **`Banner`** (FRD-13). The pure helpers (`buildSnapshot`, `isSnapshotStale`,
`SNAPSHOT_STALE_*` in `lib/snapshot.ts`) are correct and **VERIFIED** — this WO is **presentational only**.

## Scope
- **`SnapshotPanel`** (`_components/snapshot-panel/**`, Server) — consumes `buildSnapshot(slug, status)`
  (WO-14-001, VERIFIED). Three clearly-separated parts, per the FDD's re-anchored copy:
  1. **Último commit en verde** — `Panel` with a left `ti-circle-check` (`var(--ok)`) icon, the line
     **"Último commit en verde · seguro para probar"** + the closed-FRD green `Chip`, then the muted
     line "commit `<sha>` — pasó todos los gates. Pruébalo en un worktree aparte sin parar el build."
     SHA `tabular-nums`. The copyable **`git worktree add ../<slug>-review <sha>`** in a shared
     **`CmdRow`** + `CopyButton`.
  2. **Building-now line** (when `running`) — visually distinct hammer-icon (`var(--accent)`) line:
     "El build sigue avanzando: `<progreso>` · eso aún no está en verde, no lo pruebes" — never
     conflated with the last-green commit.
  3. **Staleness warning** (when `stale`) — refactored onto the shared **`Banner`** (`tone="warn"`):
     "El último commit en verde quedó atrás del build … lo que pruebes ahí ya no refleja lo que el build
     lleva construido." Warn carried by **icon + text**, not color alone.
- **Omit the whole panel** when `buildSnapshot` returns `null` (no `last_green_sha`) — no empty shell.
- **Copy guardrails:** the canonical "green = last build commit that passed ALL gates, safe to test in a
  separate worktree" wording — **NOT** local-vs-remote, **NOT** the old "punto verde" jargon.
- **Read-only:** MC never runs `git worktree` (FRD-14 non-goal); the panel only surfaces the command.
- **Reuse before create** (`docs/design/components.md`): `Panel`, `Chip`, `CmdRow`, `CopyButton`,
  `Toast`, and the **ONE shared `Banner`** for the staleness warning — no second banner/panel fork.

## Acceptance criteria
- **AC-14-001.1** FOR a building project, the panel SHALL render "Último commit en verde · seguro para
  probar" + the closed-FRD green chip + `last_green_sha`.
- **AC-14-001.2** It SHALL render `git worktree add ../<slug>-review <last_green_sha>` with a copy button.
- **AC-14-001.3** WHEN `last_green_sha` is absent, the panel SHALL be omitted entirely — no broken command.
- **AC-14-002.1** WHEN `running`, it SHALL show the "building now … eso aún no está en verde, no lo
  pruebes" line, visually distinct from the last-green commit.
- **AC-14-003.1** WHEN `stale`, it SHALL show the staleness warning on the shared `Banner` (icon + text,
  not color alone).
- Copy uses the canonical clear wording (no "punto verde", no local-vs-remote framing).
- Rendered output matches `snapshotPanel()` / `bStalenessPanel()` on the frozen tokens; the browser
  fidelity/smoke gate is clean.

## Dependencies
- **Foundation (FRD-13):** WO-13-007 (the **ONE `Banner`** + `Chip`/`Panel`/`CmdRow`/`Button`/`Toast`).
- **Intra (FRD-14):** WO-14-001 (`buildSnapshot`/`isSnapshotStale`/`SNAPSHOT_STALE_*`) — VERIFIED lib.
- **Cross-FRD:** `frd-13` (foundation primitives), `frd-04` (workspace mounts this panel via the Tabbar
  shell seam; FRD-01 `lib/status.ts` supplies the fields).

## Visual reference
`docs/design/prototype/index.html` → `snapshotPanel(i)` (~L867) + `bStalenessPanel(i)` (~L876), on the
frozen tokens. Fidelity, not novelty (DR-056) — see `../fdd.md` and `../mocks/README.md`.
