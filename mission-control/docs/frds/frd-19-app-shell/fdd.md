---
id: FDD-19
type: fdd
slug: app-shell
title: Global app shell (persistent sidebar navigation)
status: ACTIVE
parent: FRD-19
last_updated: '2026-10-22'
prototype_blessed_at: ''
---

# FDD — FRD-19 Global app shell

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Feature design on the frozen Órbita contract (`docs/design/design-tokens.json` + root `DESIGN.md`). It uses the global tokens and components; it defines none. Frozen FROM the approved prototype `docs/design/prototype/index.html` (Órbita, round 5, iteration 28), shard `mocks/app-shell.html`.

The shell is the persistent frame every screen mounts into. It belongs to no single surface: the foundation build constructs it first and `app/layout.tsx` mounts it once, so no route renders without it. It is the landmark `aside#sidebar` (accessible name "Navegación principal") plus, on phones, a sticky top bar and a bottom navigation. All six captured states render the shell around Inicio (and, in `shell-pending-chip`, around Tablero); the page content in the frame belongs to FRD-18 and FRD-02 and is not specified here.

## Screens

| Screen | Purpose | Oracle state | ACs |
|---|---|---|---|
| Shell, expanded (desktop, tablet rail and phone) | The default frame: brand, pills, the seven destinations with counts, Proyectos, guild card and collapse control; at 768 the icon rail; at 375 the top bar and bottom navigation. Route `#inicio`. | `shell-expanded` | AC-19-001.1, AC-19-001.2, AC-19-001.3, AC-19-002.1, AC-19-003.1, AC-19-003.2, AC-19-003.3, AC-19-003.5, AC-19-004.1, AC-19-005.1, AC-19-005.2, AC-19-005.4 |
| Shell, collapsed rail | The 64 px icon rail the owner chooses on desktop. | `shell-rail-collapsed` | AC-19-005.3 |
| Shell, collapsed rail floating open | The rail opened over the page on pointer or focus, without moving the content. | `shell-rail-float` | AC-19-005.3 |
| Shell, projects folded | The Proyectos group folded to its header. | `shell-projects-folded` | AC-19-005.1 |
| Shell, phone drawer open | The sidebar as an off-canvas drawer over a scrim. | `shell-drawer-open` | AC-19-003.3, AC-19-003.4 |
| Shell on another screen, with the pending-merge pill | The shell on Tablero with its alert pills, to show that it is the same frame on every route and that exactly one destination is active. Route `#tablero`. | `shell-pending-chip` | AC-19-001.1, AC-19-001.3, AC-19-002.1 |

**The sidebar** (`shell-expanded` at 1280, 252 px, on the second background level, sticky, full height), top to bottom:

- **Brand:** the logo tile and "Pandacorp" over "MISSION CONTROL" in small caps; one link, accessible name "Pandacorp Mission Control: ir a Inicio".
- **Pills:** two full-width pills with the alert icon. "Plugin desactualizado" (FRD-15, title "Instalado 9.140.0 · repositorio 9.141.0") and "17 pendientes · depurar ya" (FRD-21, alert variant; its title says 17 branches are not integrated into main and points to "Árboles de trabajo" on Inicio). Each links to Inicio and renders only when it applies; the pending pill is hidden when nothing is pending.
- **Destinations** (`nav` "Secciones"), each a link with a tinted icon, the label and, where it has one, a count: "Inicio" 6 (amber alert variant, accessible name "6 asuntos esperan tu decisión"), "Tablero" 10, "Portafolio", "Propuestas" 4 (accessible name "4 cosas esperan tu decisión"), "Logros", "Documentación", "Configuración". The current one has `aria-current="page"`, a raised surface and a bolder label; exactly one is active at a time. Counts show what needs attention: the owner's items on Inicio, ideas on Tablero, the owner's actions on Propuestas (AC-19-005.2).
- **Proyectos group:** the header "PROYECTOS" with the count 5 and a chevron (a toggle with title "Ordenados por último cambio"), then up to five project rows by last change: an initials avatar in the project's phase hue, the name and "Construcción · 81%" (phase and percentage), each row with the full accessible name "Funko Tracker: Construcción · 81% de work orders verificadas". When there are more than five, a link to the rest follows the list. The group remembers in this browser whether it is folded (AC-19-005.1).
- **Guild card:** the level crest (22), "Portador de Luz III", "175 / 200 XP al nivel 23" and the gold progress bar; a link to Logros (FRD-09).
- **Collapse control** at the bottom: "Colapsar" with an icon, accessible name "Colapsar la barra lateral".
- **Theme button** in the same footer row (`.theme-btn`, AC-19-005.5): a sun or moon icon (sun in the dark theme, moon in the light), accessible name «Cambiar a tema claro» or «Cambiar a tema oscuro»; icon-only in the sidebar and the rail, a labelled row inside the phone drawer. It starts from the system preference and remembers the owner's choice.

