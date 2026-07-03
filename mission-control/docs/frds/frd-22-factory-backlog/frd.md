---
id: FRD-22
type: frd
title: FRD-22 — Factory backlog surface (Propuestas · Backlog tab)
status: ACTIVE
implementation_status: PLANNED
ui: true
visual_source: docs/design/prototype/index.html
last_updated: '2026-07-03'
---
# FRD-22 — Factory backlog surface (Propuestas · Backlog tab)

Surfaces the factory's **actionable work queue** — `factory/backlog/BL-*` (DR-103, the plane-3 counterpart of the plane-1 self-learning memory) — inside Mission Control, so closeable defects/changes to the factory's own tooling do not stay invisible and get forgotten. It shares the **Propuestas** page with the memory self-learning streams (FRD-17) because both are "proposals to change the factory": the two are split into two in-page sub-tabs (**Memoria** | **Backlog**) using the one shared `Tabs` primitive (DR-062). Read-only, no Claude — consistent with the platform golden rule (FRD-01).

## Acceptance criteria (EARS)

### REQ-22-001 — Read and group the backlog
- **AC-22-001.1** — Mission Control SHALL read every `factory/backlog/BL-*.md` item (skipping `README.md` and `_item-template.md`) into a typed model (`id`, `type` bug|change, `area`, `title`, `status` open|doing|done|discarded, `severity`, `source`, `closes`, `links`, `opened`, `closed`).
- **AC-22-001.2** — The Backlog panel SHALL group items by `status`; **Abiertos** (open) and **En curso** (doing) render by default, in that order, each a section with its count, its items ordered by priority then id (see REQ-22-008). **Hechos** (done) and **Descartados** (discarded) do NOT render by default — see REQ-22-006, REQ-22-007. An empty backlog SHALL show an explicit empty state.
- **AC-22-001.3** — Each item SHALL render as a card visually consistent with the memory ProposalCard (DR-062): mono `id`, a `type · area` chip, a severity chip (text + tone, never colour alone), the title, and an evidence line (`source` + `links`).

### REQ-22-002 — In-page sub-tabs (Memoria | Backlog)
- **AC-22-002.1** — The Propuestas page SHALL present two sub-tabs, **Memoria** and **Backlog**, using the shared `Tabs`/`SubTabs` primitive (DR-062) — no bespoke switcher.
- **AC-22-002.2** — **Memoria** SHALL be active by default and SHALL contain the existing self-learning surface (memory-health panel + the four proposal streams + the promotions queue, FRD-17), unchanged.
- **AC-22-002.3** — The **Backlog** tab SHALL show a count badge of `open` items when greater than zero.
- **AC-22-002.4** — Both panels SHALL stay mounted (toggled with `hidden`) so the memory streams' local dismiss state survives a tab switch, and SHALL carry `data-volatile` (DR-088) so the visual baseline masks their live, length-varying data.

### REQ-22-003 — Read-mostly, how-to-work note
- **AC-22-003.1** — The Backlog panel SHALL show a short note explaining these are actionable items worked by asking an agent (e.g. «implementa BL-0007»), and that Mission Control only displays and (per REQ-22-007) lets the owner discard them — it never creates, closes or edits the content of a `factory/backlog/` item (consistent with the FRD-17 read-only boundary, minus the one bounded discard write).

### REQ-22-004 — Fail-loud read boundary (DR-078)
- **AC-22-004.1** — The backlog reader SHALL distinguish "the backlog is empty" from "an item could not be interpreted": a malformed `BL-*.md` (unparseable YAML, missing a required field, or an out-of-range enum) SHALL be surfaced in an `errors` collection, never silently dropped. A missing `factory/backlog/` directory is a legitimately-empty backlog, not an error.
- **AC-22-004.2** — WHEN the reader reports one or more errors, the Backlog panel SHALL render an error banner (`role="alert"`) naming the offending file(s) and reason(s), while still rendering the items it could parse.
- **AC-22-004.3** — **Duplicate ids are a data-integrity defect, surfaced fail-loud (BL-0013).** WHEN two different `BL-*.md` files declare the same `id`, the reader SHALL keep only the first occurrence in `items` (so the panel never renders duplicate React keys or a misleading second copy) and surface each subsequent collision in `errors[]` (`duplicate id <ID> (already defined in <first-file>)`). The invariant "the rendered backlog has unique ids" is enforced at the read boundary, not assumed. Added 2026-07-01 after a real collision (two files reusing BL-0010/BL-0011) intermittently red-locked the /proposals smoke gate with a duplicate-key console error.

