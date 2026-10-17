---
id: FRD-25
type: frd
title: Persistent navigation URLs
status: ACTIVE
ui: false
---
# FRD-25 — Persistent navigation URLs

This is a headless cross-cutting navigation contract over existing approved UI components; it introduces no new visual surface or design oracle. Existing feature FDDs remain the visual source. Implementation state is recorded in delivery evidence rather than executor-owned frontmatter fields.

Owner-approved 2026-10-17. This cross-cutting contract supersedes local-only selection and name-derived routing in FRDs02–08,10–13,17–19,22. The approved research inventory is [the route proposal](../../proposals/persistent-navigation-urls.md). Existing visual surfaces and the centered 1240px application frame remain approved.

## Acceptance criteria (EARS)

- **AC-25-001** — WHEN a user selects an idea/project, tab, document, Work Order, read-only reference/detail, campaign phase, model mode/entity/search, or supported list filter, THEN Mission Control SHALL encode that semantic location in the URL.
- **AC-25-002** — WHEN the user reloads, pastes a copied URL into a new session, or uses Back/Forward, THEN the application SHALL restore the addressed resource/tab/detail/filter without executing a mutation or build command.
- **AC-25-003** — WHEN a root page automatically chooses a project/tab/default Manual page, THEN the application SHALL replace the current history entry with the resolved explicit location; search typing SHALL replace rather than push each keystroke.
- **AC-25-004** — WHEN old query-based Portfolio or standalone project links are opened, THEN the compatibility resolver SHALL retain the selected project, tab, document/WO, filters and anchor while normalizing to the corresponding presentation context.
- **AC-25-005** — WHEN a project display name, card filename or folder changes and its dedicated identity reference is retained/reconciled, THEN the identity catalog SHALL retain its immutable ID and reserved public slug; an explicit public-slug rename SHALL preserve the previous slug as an alias.
- **AC-25-006** — WHEN a future idea/project is registered after the dashboard build, THEN the same dynamic route families SHALL resolve it without generating a new page or rebuilding Mission Control.
- **AC-25-007** — WHEN an explicit project/idea is unknown or a legacy alias is ambiguous, THEN the application SHALL show an unavailable/not-found result rather than choosing the first unrelated item.
- **AC-25-008** — WHEN a path/query has an unsupported tab/tail, repeated query values, excessive length, traversal, or an unknown document/detail, THEN routing SHALL reject it or display bounded unavailable content; document reads SHALL retain the existing scoped allowlist.
- **AC-25-009** — WHEN navigation occurs inside an embedded Portfolio workspace or a standalone project workspace, THEN every child/return link SHALL retain that context and identity, including a non-first project's WO Summary/Full, documents, Party and Changes.
- **AC-25-010** — WHEN a descendant route is active on phone/tablet/desktop, THEN the global destination highlight, shell exemption, integrated menu and keyboard behavior SHALL remain correct.
- **AC-25-011** — WHEN an expanded model URL is restored, THEN the viewport-filling dialog SHALL restore without requesting native fullscreen until a user gesture; hover, drag coordinates, transient loading/errors, unsaved forms and destructive confirmations SHALL remain ephemeral.
- **AC-25-012** — WHEN catalog registration is repeated or reads occur, THEN one explicit CLI writer SHALL allocate identities idempotently and atomically, GET reads SHALL never allocate/write identities, and an existing corrupt catalog SHALL fail loudly.

## Route and state contract

Paths use English fixed words, persisted readable resource slugs, and case-preserving encoded document/WO/reference keys. Queries carry namespaced view/filter state; anchors address document headings. Families: `/`, `/board/:idea/:tab`, `/portfolio/:project/:tab`, `/projects/:project/:tab`, `/proposals/:tab`, `/achievements/:tab`, `/manual/:group/:page` or `/manual/reference/:catalog/:item`, `/configuration/:section/:item`. WO tails contain ID and summary/full; document relative keys are encoded as one segment. Memory details use `/proposals/memory/:stream/:lesson`.

The single pure codec and [blueprint](blueprint.md) define concrete key spelling and compatibility. API/SSE keys remain existing filesystem project keys, explicitly separate from public navigation identity. The runtime never writes build state. [Delivery evidence](../../reviews/persistent-navigation-urls.md) records verification separately from historical work-order statuses.