**Tablet (768)** in `shell-expanded`: the same sidebar as a 76 px icon rail. Destinations show their icon over a mini label ("Inicio", "Tablero", "Portafolio", "Propuestas", "Logros", "Docs", "Ajustes"); the two pills shrink to their alert icon; projects show only their avatars; the guild card shows only its crest; Inicio carries an amber dot when it has owner items. No collapse control.

**Phone (375)** in `shell-expanded`: no sidebar column. A sticky top bar holds the menu button (accessible name "Abrir menú", `aria-expanded`, `aria-controls="sidebar"`), the logo and the page name over "Mission Control". A sticky bottom navigation holds five items: "Inicio", "Tablero", "Portafolio", "Docs" and "Más" (a button that opens the drawer).

## States

| State | How it looks | Oracle state | ACs |
|---|---|---|---|
| Expanded sidebar (≥ 1180 px) | As above, with the content in a frame of at most 1180 px and 40 px gutters. | `shell-expanded` | AC-19-003.1, AC-19-003.5 |
| Icon rail (760 to 1179 px) | 76 px rail, mini labels, icon-only pills, avatars, crest. | `shell-expanded` | AC-19-003.2 |
| Top bar and bottom navigation (≤ 759 px) | Sticky top bar and bottom navigation; the sidebar is off-canvas. | `shell-expanded` | AC-19-003.3 |
| Collapsed by the owner | A 64 px rail with only icons: brand logo, the two pills as alert icons, the destination icons (Inicio with its amber dot while it has owner items), a hairline in place of the Proyectos header, project avatars, the guild crest, and the control now reading "Fijar abierta" (accessible name "Fijar abierta la barra lateral"). The content keeps its position. The choice is remembered in this browser. | `shell-rail-collapsed` | AC-19-005.3 |
| Collapsed rail floating open | On pointer or focus the full sidebar (labels, pills, projects, guild card, "Fijar abierta") floats over the page with a soft shadow; the content underneath does not move. Moving away closes it. | `shell-rail-float` | AC-19-005.3 |
| Projects folded | The Proyectos header becomes a rounded pill with the count 5 and a right-pointing chevron; the project rows are hidden; everything else is unchanged. | `shell-projects-folded` | AC-19-005.1 |
| Phone drawer open | The sidebar slides in from the left, `min(300px, 86vw)` wide, over a dim scrim, with every destination, the pills, the Proyectos group and the guild card; the bottom navigation stays visible under the scrim. While closed the drawer is inert. | `shell-drawer-open` | AC-19-003.3, AC-19-003.4 |
| Another route, alert pills | On Tablero the same sidebar shows "Tablero" as the only active destination, and both coral pills. | `shell-pending-chip` | AC-19-001.1, AC-19-002.1, AC-19-001.3 |

Behaviour with no separate picture:

- The drawer closes on Escape (focus returns to its opener), on a pointer press outside it, on activating any destination (including the current route) and on a route change (AC-19-003.4).
- An unmatched route (for example not-found) marks no destination active; the project workspace keeps Portafolio active (AC-19-002.2).
- Navigation is client-side (`next/link`), not a full reload (AC-19-001.4). The first focusable element of the page is a keyboard skip link that moves focus to `main#content` in place, without routing (AC-19-001.5); it shows only on focus.
- The onboarding gate (FRD-01), when the factory profile is absent, is the entire view and the shell does not render behind it. Propuestas keeps its place with no count when nothing waits for the owner.
- The prototype footer text and capture stamp under the content are prototype-only and are not product copy; the build omits them.

## Nav contract

Recorded from the prototype markup for the Shell-Presence Gate (`e2e/shell.ts`); the same list is in `docs/design/components.md` under "AppShell nav contract".

- Landmark: `aside#sidebar`. No route is exempt from the shell.
- Destinations, in order (label, app path, prototype hash): Inicio `/` `#inicio`; Tablero `/board` `#tablero`; Portafolio `/portfolio` `#portfolio`; Propuestas `/proposals` `#propuestas`; Logros `/achievements` `#logros`; Documentación `/manual` `#documentacion`; Configuración `/configuration` `#configuracion`.
- Phone: drawer toggled by `#menu`, closed by Escape; bottom navigation Inicio, Tablero, Portafolio, Docs, Más.

