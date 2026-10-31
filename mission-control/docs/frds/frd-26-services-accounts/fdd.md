---
id: FDD-26
type: fdd
slug: services-accounts
title: FDD-26 — Services and account directory (feature design)
status: ACTIVE
parent: FRD-26
last_updated: '2026-10-22'
prototype_blessed_at: '409a0564'
---

# FDD — FRD-26 Services and account directory

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Two read-only views of the same table on the frozen Órbita system (`DESIGN.md`, `docs/design/design-tokens.json`): the Cuentas tab of one project, and the factory-wide directory as the third view of Portafolio. No credential is ever shown. The captured states are the binding visual spec (DR-054); the project header and tab bar belong to FRD-04, the Portafolio page header and its other views to FRD-03.

## Screens

| Screen | Purpose | Captured state | ACs |
|---|---|---|---|
| Cuentas tab of a project (Funko Tracker) | The external services this project declares: what each is for, which login to use, in which environments it has resources, and its status | `accounts-project` | AC-26-003.1, AC-26-006.1, AC-26-011.1, AC-26-010.1 |
| Portafolio, third view "Cuentas" | The factory's accounts in one place, with the projects that use each, searchable and filterable by state | `portfolio-accounts` | AC-26-001.1, AC-26-003.1, AC-26-005.1, AC-26-010.1 |
| Directory filtered by state | The same view reduced to one state: Pendientes | `portfolio-accounts-filter` | AC-26-005.1 |
| Account dialog | One account in detail: identity and access, recorded plan, automation level, linked projects with environment resources, the reuse recipe and the dashboard link | `portfolio-accounts-dialog` | AC-26-004.1 |
| Directory with an invalid source | The registry problems named and bounded; the rest of the directory stays usable | `accounts-source-error` | AC-26-007.1, AC-26-008.1 |

### The project tab (`accounts-project`)

Route `#portfolio?project=funko-tracker&tab=Cuentas`. FRD-04's crumbs, compact hero and tab bar come first; the tab "Cuentas" is selected and carries a count badge (10 in the capture). The panel:

- an intro line, small muted: "Servicios externos del proyecto según el directorio de la fábrica: para qué sirve cada uno, con qué usuario entrar y en qué entornos tiene recursos. Clic en el nombre para abrir su panel y en el usuario para copiarlo. Las credenciales nunca se muestran.";
- one table in a region named "Servicios del proyecto", columns **Servicio**, **Para qué**, **Usuario**, **Entornos**, **Estado**:
  - Servicio: the provider name in bold, a link to its dashboard that opens in a new tab (title "Abrir el panel de Cloudflare en una pestaña nueva", with a visually hidden "(se abre en una pestaña nueva)");
  - Para qué: the provider's purpose, muted, in its source language;
  - Usuario: the login as a mono small text button that copies it on click (accessible name "Copiar el usuario de Cloudflare: owner@example.com"; a "Copiar" hint appears above it on hover and on focus; the credentials are never shown);
  - Entornos: one chip per environment in the same teal hue ("dev", "prod", "preview"), the resource name in the chip's title;
  - Estado: a dot plus the word "Configurado" (green), "Propuesto" (amber) or "Inactivo" (slate);
  - a cell with no value shows a faint dash, never a blank (Upstash has no login and no environment; PostHog has no environment).
- Order as captured: the "Configurado" services first and A to Z (Cloudflare twice, GitHub, Neon, Railway, Resend, Sentry, Vercel), then "Propuesto" (Upstash), then "Inactivo" (PostHog).

### The global view (`portfolio-accounts`)

Route `#portfolio?view=cuentas` (the prototype route; the build's URL contract is `view=cuentas` too, with `portfolioView=accounts` accepted as an alias, AC-26-002.1). Page header (FRD-03's slot): `h1` "Portafolio" and its subtitle. Then, in a vertical stack:

