# Context pack · FRD-26 · Services and account directory

> S0.3 output, 2026-10-21. The approved prototype is `docs/design/prototype/index.html` (Órbita, round 5, iteration 28); design intent and shared rules are in `docs/design/explorations/visual-refresh-2026/proposal.md`. Every later task for this FRD (S1.3 reconciliation, S1.4-26 copy, S2.1 builds, S2.2 amendments, S2.3-26 FDD) reads this pack, the files it owns and the files it cites, nothing else. Global rules live in `packs/_global.md`.

| Field | Value |
|---|---|
| FRD | `docs/frds/frd-26-services-accounts/frd.md` (id FRD-26, status ACTIVE, `ui: true`) |
| `visual_source` today | `(missing)` (stale or missing: S2.2 repoints it to the approved prototype and the FRD's shard in `mocks/`) |
| Config states | 1 under `states["frd-26-services-accounts"]` in `docs/design/freeze/fidelity.config.json` |
| AC coverage | 10 AC lines: 2 drawn · 1 partially drawn · 5 not drawn · 2 behaviour/data only (no picture needed) |
| Reproduce a state | `http://127.0.0.1:1988/index.html?demo=off&theme=light#<route>` then run the actions in order (widths 375 / 768 / 1280 unless the state lists its own). |

Status keys: **drawn** = a captured state shows the behaviour or the content; **partial** = some of it is drawn (the note says what is missing); **not drawn** = no captured state draws it (a Group B candidate for S1.3, or the owner removes it at M1); **behaviour only** = data, derivation, write or live behaviour with no picture to compare (the FDD may cite it without a state).

## 1. Acceptance criteria (verbatim) and what the prototype draws

Ids of the form `FRD-26#Uk` are the FRD's unnumbered EARS lines, k counted in file order; S2.2 pre-assigns real ids if a Group A line needs one. Lines the FRD itself marks superseded keep their place.

### AC-26-001 · not drawn · `accounts-project`

> - **AC-26-001** WHEN Portfolio opens, THEN it SHALL expose Projects and Accounts views independently of project selection, including an empty portfolio.

**Prototype:** Only the per-project "Cuentas" tab exists. The Portfolio does not expose Projects and Accounts views, and no Accounts view works without a selected project or with an empty portfolio.

### AC-26-002 · not drawn · `accounts-project`

> - **AC-26-002** WHEN views change or history is restored, THEN the selected project and unrelated URL state SHALL survive; Accounts SHALL use `portfolioView=accounts`, never an ambiguous project slug.

**Prototype:** `portfolioView=accounts` is not drawn; the project tab is `tab=Cuentas`.

### AC-26-003 · partial · `accounts-project`

> - **AC-26-003** WHEN accounts render, THEN each account SHALL show provider, type, purpose, organization, email or explicit unknown, dated identity/access status and a validated HTTPS dashboard link opening a new tab.

**Prototype:** Table "Servicios del proyecto": Servicio (name = link that opens the provider dashboard in a new tab, title "Abrir el panel de Cloudflare en una pestaña nueva", sr-only "(se abre en una pestaña nueva)"), Para qué, Usuario (click-to-copy email, aria-label "Copiar el usuario de Cloudflare: owner@example.com"), Entornos (dev / prod chips), Estado (Configurado / Propuesto / Inactivo). Type icon only; organization, dated identity/access status and "unknown email" wording are NOT drawn.

### AC-26-004 · not drawn · `accounts-project`

> - **AC-26-004** WHEN an account expands, THEN it SHALL show derived consumers, environment resources, dated plan/quota observations, automation evidence level, pending step and the public provider recipe.

**Prototype:** Rows do not expand: consumers, environment resources, dated plan/quota observations, automation evidence level, pending step and public provider recipe are NOT drawn.

### AC-26-005 · not drawn · `accounts-project`

> - **AC-26-005** WHEN the user searches or filters, THEN the directory SHALL search service/email/project and support active, pending, candidate and reference states; multiple identities of one provider SHALL remain separate.

**Prototype:** No search or filter (active / pending / candidate / reference) on the directory; one row per service.

### AC-26-006 · drawn · `accounts-project`

> - **AC-26-006** WHEN the project Accounts tab opens, THEN it SHALL show only that project's declared integration/account links and resources; it SHALL NOT infer account ownership from SDKs, variable names or an active browser session.

**Prototype:** Project Cuentas lists only that project's declared services (10 for Funko Tracker, ordered by status then name A-Z) with environments and no credentials.

### AC-26-007 · not drawn · `accounts-project`

> - **AC-26-007** WHEN a source is missing, malformed, duplicated or contains a dangling reference or production-as-dev resource, THEN the reader SHALL show an explicit bounded issue rather than silent empty success.

**Prototype:** No bounded issue states (missing, malformed, duplicated, dangling reference, production-as-dev) are drawn; the empty message "Este proyecto no tiene servicios asignados en el directorio de la fábrica." exists in code only.

### AC-26-008 · behaviour only · `accounts-project`

> - **AC-26-008** WHEN private files contain unknown fields or credential references, THEN only the reader's whitelisted non-secret DTO SHALL reach the browser; no raw YAML, exception text, passwords, tokens or credential references SHALL be rendered or logged.

**Prototype:** Whitelisted DTO: the capture carries login email and dashboard URL only, never credentials (fictional addresses in the fixture).

### AC-26-009 · behaviour only · `docs-page`

> - **AC-26-009** WHEN the Manual opens Services, THEN it SHALL derive recipes and sources from the public canonical catalog, link the private directory, and SHALL NOT read or publish account identities.

**Prototype:** The Manual's Services page ("Servicios, cuentas y secretos") is captured content; no state links the private directory.

### AC-26-010 · drawn · `accounts-project`

> - **AC-26-010** WHEN the page renders or filters, THEN it SHALL make no cloud API calls, write no registries, and remain usable by keyboard and on phones with the existing shell tokens and tab primitive.

**Prototype:** No cloud calls; keyboard-usable (links and copy buttons are focusable); below 1024 px each service becomes a card so the login never squeezes (iteration 26).

## 2. Screens and states (config → prototype selector)

| State id | Route | Actions | Capture | ACs it covers |
|---|---|---|---|---|
| `accounts-project` | `#portfolio?project=funko-tracker&tab=Cuentas` | (none) | full page | `AC-26-001` `AC-26-002` `AC-26-003` `AC-26-004` `AC-26-005` `AC-26-006` `AC-26-007` `AC-26-008` `AC-26-010` |

States cited above that belong to another FRD folder (captured there, reused here): `docs-page`.

**Not drawn (5)**: `AC-26-001`, `AC-26-002`, `AC-26-004`, `AC-26-005`, `AC-26-007`.

**Partially drawn (1)**: `AC-26-003`.

States this S0.3 pass ADDED to the config for this FRD (they render with the fixture; verified): none.

## 3. Copy: visible Spanish strings per state

Extracted from the rendered prototype at 1280 px, light theme (`?demo=off`). There is no i18n file yet, so there are no copy keys: the string is the key until S1.4 / the microcopy file assigns ids. Content that comes from the fixture data (project names, idea titles, document bodies, work-order titles) is filtered out; strings that mix interface text with fixture values are kept with their values. `[kind]` is the tag or attribute that carries the string (`@aria-label`, `@placeholder`, `@title`, `@data-tip` are accessible names and tooltips); `dlg` marks dialog content. Repeated patterns are collapsed (×N).

### `accounts-project`

- [@aria-label] Ruta
- [span] FT
- [span] 39/48 WO · 81%
- [@aria-label] Fase: Construcción
- [@data-tip] 1. Investigación · completada
- [span] Investigación: completada
- [@data-tip] 2. Producto · completada
- [span] Producto: completada
- [@data-tip] 3. Diseño · completada
- [span] Diseño: completada
- [@data-tip] 4. Arquitectura · completada
- [span] Arquitectura: completada
- [@data-tip] 5. Construcción · fase actual
- [span] Construcción: fase actual
- [@data-tip] 6. Lanzamiento · pendiente
- [span] Lanzamiento: pendiente
- [b] Cambiar proyecto
- [@aria-label] Ver secciones anteriores
- [@aria-label] Ver más secciones
- [@aria-label] Secciones de Funko Tracker
- [button[tab]] Spec
- [button[tab]] Observabilidad 48
- [button[tab]] Cuentas 10
- [button[tab]] Cambios 21
- [button[tab]] Documentos 82
- [p] Servicios externos del proyecto según el directorio de la fábrica: para qué sirve cada uno, con qué usuario entrar y en qué entornos tiene recursos. Clic en el nombre para abrir su panel y en el usuario para copiarlo. Las credenciales nunca se muestran.
- [@aria-label] Servicios del proyecto
- [th] Para qué
- [th] Entornos
- [@title] Abrir el panel de Cloudflare en una pestaña nueva
- [span] (se abre en una pestaña nueva)
- [@aria-label] Copiar el usuario de Cloudflare: owner@example.com
- [span] dev
- [span] prod
- [span] Configurado
- [@title] Abrir el panel de GitHub en una pestaña nueva
- [@aria-label] Copiar el usuario de GitHub: builds@example.com
- [@title] Abrir el panel de Neon en una pestaña nueva
- [b] Neon
- [@aria-label] Copiar el usuario de Neon: owner@example.com
- [@title] Abrir el panel de Railway en una pestaña nueva
- [@aria-label] Copiar el usuario de Railway: owner@example.com
- [@title] Abrir el panel de Resend en una pestaña nueva
- [@aria-label] Copiar el usuario de Resend: owner@example.com
- [@title] Abrir el panel de Sentry en una pestaña nueva
- [@aria-label] Copiar el usuario de Sentry: owner@example.com
- [@title] Abrir el panel de Vercel en una pestaña nueva
- [@aria-label] Copiar el usuario de Vercel: owner@example.com
- [@title] Abrir el panel de Upstash en una pestaña nueva
- [span] Propuesto
- [@title] Abrir el panel de PostHog en una pestaña nueva
- [@aria-label] Copiar el usuario de PostHog: owner@example.com
- [span] Inactivo

## 4. Mechanical copy mismatches (FRD quote vs prototype string)

- "Accounts" view | tab "Cuentas".
- "environment resources", "plan/quota observations" | none.
- Statuses active / pending / candidate / reference | "Configurado", "Propuesto", "Inactivo" (also "Activo", "Planificado", "Pendiente", "Candidato" in code).
- Intro text "Servicios externos del proyecto según el directorio de la fábrica: para qué sirve cada uno, con qué usuario entrar y en qué entornos tiene recursos. Clic en el nombre para abrir su panel y en el usuario para copiarlo. Las credenciales nunca se muestran." (not in the FRD).

## 5. FRD vs prototype conflicts and Group B seeds (for S1.3)

- The global directory (AC-26-001, -002, -004, -005, -007, -009) is the bulk of FRD-26 and is NOT drawn: the approved design keeps only the per-project tab. These are FRD wants without a counterpart (Group B) unless the owner narrows FRD-26 at M1 ("app features not drawn stay out of v2" applies to the six listed items; the global directory is NOT among them).
- Owner approved the complete services HTML proposal on 2026-10-20 (FRD-26 header); the prototype implements only the project slice of it.

## 6. Owner decisions that touch this FRD

**FRD-specific (decision log 2026-10-21 and `.pandacorp/comms/iteration.md`, round 5):**

- Iteration 7: Cuentas holds the project's services from the factory services directory (public fields only: provider, purpose, status, environments; never login emails, notes, resource ids or values).
- Iteration 19: Cuentas sits after Arquitectura; it shows the login user, copyable, where it used to show the plan; the service name opens its dashboard in a new tab; environment chips spaced and coloured. Like the app's Accounts view, the capture carries the login email and dashboard URL, never credentials.
- Iteration 22: no external-link or copy icons; the login is click-to-copy text with a light sweep and a "Copiar" hint on hover; rows ordered configured → proposed → inactive, then by name A-Z.
- Iteration 28: environments use one teal hue (green/amber/red stay status).
- Iteration 26: Cuentas becomes one card per row below 1024 px.

**Global (apply to every FRD):**

- 2026-10-21 scope decision 1: Mission Control targets desktop (1280), tablet (768) and phone (375); the small-screen gates apply from the v2 build.
- 2026-10-21 scope decision 2: the app features the prototype does not draw stay OUT of v2. The list is closed: Inicio digest with mark-seen, the board "recommended" badge, Campaña per-phase checklists, deploy target and objectives count in the Resumen, the skill workflow diagram, the creation affordances (new standard / rule / skill via /pandacorp:learn). Anything else the prototype lacks is a Group B item for the owner at M1.
- 2026-10-21 scope decision 3: artifact names stay English in the Spanish interface (FRD, PRD, ADR, work order, spec, backlog); decision 4: the e2e specs expecting 9 workspace tabs and `readDecisions` counting a RESOLVED PersonalPage v2 decision as pending are fixed in v2.
- 2026-10-21 interface language: everything Mission Control writes is Spanish; content it only shows (project documents, AI-generated files, skill and agent descriptions, rules, lessons, backlog items, model notes, FRD and work-order titles) keeps its source language, today English.
- 2026-10-21 shared component rules (iteration 28): one card header (tinted icon tile, display title of one size, count pill in the same colour), one section heading outside cards, small uppercase labels in Inter (monospace only for ids, code, commands and paths), green/amber/red mean status only, command boxes take the tint of their container, selected filter chips are neutral, "Mostrar más" is a full-width dashed bar, one search width, side-by-side cards end at the same height. See `_global.md`.