## Components used

From `docs/design/components.md`: `AppShell`, `Sidebar`, `Nav`, `NavItem`, `ProjectNavItem`, `GuildCard`, `PluginPill`, `PendingPill`, `TopBar`, `BottomNav`, `SkipLink`, `Footer` (prototype text only, omitted by the build). All are already inventoried; nothing new. `PendingPill` is drawn by `shell-pending-chip`.

## Interaction & flow

1. Whatever screen the owner is on, every destination is one click away in the sidebar (rail, or drawer on phones), and the pills keep the two global warnings visible.
2. On desktop the owner can press "Colapsar" to get the 64 px rail; hovering or focusing the rail floats it open, "Fijar abierta" pins it open again. The choice survives a reload.
3. On a phone, the menu button or "Más" opens the drawer; choosing a destination closes it.
4. The owner can fold the Proyectos group; that choice is remembered too.

## Responsive & accessibility

- Breakpoints from FRD-19: ≥ 1180 px expanded sidebar, 760 to 1179 px icon rail, ≤ 759 px top bar, bottom navigation and drawer. Captured at 375, 768 and 1280, light and dark; the collapsed, floating and folded states at 1280, the drawer at 375, the pending-pill state at 768 and 1280.
- Every link has a target of at least 44 px by design on phones and the tablet rail (24 px is only the gated floor). The current destination is carried by `aria-current` and a bolder label, not colour alone; counts have full accessible names; pills carry the alert icon and text. Icon-only elements on the rails keep their accessible names.
- Focus is never hidden under the sticky top bar. While the drawer is closed it is `inert`; open, focus moves in and Escape restores it to the opener.

## Copy

Strings are the prototype's, Spanish; keyed strings are in `docs/design/microcopy.es.json`. The short rail and bottom-navigation label for Documentación is "Docs" and for Configuración "Ajustes".

## Fidelity references

Build against `docs/design/fidelity-checklist.md` (its `## Fidelity target` is the bar). Component catalogue `docs/design/prototype/components.html`; measured styles `docs/design/prototype/reference/computed-styles.json`; icons and logo `docs/design/prototype/{icons,logo}/`; copy `docs/design/microcopy.es.json`; whole-app prototype `docs/design/prototype/index.html`.

prototype_blessed_at: 409a0564

- **Mocks:** `docs/frds/frd-19-app-shell/mocks/app-shell.html` (sections `shell-expanded`, `shell-rail-collapsed`, `shell-rail-float`, `shell-projects-folded`, `shell-drawer-open`, `shell-pending-chip`); screenshots in `mocks/screenshots/` as `<id>-<width>-<theme>.jpg` (`shell-expanded` at 375, 768 and 1280; `shell-rail-collapsed`, `shell-rail-float` and `shell-projects-folded` at 1280; `shell-drawer-open` at 375; `shell-pending-chip` at 768 and 1280), light and dark.
- **Binding comparison URL:** `docs/design/prototype/index.html?demo=off&host=page&theme=<theme>#inicio` (`#tablero` for the pending pill state); actions per state in `fidelity.config.json`.
- **Oracle entries (`fidelity.config.json`, `frd-19-app-shell`):** `shell-expanded`, `shell-rail-collapsed`, `shell-rail-float`, `shell-projects-folded`, `shell-drawer-open`, `shell-pending-chip`.
- **Reference files:** `docs/design/freeze/packs/frd-19.md`, `docs/design/freeze/packs/_global.md`, `docs/design/freeze/reconciliation.md` (C-01), `docs/design/freeze/m1-decisions.md`, root `DESIGN.md`.
- **components.md rows:** `AppShell`, `Nav`, `Sidebar`, `NavItem`, `ProjectNavItem`, `GuildCard`, `PluginPill`, `PendingPill`, `TopBar`, `BottomNav`, `SkipLink`, `Footer`, and the section "AppShell nav contract".

## Visual close-out (2026-10-31)

When a project workspace is active, its sidebar row uses aria-current="page" and the same raised treatment as the navigation. On phones the top bar shows the canonical project name over the active workspace tab, following URL and browser history. The deferred identity slot shares the sidebar project resolver and does not delay the shell. Propuestas continues to use the shared owner-actions badge count; it is not a count of backlog rows.

## Independent review corrections (2026-10-31)

Partial proposal source errors do not suppress the authoritative badgeCount. The same projectDisplayName helper strips a descriptive subtitle introduced by whitespace plus an em dash, en dash, colon or opening parenthesis before generating initials, sidebar text and phone identity. Unknown workspace tabs use the localized missing-section title, never a raw URL identifier.
