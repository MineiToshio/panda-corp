---
id: FDD-20
type: fdd
slug: overlay-freshness
title: FDD-20 — Overlay freshness notice (feature design)
status: ACTIVE
parent: FRD-20
last_updated: '2026-10-22'
prototype_blessed_at: '409a0564'
---

# FDD — FRD-20 Overlay freshness notice

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> This is the design of ONE notice on a project's Resumen, built on the frozen Órbita system (`DESIGN.md`, `docs/design/design-tokens.json`). It adds no token and no component: it is a toned `Notice` carrying a `CommandBox`. The captured state is the binding visual spec; the build reproduces it (DR-054).

## Screens

| Screen | Purpose | Captured state | ACs |
|---|---|---|---|
| Resumen of a project whose overlay is behind the factory's (PandaSaga) | Tell the owner, at the top of the project Resumen, that the project's Pandacorp engine is behind, and give the one command to run in the project folder | `overlay-behind` | AC-20-001.1, AC-20-002.1, AC-20-002.2, AC-20-004.1 |

What the screen draws, in reading order (route `#portfolio?project=pandasaga`, tab Resumen selected):

1. The project header and tab bar of the workspace (FRD-04's hero, stepper and tabs; not specified here).
2. **The upgrade notice**, the first block under the tab bar, above FRD-04's "Siguiente paso" line and its La Fragua scene:
   - an amber `Notice` (`data-tone="amber"`, accessible name "Actualización pendiente") with the alert triangle icon on the left (icon plus text, never colour alone);
   - a bold heading "Este proyecto usa una versión vieja del motor de Pandacorp";
   - one detail line naming both versions: "Va con la v8.98.0 y la fábrica ya está en la v8.110.0. Actualízalo para que el próximo build use las reglas y herramientas nuevas." (the two versions are data: the project's `overlay_version` and the factory's `OVERLAY_VERSION`);
   - the command block: a `CommandBox` with the terminal icon, the mono command `/pandacorp:upgrade` and a copy icon button named "Copiar /pandacorp:upgrade"; inside the amber notice it takes the notice's tint and a coloured prompt (iteration 28 rule);
   - under the command box, one small muted line naming where to run it: "Córrelo en la carpeta de PandaSaga" (the project name is data).
3. FRD-04's "Siguiente paso:" line with its own command, and FRD-04's La Fragua scene, below the notice.

## States

| State | What the owner sees | Captured state | ACs |
|---|---|---|---|
| Behind | The amber notice above, command copyable, folder line shown, nothing executed | `overlay-behind` | AC-20-001.1, AC-20-002.1, AC-20-002.2, AC-20-004.1 |

Behaviour with no picture of its own (a rule about what is NOT rendered, so there is nothing to draw): when the overlay is up to date (equal or newer, AC-20-001.2, out of v2 as a quiet badge) or either version is missing or unparseable (`unknown`, AC-20-001.3), the Resumen renders no notice and no placeholder; the first block under the tab bar is then FRD-04's "Siguiente paso:" line, as FRD-04's `project-summary-funko` state shows for a project that is up to date. The check reads two versions only and never throws (REQ-20-003).

## Components used

From `docs/design/components.md`:

| Component | Use in this feature |
|---|---|
| `EmptyState` / `Notice` | The amber upgrade notice (`.notice.upgrade`): icon, bold title, one `small` detail line; it wraps its two columns on narrow widths |
| `CommandBox` | The `/pandacorp:upgrade` command with its copy icon button; tinted by the toned container |
| `Tabs` | Context only (FRD-04's workspace tabs); the notice sits directly under the tab bar of the Resumen panel |

No new component. `VersionFreshness` in the blueprint is a consumer of `Notice` and `CommandBox`, not a second banner (DR-057). The coral `AlertBanner` of the plugin warning is a different surface (FRD-15) and is not reused here.

## Interaction & flow

1. The owner opens a project (Portafolio, a project card or the sidebar's Proyectos list). The Resumen verdict is computed on the server per render from the project's `overlay_version` and the factory's `OVERLAY_VERSION`.
2. If the project is strictly behind, the notice is the first block under the tabs. The owner presses the copy icon button, which copies the command (`data-copy`); the button's accessible name is "Copiar /pandacorp:upgrade".
3. The owner runs the command in the project folder named on the last line, outside Mission Control. The notice itself runs nothing (AC-20-002.2). After an upgrade the workspace reloads and the notice is gone.

## Responsive & accessibility

- Desktop (1280): the notice is one row inside its container: icon, text column, then the command column (the command box is at most 560 px wide). The notice is a wrapping flex row: when the row is too narrow (phone, and tablet if needed) the command column drops below the text column, each at least 260 px wide, so nothing scrolls sideways (screenshots at 375, 768 and 1280).
- Touch targets: the copy icon button is 36 px inside a 44 px command box.
- The notice is a labelled region (accessible name "Actualización pendiente"); the state is carried by the icon and the words, not by the amber tint alone.
- Contrast: amber text and tint follow the frozen tokens in both themes; the notice is captured in light and dark.
- The command code wraps only at the colon and spaces, so `/pandacorp:upgrade` stays readable on a phone.

## Copy

The Spanish strings of this feature are keyed in `docs/design/microcopy.es.json` (copywriter) and in `docs/design/freeze/copy/frd-20.md`. The overlay is called "el motor de Pandacorp" in the interface (owner request 2026-06-26); the technical word "overlay" stays in code and docs.

## Fidelity references

Build against `docs/design/fidelity-checklist.md` (its `## Fidelity target` is the bar, its *How to verify* the gate).

prototype_blessed_at: 409a0564

- **Mocks:** `docs/frds/frd-20-overlay-freshness/mocks/overlay-freshness.html` (state `overlay-behind`).
- **Mock screenshots:** `docs/frds/frd-20-overlay-freshness/mocks/screenshots/overlay-behind-{375,768,1280}-{light,dark}.jpg`.
- **Binding comparison URL:** `docs/design/prototype/index.html?demo=off&host=page&theme=<theme>#portfolio?project=pandasaga`.
- **Oracle table:** `docs/design/prototype/reference/oracle-states.json`, entry `overlay-behind` of `frd-20-overlay-freshness`.
- **Reference files:** `docs/design/prototype/reference/computed-styles.json`, `docs/design/prototype/components.html`, root `DESIGN.md`, `docs/design/design-tokens.json`. Styles to match: `.notice`, `.notice.upgrade`, `.pa-cmd`, `.cmd` in `docs/design/prototype/base.css` and `prototype.css`.
- **components.md rows:** `EmptyState` / `Notice`, `CommandBox`, `Tabs` (context).
