---
id: FDD-15
type: fdd
slug: plugin-out-of-sync-warning
title: Plugin out-of-sync warning (banner and sidebar pill)
status: ACTIVE
parent: FRD-15
last_updated: '2026-10-22'
prototype_blessed_at: ''
---

# FDD — FRD-15 Plugin out-of-sync warning

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Feature design on the frozen Órbita contract (`docs/design/design-tokens.json` + root `DESIGN.md`). It uses the global tokens and components; it defines none. Frozen FROM the approved prototype `docs/design/prototype/index.html` (Órbita, round 5), shard `mocks/plugin-out-of-sync-warning.html`.

FRD-15 draws two coral pieces that appear together, only while the installed plugin version is strictly behind the source version: the **banner**, the first element of Inicio, and the **pill** in the sidebar. There is a single drift case. The dirty-plugin banner variant that earlier prototype rounds carried ("uncommitted changes in `plugin/`") is removed from the prototype by the owner's decision of 2026-10-22: uncommitted edits in `plugin/` never raise the banner or the pill.

## Screens

| Screen | Purpose | Oracle state | ACs |
|---|---|---|---|
| Plugin banner on Inicio | Tell the owner that the installed plugin is older than the repository's, give the command to copy and the two recovery steps. Route `#inicio`, root `.alert-banner`. | `plugin-banner` | AC-15-002.1, AC-15-004.1 |
| Sidebar pill "Plugin desactualizado" | Keep the warning visible on every screen from the sidebar and take the owner to the banner. The first of the sidebar's two pills, under the brand. | `plugin-banner` | AC-15-006.1 |

The banner, in `plugin-banner`, is a coral `role="alert"` block placed directly under the Inicio title block (the `h1` "Inicio" and its subtitle) and above "Tu turno":

- **Icon and heading:** the alert icon in a tinted tile and the `h2` "El plugin instalado está atrás".
- **Detail line:** "Tienes instalada la 9.140.0 y el repositorio ya va por la 9.141.0. Las skills que corras usan la versión vieja hasta que actualices." Both version numbers are bold; they come from the installed `version` and the source `version`.
- **Recovery steps line:** "1) Corre el comando · 2) Reinicia la sesión de Claude Code." (run the command, then restart the session).
- **Command block:** the `CommandBox` with `claude plugin update pandacorp@panda-corp` and its copy button, accessible name "Copiar claude plugin update pandacorp@panda-corp".

The pill is a coral chip with the alert icon and the text "Plugin desactualizado". Its `title` names both versions ("Instalado 9.140.0 · repositorio 9.141.0") and it links to Inicio, where the banner is. Pill and banner share one tone (coral) and one meaning: state by icon and text, never colour alone.

## States

| State | How it looks | Oracle state | ACs |
|---|---|---|---|
| Installed version behind the source (the only state that renders) | Banner and pill exactly as above. | `plugin-banner` | AC-15-002.1, AC-15-004.1, AC-15-006.1 |

The other verdicts render nothing, so there is no picture to specify:

- Installed equal to or newer than the source: no banner and no pill (AC-15-002.2).
- A missing or unparseable version (`unknown`): no banner and no pill, no false alarm (AC-15-002.3).
- Uncommitted edits in `plugin/`: neither piece appears.
- The banner and the pill disappear on their own on the next poll once the installed version catches up (REQ-15-004); the check only reads two JSON files, runs nothing, and never throws (REQ-15-005).
- Separate Claude and Codex verdicts are API fields; no component renders them separately. The single banner and pill fire when either runtime is behind (`drift` folds both).

## Components used

From `docs/design/components.md`: `AlertBanner` (the only coral banner, a consumer of `Notice`), `CommandBox` (command and copy button), `PluginPill` (sidebar pill, one coral tone), `Sidebar` and `AppShell` (FRD-19, the frame that hosts the pill), `PageHead` (the Inicio title block the banner sits under, FRD-18). Nothing new: the inventory already lists `AlertBanner` and `PluginPill`.

## Interaction & flow

1. The owner opens the app, sees the coral pill in the sidebar on whatever screen they are on, and the banner at the top of Inicio.
2. They press the copy button, paste `claude plugin update pandacorp@panda-corp` in a terminal and run it, then restart the Claude Code session (the two steps the banner lists).
3. Activating the pill goes to Inicio, where the banner is. Mission Control executes nothing; the owner runs the command.
4. On the next poll after the update, banner and pill are gone.

## Responsive & accessibility

- Captured at 375, 768 and 1280, light and dark. At 1280 the pill shows its text in the expanded sidebar; on the tablet icon rail the pill is reduced to its icon, and on phones it appears in the drawer (FRD-19).
- The banner has `role="alert"`, so it is announced when it mounts. The alert icon and the heading carry the meaning, not the coral colour. The command's copy button is a 36 px icon button, as in every `CommandBox`.
- The banner is the first content element after the page title, ahead of Tu turno, at every width.

## Copy

Strings are the prototype's, Spanish; the command, the file names and the version numbers stay literal. Keyed strings are in `docs/design/microcopy.es.json`.

## Fidelity references

Build against `docs/design/fidelity-checklist.md` (its `## Fidelity target` is the bar). Component catalogue `docs/design/prototype/components.html`; measured styles `docs/design/prototype/reference/computed-styles.json`; icons `docs/design/prototype/icons/`; copy `docs/design/microcopy.es.json`; whole-app prototype `docs/design/prototype/index.html`.

prototype_blessed_at: 409a0564

- **Mocks:** `docs/frds/frd-15-plugin-out-of-sync-warning/mocks/plugin-out-of-sync-warning.html` (section `plugin-banner`); screenshots in `mocks/screenshots/` as `plugin-banner-<width>-<theme>.jpg` at 375, 768 and 1280, light and dark. The sidebar pill is also captured in every FRD-19 shell state.
- **Binding comparison URL:** `docs/design/prototype/index.html?demo=off&host=page&theme=<theme>#inicio`.
- **Oracle entry (`fidelity.config.json`, `frd-15-plugin-out-of-sync-warning`):** `plugin-banner`.
- **Reference files:** `docs/design/freeze/packs/frd-15.md`, `docs/design/freeze/reconciliation.md` (A-58, P-09, B-37), `docs/design/freeze/m1-decisions.md`, root `DESIGN.md`.
- **components.md rows:** `AlertBanner`, `EmptyState`/`Notice`, `CommandBox`, `PluginPill`, `Sidebar`, `AppShell`.
