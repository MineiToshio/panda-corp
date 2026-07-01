---
id: FRD-22
type: frd
title: FRD-22 — Factory backlog surface (Propuestas · Backlog tab)
status: ACTIVE
implementation_status: VERIFIED
ui: true
visual_source: docs/design/prototype/index.html
last_updated: '2026-07-01'
---
# FRD-22 — Factory backlog surface (Propuestas · Backlog tab)

Surfaces the factory's **actionable work queue** — `factory/backlog/BL-*` (DR-103, the plane-3 counterpart of the plane-1 self-learning memory) — inside Mission Control, so closeable defects/changes to the factory's own tooling do not stay invisible and get forgotten. It shares the **Propuestas** page with the memory self-learning streams (FRD-17) because both are "proposals to change the factory": the two are split into two in-page sub-tabs (**Memoria** | **Backlog**) using the one shared `Tabs` primitive (DR-062). Read-only, no Claude — consistent with the platform golden rule (FRD-01).

## Acceptance criteria (EARS)

### REQ-22-001 — Read and group the backlog
- **AC-22-001.1** — Mission Control SHALL read every `factory/backlog/BL-*.md` item (skipping `README.md` and `_item-template.md`) into a typed model (`id`, `type` bug|change, `area`, `title`, `status` open|doing|done, `severity`, `source`, `closes`, `links`, `opened`, `closed`).
- **AC-22-001.2** — The Backlog panel SHALL group items by `status` in the order **Abiertos** (open) → **En curso** (doing) → **Hechos** (done), rendering a section per non-empty group with its count; an empty backlog SHALL show an explicit empty state.
- **AC-22-001.3** — Each item SHALL render as a card visually consistent with the memory ProposalCard (DR-062): mono `id`, a `type · area` chip, a severity chip (text + tone, never colour alone), the title, and an evidence line (`source` + `links`).

### REQ-22-002 — In-page sub-tabs (Memoria | Backlog)
- **AC-22-002.1** — The Propuestas page SHALL present two sub-tabs, **Memoria** and **Backlog**, using the shared `Tabs`/`SubTabs` primitive (DR-062) — no bespoke switcher.
- **AC-22-002.2** — **Memoria** SHALL be active by default and SHALL contain the existing self-learning surface (memory-health panel + the four proposal streams + the promotions queue, FRD-17), unchanged.
- **AC-22-002.3** — The **Backlog** tab SHALL show a count badge of `open` items when greater than zero.
- **AC-22-002.4** — Both panels SHALL stay mounted (toggled with `hidden`) so the memory streams' local dismiss state survives a tab switch, and SHALL carry `data-volatile` (DR-088) so the visual baseline masks their live, length-varying data.

### REQ-22-003 — Read-only, how-to-work note
- **AC-22-003.1** — The Backlog panel SHALL show a short read-only note explaining these are actionable items worked by asking an agent (e.g. «implementa BL-0007»), and that Mission Control only displays them — it never edits `factory/backlog/` (consistent with the FRD-17 read-only boundary).

### REQ-22-004 — Fail-loud read boundary (DR-078)
- **AC-22-004.1** — The backlog reader SHALL distinguish "the backlog is empty" from "an item could not be interpreted": a malformed `BL-*.md` (unparseable YAML, missing a required field, or an out-of-range enum) SHALL be surfaced in an `errors` collection, never silently dropped. A missing `factory/backlog/` directory is a legitimately-empty backlog, not an error.
- **AC-22-004.2** — WHEN the reader reports one or more errors, the Backlog panel SHALL render an error banner (`role="alert"`) naming the offending file(s) and reason(s), while still rendering the items it could parse.

### REQ-22-005 — Item detail (click a card → formatted detail)
- **AC-22-005.1** — Each backlog card SHALL be an accessible control (a `<button>`, keyboard-operable, with an `aria-label` naming the item) that opens a **detail modal** for that item. The detail opens in the shared `Modal` primitive (focus-trapped, Escape-closes, backdrop-click-closes) — never an inline expand (the app's modal-for-detail rule).
- **AC-22-005.2** — The backlog reader SHALL expose each item's markdown **body** (everything after the frontmatter), and the detail SHALL render it as **titled, colour-coded sections** via the shared `SectionedMarkdown` primitive — each `## Heading` (Problem / Root cause / Fix plan / Tests / Done when / Out of scope) becomes a real section header (icon + coloured label) with its content rendered as markdown (lists, code, tables), NOT one wall of text or a raw string. This is the same `SectionedMarkdown` primitive the memory-lesson detail uses (it auto-detects `## Heading` vs `**Label:**` sections), so both detail modals share one look (DR-062).
- **AC-22-005.3** — The detail SHALL show the item's metadata (id as the title, a `type` badge, and `type·area` / severity / status chips + source / links / dates) above the rendered body. Read-only: the detail has no write/close-item affordance (working an item is done by an agent, AC per Non-goals).

## Non-goals
- Mission Control does NOT write to `factory/backlog/`, create/close/edit items, or run any skill (read-only, like FRD-17). Working an item is done by an agent, outside this UI.
- No Claude calls — the surface is derived purely from the on-disk `BL-*` files (FRD-01).
- The memory-tab cleanup (deduping the promotions surfaces, the dismiss-button redesign, the count/dismissal reconciliation, dead-code removal) is a **separate** follow-up (tracked; not part of this FRD).

## Relationship
Shares the Propuestas route with [FRD-17](../frd-17-proposals-inbox/frd.md) (the memory self-learning inbox) — the two are the Memoria and Backlog sub-tabs of one page. Uses the `Tabs` primitive from FRD-13 (DR-062). The backlog store and its routing rule are factory-level doctrine (DR-103); this FRD is only the read-only Mission Control surface over it.