### REQ-22-005 — Item detail (click a card → formatted detail)
- **AC-22-005.1** — Each backlog card SHALL be an accessible control (a `<button>`, keyboard-operable, with an `aria-label` naming the item) that opens a **detail modal** for that item. The detail opens in the shared `Modal` primitive (focus-trapped, Escape-closes, backdrop-click-closes) — never an inline expand (the app's modal-for-detail rule).
- **AC-22-005.2** — The backlog reader SHALL expose each item's markdown **body** (everything after the frontmatter), and the detail SHALL render it as **titled, colour-coded sections** via the shared `SectionedMarkdown` primitive — each `## Heading` (Problem / Root cause / Fix plan / Tests / Done when / Out of scope) becomes a real section header (icon + coloured label) with its content rendered as markdown (lists, code, tables), NOT one wall of text or a raw string. This is the same `SectionedMarkdown` primitive the memory-lesson detail uses (it auto-detects `## Heading` vs `**Label:**` sections), so both detail modals share one look (DR-062).
- **AC-22-005.3** — The detail SHALL show the item's metadata (id as the title, a `type` badge, and `type·area` / severity / status chips + source / links / dates) above the rendered body. Read-only: the detail has no write/close-item affordance (working an item is done by an agent, AC per Non-goals).

### REQ-22-006 — Default-hidden Hechos (opt-in reveal)
- **AC-22-006.1** — GIVEN the backlog has any `done` items, a "Ver hechos (N)" toggle button SHALL render below the always-visible groups, naming the hidden count; the toggle SHALL be omitted entirely when there are zero `done` items.
- **AC-22-006.2** — Clicking the toggle SHALL reveal the **Hechos** section (same card list as the other groups); the button label SHALL flip to "Ocultar hechos (N)". Clicking it again SHALL hide the section and flip the label back.
- **AC-22-006.3** — This mirrors the same default-hide pattern used by the project-level Cambios tab (Mission Control FRD-04, REQ-04-009) — so the closed-item history of neither queue clutters its actionable view as it accumulates over months.

### REQ-22-007 — Discard a backlog item (bounded write)
- **AC-22-007.1** — WHEN a backlog item is `open` or `doing`, its detail modal SHALL offer a **"Descartar"** action (inline confirm, no nested modal) that rewrites `status: discarded` (ADR-0002 pattern) and closes the modal on success; never offered for `done` or already-`discarded` items.
- **AC-22-007.2** — Confirming SHALL call the `discardBacklogItem` write, which rewrites `status: discarded` and records `status_before_discard` (the prior value), preserving the body and every other frontmatter field verbatim (the same bounded-write pattern as `discardIdea`/`discardChange`) — never touching any sibling file.
- **AC-22-007.3** — A discarded item moves out of the default Abiertos/En curso view into a new **Descartados** group, hidden by default behind its own "Ver descartados (N)" toggle — the same default-hide mechanism as REQ-22-006, mirroring the project-level Cambios tab (FRD-04, REQ-04-008/009).

### REQ-22-008 — Priority ordering (severity, then id)
- **AC-22-008.1** — WITHIN each status group, items SHALL be ordered by `severity` first (P0 before P1 before P2), then by `id` ascending; an item with no `severity` SHALL sort after all severities. This is an invariant of the reader (`readBacklog`), not a per-view sort — every consumer of the read result sees the same order.

### REQ-22-009 — Ready-to-copy `implement-backlog` commands
- **AC-22-009.1** — WHEN the backlog has at least one `open`/`doing` item, the Backlog panel SHALL render a `CmdRow` below the list with the generic command `/pandacorp:implement-backlog` (no id) — the same copy-to-clipboard affordance used elsewhere in Mission Control (never executed by the app itself, FRD-01's golden rule). Omitted entirely when there are zero actionable items.
- **AC-22-009.2** — An `open`/`doing` item's detail modal SHALL render a `CmdRow` with the item's own targeted command, `/pandacorp:implement-backlog <id>`; a `done` or `discarded` item never shows it (the same actionable set REQ-22-007 uses for the discard action).

## Non-goals
- Beyond the one bounded discard write (REQ-22-007), Mission Control does NOT create, edit or close `factory/backlog/` items, and never executes a skill itself (FRD-01's golden rule) — REQ-22-009's commands are copy-to-clipboard text, run by the owner (or an agent they invoke) outside this UI.
- No Claude calls — the surface is derived purely from the on-disk `BL-*` files (FRD-01).
- The memory-tab cleanup (deduping the promotions surfaces, the dismiss-button redesign, the count/dismissal reconciliation, dead-code removal) is a **separate** follow-up (tracked; not part of this FRD).

## Relationship
Shares the Propuestas route with [FRD-17](../frd-17-proposals-inbox/frd.md) (the memory self-learning inbox) — the two are the Memoria and Backlog sub-tabs of one page. Uses the `Tabs` primitive from FRD-13 (DR-062). The backlog store and its routing rule are factory-level doctrine (DR-103); this FRD is only the read-only Mission Control surface over it.