1. A toolbar with the segmented control named "Vista del portafolio": "Tarjetas", "Lista" (FRD-03's views) and "Cuentas" (selected, neutral), and at the right the faint small label "Directorio de cuentas de la fábrica".
2. An intro paragraph: "Las cuentas de la fábrica en un solo lugar: qué servicio es, con qué usuario entrar y qué proyectos lo usan. Clic en el nombre para abrir su panel y en el usuario para copiarlo. Lo guardado son observaciones con fecha, no una sesión activa; las credenciales nunca se muestran."
3. A toolbar with the search field (placeholder "Buscar servicio, correo o proyecto…", accessible name "Buscar servicio, correo o proyecto"), the group "Filtrar cuentas" of filter chips with counts: "Todas" 10 (selected), "Activas" 7, "Pendientes" 1, "Candidatos" 2, "Referencia" 0, and on the right the count "10 cuentas".
4. The table in a region named "Cuentas de la fábrica", columns **Servicio**, **Para qué**, **Usuario**, **Proyectos**, **Estado** and a last column that has no visible heading (screen-reader name "Detalle") holding a ghost button "Detalles" per row (accessible name "Detalles: Railway · cuenta principal"). Servicio, Para qué and Usuario work as in the project tab; **Proyectos** lists the projects that use the account as neutral chips ("Funko Tracker", "PandaCast"...); **Estado** is a dot plus "Activa" (green), "Candidato" (slate) or "Pendiente" (amber). An account with no known login shows the faint text "Cuenta pendiente de identificar" in Usuario.

### The account dialog (`portfolio-accounts-dialog`)

Captured at the viewport at 375 and 1280, opened from the "Detalles" button of the Railway row. Head: kicker "Cuenta · Railway", title "Railway · cuenta principal", close button "Cerrar". Body, top to bottom:

- the state "Activa" (dot plus word) and a plain chip "Opcional";
- a label and value list: "Finalidad", "Correo" (the email as a copy button, accessible name "Copiar owner@example.com"), "Identidad y acceso" ("Identidad observada · 19 oct. 2026", a dated observation), "Plan registrado" ("Free (observado el 19/10/2026)"), "Automatización" ("Documentada, sin prueba registrada") and "Acepta proyectos nuevos" ("Sí");
- "Proyectos vinculados": one line per project with its name in bold, its state in the project ("· Configurado", "· Propuesto") and the environment resources as teal chips ("prod · funko-worker");
- "Cómo reutilizarlo": the provider's public recipe, a paragraph and a numbered list of steps, in its source language;
- a button "Abrir el panel de Railway" that opens the dashboard in a new tab.

### The invalid-source notice (`accounts-source-error`)

Same screen as `portfolio-accounts`, with a coral `Notice` (`role="alert"`) between the intro paragraph and the search toolbar: the bold title "Información incompleta o inválida", then one line per problem with the file in `code` and the reason ("services/accounts.yaml: el registro no cumple el contrato."; "projects/pandacast/.pandacorp/accounts/services.yaml: apunta a una cuenta que no existe."), and the small muted line "Se revisa sin mostrar datos sensibles. El resto del directorio sí se pudo leer." The toolbar and the full table follow unchanged; the notice names files and reasons only, never a value, a raw error or a credential reference (AC-26-008.1).

## States

| State | What the owner sees | Captured state | ACs |
|---|---|---|---|
| Project tab with services | The table above, ordered "Configurado", "Propuesto", "Inactivo", then A to Z | `accounts-project` | AC-26-011.1, AC-26-003.1 |
| Services without a value | A faint dash in Usuario or Entornos | `accounts-project` | AC-26-003.1 |
| Directory, all accounts | Search, chips with counts and the full table | `portfolio-accounts` | AC-26-001.1, AC-26-005.1 |
| Account without a known login | The faint text "Cuenta pendiente de identificar" in Usuario, state "Candidato" | `portfolio-accounts` | AC-26-003.1 |
| Filter active | "Pendientes" pressed, the count reads "1 cuenta", one row | `portfolio-accounts-filter` | AC-26-005.1 |
| Account open | The dialog above | `portfolio-accounts-dialog` | AC-26-004.1 |
| Source problems | The coral notice naming each problem; the table still lists every account that was read | `accounts-source-error` | AC-26-007.1 |

Behaviour with no picture of its own (rules about data, structure or what is not rendered): the Cuentas view works independently of the selected project and with an empty portfolio (AC-26-001.1); the view and filters survive navigation and history through the URL, using `portfolioView=accounts` and never an ambiguous project slug (AC-26-002.1); the reader passes only a whitelisted non-secret DTO to the browser and logs nothing sensitive (AC-26-008.1); Documentación derives its Services page from the public catalog without reading identities (AC-26-009.1); no cloud API call and no registry write happens on render or filter (AC-26-010.1); a project's tab never infers ownership from SDKs, variable names or a browser session (AC-26-006.1).

## Components used

From `docs/design/components.md`:

| Component | Use in this feature |
|---|---|
| `AccountsTable` | The one table of both views: service name opens the dashboard in a new tab, login is click-to-copy, environment chips in one teal hue, status; one card per row below 1024 px; reused by the global view |
| `Segmented` | The Portafolio view switch "Tarjetas / Lista / Cuentas" (neutral selected state) |
| `SearchField` | The directory search (one search width) |
| `Chip` family / `FilterChip` | The state filter chips with counts, the environment chips (teal), the project chips (plain), the "Opcional" chip |
| `StateDot` | "Configurado", "Propuesto", "Inactivo", "Activa", "Candidato", "Pendiente": a dot plus the word |
| `Dialog` | The account dialog, with its label and value list |
| `EmptyState` / `Notice` | The coral invalid-source notice (`role="alert"`) |
| `Tabs` | The project's Cuentas tab with its count badge (FRD-04) |
| `PageHead` | The Portafolio title block (FRD-03) |

No new component.

## Interaction & flow

1. From a project, the owner opens the Cuentas tab, clicks a service name to open its dashboard in a new tab, or clicks a login to copy it.
2. From Portafolio, the owner picks "Cuentas" in the view switch; the project selection and any unrelated URL state survive the switch (AC-26-002.1). The owner searches by service, email or project, narrows with a state chip, and opens "Detalles" on a row.
3. In the dialog the owner reads the dated observations, copies the email, follows the reuse recipe, or opens the provider dashboard. Closing the dialog returns focus to the "Detalles" button that opened it.
4. When a source is invalid, the notice appears above the toolbar and the rest of the directory stays usable.

## Responsive & accessibility

- Captured at 375, 768 and 1280 in light and dark; the dialog also at the viewport at 375 and 1280.
- Below 1024 px the table is one card per row: the name and the state on the first line, then labelled lines for the user and the environments; the table heads are hidden (`.acc-table`).
- Both tables sit in named regions; the dashboard links announce that they open in a new tab; the copy buttons carry the provider and the login in their name; the empty last heading is screen-reader text.
- State is a dot plus a word, never colour alone; the invalid-source notice is `role="alert"` and says what failed in words, with the coral tint as reinforcement only.
- Search, chips and the segmented control are keyboard-operable; the dialog is native (focus in, Escape closes, focus back to its trigger).

## Copy

Keyed Spanish strings: `docs/design/microcopy.es.json`; reconciliation notes in `docs/design/freeze/copy/frd-26.md`. Provider purposes, recipe text and steps come from the public catalog and keep their source language (English today); the interface labels are Spanish. The state labels follow the captured views: "Configurado", "Propuesto", "Inactivo" in the project tab and "Activa", "Pendiente", "Candidato", "Referencia" in the directory; a state never prints its raw key (AC-26-005.1).

## Fidelity references

Build against `docs/design/fidelity-checklist.md` (its `## Fidelity target` is the bar, its *How to verify* the gate).

prototype_blessed_at: 409a0564

- **Mocks:** `docs/frds/frd-26-services-accounts/mocks/services-accounts.html` (states `accounts-project`, `portfolio-accounts`, `portfolio-accounts-filter`, `portfolio-accounts-dialog`, `accounts-source-error`).
- **Mock screenshots:** `docs/frds/frd-26-services-accounts/mocks/screenshots/<id>-<width>-<theme>.jpg` (28 files).
- **Binding comparison URLs:** `docs/design/prototype/index.html?demo=off&host=page&theme=<theme>#portfolio?project=funko-tracker&tab=Cuentas` and `...#portfolio?view=cuentas`; the invalid-source state applies the fixture scenario `accounts-source-error`.
- **Oracle table:** `docs/design/prototype/reference/oracle-states.json`, the five entries of `frd-26-services-accounts`.
- **Reference files:** `docs/design/prototype/reference/computed-styles.json`, `docs/design/prototype/components.html`, root `DESIGN.md`, `docs/design/design-tokens.json`. Styles to match: `.acc-table`, `.acc-name`, `.copy-text`, `.env-chips`, `.state-dot`, `.seg`, `.acc-links` in `docs/design/prototype/prototype.css`.
- **components.md rows:** `AccountsTable`, `Segmented`, `SearchField`, `Chip`, `StateDot`, `Dialog`, `EmptyState` / `Notice`, `Tabs`, `PageHead`.

## Structural fidelity correction (2026-10-31)

Below 1024 px each account is a two-column row card: service and state share the first line; remaining account metadata spans both columns, with explicit labels for identity, login and environments/projects. Existing required identity/access fields remain present. Oracle: `prototype.css:1391-1400` and AC-26-003.1.

Component tests and static checks are recorded in the decision log. Browser fidelity, themes and overflow still require the attended Claude reviewer; no visual baseline was edited.

## Visual close-out (2026-10-31)

Below the phone breakpoint the global account directory keeps compact service, purpose, login, project and state rows. Provider type, organization and dated access identity remain available in Detalles, avoiding three extra metadata blocks in each compact row. Desktop columns and project account views retain their full table presentation.

## Independent review corrections (2026-10-31)

The shared table scroll wrapper establishes a relative positioning context. Its visually hidden final header stays clipped inside the wrapper instead of extending the global account page beyond the viewport.
