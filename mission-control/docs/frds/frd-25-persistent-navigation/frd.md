---
id: FRD-25
type: frd
title: Persistent navigation URLs
status: ACTIVE
implementation_status: VERIFIED
ui: false
floor: false
---
# FRD-25 — Persistent navigation URLs

This is a headless cross-cutting navigation contract over existing approved UI components; it introduces no new visual surface or design oracle. Existing feature FDDs remain the visual source. Implementation state follows the v2 work orders in `work-orders/` (their `implementation_status`, rolled up in this frontmatter); `work-orders.md` keeps the v1 delivery evidence.

Owner-approved 2026-10-17. This cross-cutting contract supersedes local-only selection and name-derived routing in FRDs02–08,10–13,17–19,22. The approved research inventory is [the route proposal](../../proposals/persistent-navigation-urls.md). Existing visual surfaces remain approved, inside the centered 1180px content frame of the v2 shell (FRD-19; amended 2026-10-22, v2 plan, replacing the earlier 1240px frame).

## Acceptance criteria (EARS)

- **AC-25-001.1** — (renamed from "AC-25-001", amended 2026-10-22, v2 plan) WHEN a user selects an idea/project, tab, document, Work Order, read-only reference/detail, campaign phase, model mode/entity/search, or supported list filter, THEN Mission Control SHALL encode that semantic location in the URL.
- **AC-25-002.1** — (renamed from "AC-25-002", amended 2026-10-22, v2 plan) WHEN the user reloads, pastes a copied URL into a new session, or uses Back/Forward, THEN the application SHALL restore the addressed resource/tab/detail/filter without executing a mutation or build command.
- **AC-25-003.1** — (renamed from "AC-25-003", amended 2026-10-22, v2 plan) WHEN a root page automatically chooses a project/tab/default Manual page, THEN the application SHALL replace the current history entry with the resolved explicit location; search typing SHALL replace rather than push each keystroke.
- **AC-25-004.1** — (renamed from "AC-25-004", amended 2026-10-22, v2 plan) WHEN old query-based Portfolio or standalone project links are opened, THEN the compatibility resolver SHALL retain the selected project, tab, document/WO, filters and anchor while normalizing to the corresponding presentation context.
- **AC-25-005.1** — (renamed from "AC-25-005", amended 2026-10-22, v2 plan) WHEN a project display name, card filename or folder changes and its dedicated identity reference is retained/reconciled, THEN the identity catalog SHALL retain its immutable ID and reserved public slug; an explicit public-slug rename SHALL preserve the previous slug as an alias.
- **AC-25-006.1** — (renamed from "AC-25-006", amended 2026-10-22, v2 plan) WHEN a future idea/project is registered after the dashboard build, THEN the same dynamic route families SHALL resolve it without generating a new page or rebuilding Mission Control.
- **AC-25-007.1** — (renamed from "AC-25-007", amended 2026-10-22, v2 plan) WHEN an explicit project/idea is unknown or a legacy alias is ambiguous, THEN the application SHALL show an unavailable/not-found result rather than choosing the first unrelated item.
- **AC-25-008.1** — (renamed from "AC-25-008", amended 2026-10-22, v2 plan) WHEN a path/query has an unsupported tab/tail, repeated query values, excessive length, traversal, or an unknown document/detail, THEN routing SHALL reject it or display bounded unavailable content; document reads SHALL retain the existing scoped allowlist.
- **AC-25-009.1** — (renamed from "AC-25-009", amended 2026-10-22, v2 plan: no Party tab in v2) WHEN navigation occurs inside an embedded Portfolio workspace or a standalone project workspace, THEN every child/return link SHALL retain that context and identity, including a non-first project's WO Summary/Full, documents and Changes.
- **AC-25-010.1** — (renamed from "AC-25-010", amended 2026-10-22, v2 plan: no shell exemption in v2) WHEN a descendant route is active on phone/tablet/desktop, THEN the global destination highlight (a project workspace keeps Portafolio active), the sidebar navigation (tablet rail, phone drawer) and keyboard behavior SHALL remain correct, and no route SHALL be exempt from the shell.
- **AC-25-011.1** — (renamed from "AC-25-011", amended 2026-10-22, v2 plan: no viewport-filling dialog in v2) WHEN an expanded model URL is restored, THEN the inline model viewer SHALL be restored without requesting native fullscreen until a user gesture; hover, drag coordinates, transient loading/errors, unsaved forms and destructive confirmations SHALL remain ephemeral.
- **AC-25-012.1** — (renamed from "AC-25-012", amended 2026-10-22, v2 plan) WHEN catalog registration is repeated or reads occur, THEN one explicit CLI writer SHALL allocate identities idempotently and atomically, GET reads SHALL never allocate/write identities, and an existing corrupt catalog SHALL fail loudly.

## Route and state contract

Paths use English fixed words, persisted readable resource slugs, and case-preserving encoded document/WO/reference keys. Queries carry namespaced view/filter state; anchors address document headings. Families: `/`, `/board/:idea/:tab`, `/portfolio/:project/:tab`, `/projects/:project/:tab`, `/proposals/:tab`, `/achievements/:tab`, `/manual/:group/:page` or `/manual/reference/:catalog/:item`, `/configuration/:section/:item`. WO tails contain ID and summary/full; document relative keys are encoded as one segment. Memory details use `/proposals/memory/:stream/:lesson`.

**v2 families (amended 2026-10-22, v2 plan).** The codec ships every v2 key up front:
- Project workspace `/:surface/:project/:tab` (surface `portfolio` or `projects`) with the eight tabs `summary · spec · observability · architecture · accounts · changes · documents · commands`. The legacy aliases `party` → `summary` and `work-orders` → `observability` (and the existing alias families) resolve to them; there is no Party or separate Work orders tab.
- Observabilidad: `view=(frd|tablero|deps)`, `frd`, `state`, `wo`, `woview`, `dag=(frd|wo)` and `focus` (the dependency map's work-order focus).
- Portafolio: `view=(tarjetas|lista|cuentas)`; `portfolioView=accounts` is an accepted legacy alias of `view=cuentas` (FRD-26 AC-26-002.1).
- Idea page `/board/:idea/:tab` with tabs `proposal · spec · architecture · documents · campaign` plus `phase` (the Campaña phase).
- Data model: `model=(Diagrama|Esquema)` plus the selected entity and the search text.
- Propuestas `/proposals/:tab` with tabs `resumen · memory · backlog` (plus lesson, stream and item details).
- Logros `/achievements/:tab` with tabs `summary · missions · trophies · statistics · ranks`.
- Configuración `/configuration/:section/:item` with sections `skills · agents · rules · standards`.
- Documentación `/manual/:group/:page`.
- Search typing replaces history, and no URL write ever runs a mutation (AC-25-002.1, AC-25-003.1).

The single pure codec and [blueprint](blueprint.md) define concrete key spelling and compatibility. API/SSE keys remain existing filesystem project keys, explicitly separate from public navigation identity. The runtime never writes build state. [Delivery evidence](../../reviews/persistent-navigation-urls.md) records verification separately from historical work-order statuses.
