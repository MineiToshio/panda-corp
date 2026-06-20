---
id: FDD-16
type: fdd
title: FDD-16 — Orphan project detection (adopt?) (feature design)
parent: frds/frd-16-orphan-project-detection/frd.md
ui: true
visual_source: docs/design/prototype/index.html
mock: docs/design/prototype/index.html
status: ACTIVE
last_updated: '2026-06-19'
---
# FDD-16 — Orphan project detection (adopt?)

> Scoped feature design on the **frozen visual contract** (`docs/design/design-tokens.json` + root
> `DESIGN.md`), extracted from the owner-approved prototype. Cross-cutting tokens/a11y are FRD-13's FDD.
> No new tokens introduced. **Fidelity, not novelty.**
>
> **Re-anchor note (2026-06-19):** the orphans banner is now **canonical in the prototype** — render fn
> **`orphanBanner()`** (~L633), with the candidate list `ORPHANS` (~L627) and the shared banner helpers
> `bBanner`/`cmdRow`. It is no longer "derived from the plugin banner template"; it is its own render fn
> built on the **one shared banner shape**.

## Surface — the orphans banner (CMP-16-banner)

- **Render fn:** `orphanBanner()` (~L633). A **dismissible warning banner** (warn tone, same shape as
  the plugin-sync banner): `warn-bg` background, hairline `bd2` border, a left **folder-question** icon
  (`--warn`), a heading "Proyectos de Pandacorp sin registrar" with a **×** dismiss button
  (`aria-label="Descartar aviso"`), and one **item per candidate**.
- **Scope (REQ-16) — `.pandacorp/`-marked projects ONLY.** The banner lists **only folders that carry
  the `.pandacorp/` marker**; foreign folders in `~/Proyectos/` (personal code, another AI's projects)
  are **never** listed. The banner copy states this explicitly: "Detecté carpetas con `.pandacorp/` que
  no están en tu portfolio. (Las carpetas ajenas de `~/Proyectos/` nunca se listan aquí.)" Two cases,
  both requiring the marker:
  - **orphan** — has `.pandacorp/` but never went through the handoff (built by hand / cloned) → chip
    "sin adoptar" + `/pandacorp:adopt`.
  - **unlisted** — has `.pandacorp/status.yaml` but its portfolio row is missing → chip "falta en
    portfolio" + `/pandacorp:sync-portfolio` (REQ-16: never adopt an already-marked project).
- **Per item:** the project name (500 weight), the case chip (icon+text, not color alone), a monospace
  selectable **path** code, a `--warn` hint line explaining the case, and a `.cmd` command row +
  `CopyButton` with the right command.
- **Overflow collapse:** when **more than two** candidates exist, the banner shows the first two + a
  toggle "Ver N proyecto(s) más" / "Ver menos" (`BGROUP.orphanMore`) so orphans don't dominate the
  dashboard (avoids the wall-of-banners regression).
- **Placement:** stacked just below the dashboard page title (with the plugin-drift banner), per
  `dashboardView()` (`+pluginBanner()+orphanBanner()`, ~L745).

## Components mapped to shared primitives
| Surface | Primitive | Notes |
|---|---|---|
| Banner shell | **the ONE shared `Banner` primitive** (warn variant, dismissible, multi-item + collapse) | `kind="orphan"` consumer — **never a second banner** |
| Per-candidate case chip | `Chip` (icon+text state signal, FRD-13 / `StateBadge` idiom) | "sin adoptar" / "falta en portfolio", not color alone |
| Path code | inline `mono` `code` | selectable absolute path |
| Command row + copy | `CmdRow` + `CopyButton` (`src/components/core/CopyButton/CopyButton.tsx`) | read-only (adopt / sync-portfolio) |
| Overflow toggle / dismiss | `Banner` collapse + dismiss affordance | localStorage-remembered dismissal |

### Shared `Banner` primitive (DR-057 — reuse-before-create)
This banner and the **FRD-15 plugin-sync banner** are the **same banner shape** — they MUST be the same
**one `Banner` primitive** with variants (drift vs orphan; dismissible vs persistent; single vs
multi-item with collapse), not two near-duplicate components. The orphans banner is the `kind="orphan"`
(multi-item, dismissible, collapsible) consumer. The portfolio path-not-found warning (FRD-03), the
dashboard health banners (FRD-18), the inline read-error banners (FRD-04/05) and the memory-health
staleness nudge (FRD-17) are all consumers of this same `Banner`. (The duplicate `BANNER_STYLE` blocks
in today's `orphans-banner.tsx` / `plugin-sync-banner.tsx` are the exact DR-057 defect to fix by
collapsing onto the shared primitive.)

## States
- **No orphans** (empty list / not yet fetched / all dismissed): renders **nothing** (AC-16-004.7) — no
  empty shell; self-clears when a candidate is adopted/fixed and drops out of the probe.
- **One/two candidates:** all shown inline.
- **>2 candidates:** first two + overflow toggle.
- **Dismissed:** the owner's × hides the banner (remembered in localStorage — client-local UI state, not
  a factory write).
- **Loading:** the client component polls `/api/orphans`; renders nothing until the first confirmed poll
  (no false-alarm flash).
- **Error:** a failed/parse-error poll does **not** update state — the banner stays hidden; the rest of
  the app is unaffected.

## Cohesion (DR-062)
The orphans banner is **not** a page-title surface and never carries its own heavy header — it is a
`Banner` strip placed under the dashboard's one light `PageTitle` (`pageHead`). Its chips are the shared
`Chip`, its command row the shared `CmdRow`. One banner, one chip, one command-row across the app.

## Demo-only controls (DR-061) — none
Real read-only data only (detected folders with `.pandacorp/` + the portfolio); the dismiss is a real,
remembered UI action and the commands are copy-only. No state-preview controls.

## Visual reference
`docs/design/prototype/index.html` → `orphanBanner()` (~L633), `ORPHANS` (~L627), `bBanner`/`cmdRow`
(~L566/L600), placement in `dashboardView()` (~L745), on the frozen tokens. See `mocks/README.md`.
