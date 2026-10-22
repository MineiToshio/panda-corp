---
id: FRD-20
type: frd
title: FRD-20 — Project overlay freshness
status: ACTIVE
implementation_status: VERIFIED
ui: true
visual_source: docs/design/prototype/index.html
visual_source_mocks: docs/frds/frd-20-overlay-freshness/mocks/overlay-freshness.html
last_updated: '2026-10-22'
---
# FRD-20 — Project overlay freshness

Tells the owner, in a project's **Resumen**, whether that project's Pandacorp **overlay** (the
`.pandacorp/` integration layer, versioned by `overlay_version` in its `status.yaml`) is at the
factory's current version or **behind** it — i.e. whether `/pandacorp:upgrade` has work to do.
When behind, it shows the exact command to copy and run. Read-only (reads `overlay_version` from the
already-parsed status plus one file; does not call Claude, run git, or write).

This is the **project-overlay** analogue of [FRD-15](../frd-15-plugin-out-of-sync-warning/frd.md),
which warns when the **installed plugin** is behind the **plugin source**. They are different axes:

| | Compares | Owning doc | Surface |
|---|---|---|---|
| **FRD-15** | installed plugin `version` vs `plugin/.claude-plugin/plugin.json` `version` | FRD-15 | global drift banner |
| **FRD-20** | a project's `overlay_version` vs `plugin/templates/OVERLAY_VERSION` | this FRD | each project's Resumen |

## How it's detected (all local, read-only)

- **Project version**: `overlay_version` from `<project>/.pandacorp/status.yaml` — already parsed by
  `readStatus()` (FRD-01) into `ProjectStatus.overlayVersion`. No new status read.
- **Factory version**: the `plugin/templates/OVERLAY_VERSION` file — the single source
  `/pandacorp:upgrade` syncs a project's overlay up to (DR-051). One small file read.
- **Verdict**: compare the two as semver. `behind` only when the project version is **strictly older**
  than the factory's; equal or newer → `up-to-date`; either missing/unparseable → `unknown`.

> **Owner-facing term:** in the UI copy the overlay is called **"el motor de Pandacorp"** (the
> technical name `overlay` stays in code/docs; the owner is told about "el motor de Pandacorp" so the
> badge clearly reads as a Pandacorp thing). Owner request, 2026-06-26.

> **Design freeze amendment (2026-10-22, S2.2).** The approved Órbita prototype shows a notice only when the overlay is behind (an up-to-date project shows nothing, like FRD-15); the word "badge" becomes "notice" and the headings follow the prototype. The quiet ok badge is out of v2 (owner decision 2026-10-21). Prototype-drawn behaviour: REQ-20-004 (AC-20-004.1). Source: `docs/design/freeze/reconciliation.md` (A-71, B-32), `docs/design/freeze/copy/frd-20.md`.

## The verdicts (the notice at the top of Resumen)

- **`behind`** — a warn notice: heading "Este proyecto usa una versión vieja del motor de Pandacorp", a detail naming both
  versions ("Va con la v8.98.0 y la fábrica ya está en la v8.110.0. Actualízalo para que el próximo build use las reglas y herramientas nuevas."), and the **copyable** command `/pandacorp:upgrade` with where to run it.
- **`up-to-date`** — renders **nothing** in v2. **Out of v2 (owner decision 2026-10-21):** a quiet ok badge with the heading "Última versión de Pandacorp" and a detail confirming the
  project uses the factory's current overlay.
- **`unknown`** — renders **nothing** (no false alarm), exactly like FRD-15 — a missing/unparseable
  version on either side is a deliberate no-op, not an error state.

## Acceptance criteria (EARS)

### REQ-20-001 — Freshness verdict
- **AC-20-001.1** — IF the project's `overlay_version` is **strictly behind** the factory's
  `OVERLAY_VERSION` (semver), Mission Control SHALL show the warn notice in Resumen — heading
  "Este proyecto usa una versión vieja del motor de Pandacorp", a detail naming both versions, and the copyable
  `/pandacorp:upgrade` command.
- **AC-20-001.2** — **Out of v2 (owner decision 2026-10-21):** IF the project's `overlay_version` **equals or is newer than** the factory's,
  Mission Control SHALL show the ok badge ("al día") with **no** command row. In v2, the same condition shows nothing.
- **AC-20-001.3** — IF either version is missing or unparseable, Mission Control SHALL treat the
  state as `unknown` and show **nothing** (no false alarm).

### REQ-20-002 — Command to recover
- **AC-20-002.1** — The warn notice SHALL show the **command to copy** `/pandacorp:upgrade`.
- **AC-20-002.2** — The notice SHALL NOT execute the command — it only shows it so the owner runs it
  in the project's folder.

### REQ-20-003 — Read-only / defensive
- The check SHALL **not execute anything**: it only reads `overlay_version` (already parsed) and the
  `OVERLAY_VERSION` file. Any unreadable/unparseable input yields `unknown` (never a false alarm),
  and the readers never throw (DR-078: an explicit `unknown` reason, never a silent fallthrough).

### REQ-20-004 — Where to run the command (added 2026-10-22, design freeze)
- **AC-20-004.1** — THE upgrade notice SHALL name the project folder where the command runs ("Córrelo en la carpeta de <Proyecto>").

**Worked example (AC-20-004.1).** PandaSaga is on overlay v8.98.0 and the factory on v8.110.0: the notice reads "Este proyecto usa una versión vieja del motor de Pandacorp", names both versions, shows `/pandacorp:upgrade` with a copy button and the line "Córrelo en la carpeta de PandaSaga". A project on v8.110.0 shows no notice.

## Edge cases
- Project version missing or unparseable → no notice (`unknown`, AC-20-001.3).
- Project version equal or newer → no notice in v2 (AC-20-001.2).

## Non-goals
- It does not run `/pandacorp:upgrade`, `git`, or install anything.
- It does not poll: the verdict is computed server-side per render of the Resumen tab (the overlay
  version changes only when an upgrade runs, which reloads the workspace anyway) — no client loop,
  unlike FRD-15's banner.
- It does not warn about the installed plugin being behind its source — that is FRD-15.

## Implementation note
`lib/overlay-freshness.ts` exposes `getOverlayFreshness(projectOverlayVersion, factoryRoot?)` →
`OverlayFreshnessState` (`projectVersion`, `factoryVersion`, `reason`, `detail`, `upgradeCommand`).
`ProjectWorkspace` computes it from the already-read status and passes it to `TabSummary`, which
renders `VersionFreshness` — a consumer of the shared `Banner` primitive (DR-057), not a new banner.
