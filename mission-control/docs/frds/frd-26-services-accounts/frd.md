---
id: FRD-26
type: frd
title: Services and account directory
status: ACTIVE
implementation_status: PLANNED
ui: true
visual_source: docs/design/prototype/index.html
visual_source_mocks: docs/frds/frd-26-services-accounts/mocks/services-accounts.html
last_updated: '2026-10-22'
---
# FRD-26 — Services and account directory

Owner approved the complete services reuse HTML proposal on 2026-10-20. This read-only local feature implements its registry, architecture, new-provider and Documentación contracts; it never provisions resources or changes external accounts. GitHub remains a factory-wide standard outside this catalog.

> **Design freeze amendment (2026-10-22, S2.2).** The approved Órbita prototype draws the per-project Cuentas tab. The owner decided at M1 (2026-10-22) to DRAW the global directory as the third Portafolio view, "Cuentas", beside "Tarjetas" and "Lista" (state `portfolio-accounts`), reusing the Cuentas table plus a search, a state filter and a row dialog; the unreadable-source state is drawn too (`accounts-source-error`). The interface labels are Spanish ("Cuentas"). Source: `docs/design/freeze/reconciliation.md` (A-79, B-45, B-53).

## Acceptance criteria (EARS)

- **AC-26-001.1** — (renamed from "AC-26-001", amended 2026-10-22, v2 plan) WHEN the Portafolio opens, THEN it SHALL expose the views Tarjetas, Lista and Cuentas (FRD-03 REQ-03-009), the Cuentas view working independently of project selection, including an empty portfolio.
- **AC-26-002.1** — (renamed from "AC-26-002", amended 2026-10-22, v2 plan) WHEN views change or history is restored, THEN the selected project and unrelated URL state SHALL survive; the Cuentas view SHALL use the URL key `view=cuentas` (the key of the captured prototype, `/portfolio?view=cuentas`), never an ambiguous project slug; WHEN a legacy link carries `portfolioView=accounts`, THEN the application SHALL accept it as an alias and normalize it to `view=cuentas`.
- **AC-26-003.1** — (renamed from "AC-26-003", amended 2026-10-22, v2 plan) WHEN accounts render, THEN each account row SHALL show provider (the service name, a link to its dashboard), type, purpose, organization, email or explicit unknown, a dated identity/access status and a validated HTTPS dashboard link opening a new tab.
- **AC-26-004.1** — (renamed from "AC-26-004", amended 2026-10-22, v2 plan) WHEN an account row is activated, THEN a dialog SHALL show derived consumers, environment resources, dated plan/quota observations, automation evidence level, pending step and the public provider recipe.
- **AC-26-005.1** — (renamed from "AC-26-005", amended 2026-10-22, v2 plan) WHEN the user searches or filters, THEN the directory SHALL search service/email/project and offer a state filter over the states active, pending, candidate and reference, with the filter chips "Activas", "Pendientes", "Candidatos" and "Referencia" (plus "Todas") and the row labels "Activa", "Pendiente", "Candidato" and "Referencia", as captured in the prototype directory view (a state SHALL never print its raw key); the per-project Cuentas tab keeps its own labels "Configurado", "Propuesto" and "Inactivo" (AC-26-011.1); multiple identities of one provider SHALL remain separate.
- **AC-26-006.1** — (renamed from "AC-26-006", amended 2026-10-22, v2 plan) WHEN the project Cuentas tab opens, THEN it SHALL show only that project's declared integration/account links and resources; it SHALL NOT infer account ownership from SDKs, variable names or an active browser session.
- **AC-26-007.1** — (renamed from "AC-26-007", amended 2026-10-22, v2 plan) WHEN a source is missing, malformed, duplicated or contains a dangling reference or production-as-dev resource, THEN the reader SHALL show an explicit bounded issue rather than silent empty success, in the project Cuentas tab and in the global Cuentas view (state `accounts-source-error`, M1 2026-10-22).
- **AC-26-008.1** — (renamed from "AC-26-008", amended 2026-10-22, v2 plan) WHEN private files contain unknown fields or credential references, THEN only the reader's whitelisted non-secret DTO SHALL reach the browser; no raw YAML, exception text, passwords, tokens or credential references SHALL be rendered or logged.
- **AC-26-009.1** — (renamed from "AC-26-009", amended 2026-10-22, v2 plan) WHEN the Documentación opens Services, THEN it SHALL derive recipes and sources from the public canonical catalog, link the private directory, and SHALL NOT read or publish account identities.
- **AC-26-010.1** — (renamed from "AC-26-010", amended 2026-10-22, v2 plan) WHEN the page renders or filters, THEN it SHALL make no cloud API calls, write no registries, and remain usable by keyboard and on phones with the existing shell tokens and tab primitive.
- **AC-26-011.1** WHEN the project Cuentas tab lists services, THEN it SHALL order them by status (configurado, then propuesto, then inactivo) and then A to Z, SHALL open each service's dashboard in a new tab from its name, SHALL copy the login on click (the text "Copiar" as the hint, the credentials never shown), SHALL show the environments as chips in one teal hue, and SHALL render one card per row below 1024 px.

**Worked example (AC-26-011.1).** A project has services Resend (propuesto), Neon (configurado) and Sentry (configurado). The table lists Neon, Sentry, Resend: configurado first, A to Z inside each status. Clicking "Neon" opens its panel in a new tab; clicking the login copies it and shows the hint "Copiar". At 768 px each row becomes a card.

## Edge cases
- A service with no known login or no environments → the empty cell shows the no-value marker, never a blank that reads as loading (AC-26-003.1).
- The services file is malformed or has a dangling reference → the bounded issue of AC-26-007.1; the rest of the page stays usable.
- No projects at all → the Cuentas view still opens (AC-26-001.1).
- A legacy `portfolioView=accounts` link → accepted and normalized to `view=cuentas` (AC-26-002.1).

## Sources and ownership

Public catalog: `factory/services/catalog.yaml`. Private identities and optional trusted project pointers: vault `services/accounts.yaml`. Per-project atomic links: `.pandacorp/accounts/services.yaml`. Consumer lists are derived at read time; there is no second maintained list. Observations are historical facts with dates, not fresh verification or proof of current production configuration. See [blueprint](blueprint.md), [delivery scope](work-orders.md), and [ADR](../../adr/ADR-0011-services-account-directory.md).
