---
id: FRD-02
type: frd
title: FRD-02 — Ideas board
parent: product/prd.md
status: ACTIVE
implementation_status: PLANNED
ui: true
visual_source: docs/frds/frd-02-ideas-board/mocks/la-campana.html
last_updated: '2026-06-19'
---
# FRD-02 — Ideas board

Read-only kanban of the idea base, with idea capture, a navigable detail and discard.

## Acceptance criteria (EARS)
- The board SHALL place each idea into one of the columns `discovered → documented → design → architecture → building → shipped` (plus a `discarded` column) by **deriving the column from two axes** (the card `status` and, once handed off, the project `phase` — see FRD-01), NOT from the card `status` alone:
  - card `status: discovered` or `recommended` (not handed off yet) → **discovered** column (a `recommended` card SHALL show a "recommended" badge).
  - card `status: in-pipeline` → the column comes from the linked project's `.pandacorp/status.yaml` **phase**: `product`→documented, `design`→design, `architecture`→architecture, `implementation`/`release`→building, `operation`→shipped.
  - card `status: shipped` → **shipped** column; card `status: discarded` → **discarded** column.
  - The board SHALL NOT expect `design`/`architecture`/`building` to ever appear as a card `status` (those columns only come from the project phase). IF an `in-pipeline` card's project or `status.yaml` is missing, THEN it SHALL fall back to the **documented** column without breaking.
- The board SHALL NOT allow moving cards by hand (drag or arrows): the transitions are written by the skills. The columns SHALL have the same width, be **wide** (not tiny) and have **horizontal scroll** when they don't fit; the text SHALL wrap onto several lines if it doesn't fit.
- WHEN the owner clicks "Capture ideas / oportunidades", the system SHALL open a **modal overlay** (dark backdrop + blur) with the four intake commands — `/pandacorp:explore`, `:new-idea`, `:discover` and `:recommend` — each with an icon, title, description and copy-command row. Clicking the backdrop or the ✕ button SHALL close the modal. The board SHALL remain visible behind the modal as context.
- WHEN the owner clicks a card, the system SHALL show the card: summary, key points, a navigator of the idea's documents, and the next-step command (with a copy button).
- EACH card SHALL show two labels besides the score: **category** (`project_type`: web, mobile, desktop, ai, claude-code, prompt-system, automation, cli, rework…) and **return** (`return_type`: monetary, opportunity, personal or mixed). The board SHALL allow **filtering by category**.
- WHILE an idea's project has `running: true` (build in progress, phase `implementation` → "building" column), the system SHALL show an indicator on its card that it is being built.
- WHEN the owner presses "Discard idea", the system SHALL rewrite `status: discarded` in the `.md` frontmatter, preserving the rest of the file (Pandacorp's only write).

## Card detail — "La Campaña" + tabbed restructure (extension, 2026-06-18)

> Visual contract: `prototype/party-pipeline.html` (La Campaña) embedded in `prototype/index.html`
> (the board card detail). See `prototype/party-redesign-spec.md` §4 (La Campaña), §5 (placement),
> §2 (the real engine phase model). These REQs **extend** the card detail of REQ-02-004; they do not
> change the board derivation, intake, filter or discard behavior.

### REQ-02-009 — Three-tab card detail (Campaña · Documentos · Comandos)

- AC-02-009.1 — WHEN the owner opens a card, THE system SHALL render the card detail with **three
  horizontal tabs** — **Campaña · Documentos · Comandos** — using the **same tab pattern** as the
  Portfolio project pane (the `stab` selector row), and SHALL default the active tab to **Campaña**.
- AC-02-009.2 — WHEN the owner clicks a tab, THE system SHALL show that tab's body and mark only that
  tab active; **Documentos** SHALL render the existing document navigator (summary + key points +
  the idea's docs, unchanged behavior of REQ-02-004) and **Comandos** SHALL render the existing
  next-step / iterate command panel (unchanged behavior of REQ-02-004).
- AC-02-009.3 — WHEN the owner clicks a document entry (in any tab context that exposes a document),
  THE system SHALL switch the active tab to **Documentos** and show that document, so a document
  click always lands the owner on **Documentos**.
- AC-02-009.4 — THE system SHALL **persist the active tab choice** for the open card across
  re-renders of the card detail (the tab selection survives interactions that re-render the detail
  without navigating away from the card).

### REQ-02-010 — "La Campaña" pipeline (the Campaña tab)

- AC-02-010.1 — WHEN the **Campaña** tab is active, THE system SHALL render **La Campaña**: the
  **6-phase pipeline** in fixed order `research → product → design → architecture → build → release`,
  each phase shown as a room, wrapped in a labelled container ("EL VIAJE DE ESTA IDEA POR LAS 6
  FASES").
- AC-02-010.2 — THE system SHALL **derive the ACTIVE phase from the project's real status** (the card
  `status` / linked project `status.yaml` phase) with the mapping `discovered→research`,
  `documented→product`, `design→design`, `architecture→architecture`, `building→build`,
  `shipped→release`; IF the status is absent or unrecognized THEN the active phase SHALL default to
  **research** (index 0) without breaking.
- AC-02-010.3 — THE system SHALL render each phase by its position relative to the active phase:
  phases **before** the active one as **done** (showing their delivered deliverable), the active one
  as **current** (glowing), and phases **after** it as **locked**.
- AC-02-010.4 — WHEN the owner clicks a phase, THE system SHALL show that phase's **ficha**: a
  description, what it **reads** (LEE — the deliverable from the previous phase) and **writes**
  (ESCRIBE — the deliverable for the next phase), and the **whole team** of that phase — every
  specialist with its role and what it does (not only the lead). The teams SHALL be: research =
  `researcher`; product = `product-manager`; design = `designer` + `copywriter`; architecture =
  `architect`; build = `implementer` + `reviewer` + `analytics`; release = `security-auditor` +
  `devops`. The deliverable chain (LEE→ESCRIBE) SHALL be `research.md → PRD/FRDs (EARS) →
  mockups + design tokens + components.md (microcopy) → blueprint + ADRs + Build Plan + work orders →
  código → audit + deploy`.
- AC-02-010.8 — THE fichas SHALL reflect the **current factory**: the **Design** ficha SHALL state
  that design uses **Claude Design** and produces **`components.md`** + **mocks** + design tokens (and
  microcopy via `copywriter`); the **Architecture** ficha SHALL state that it **plans the foundation
  (shared primitives) and the file artifacts** of each work order (plus the blueprint, ADRs and Build
  Plan); and the **Build** ficha SHALL reflect the **v2 build flow** — foundation-first, disjoint
  waves serialized by file artifact, per-WO fidelity loop, the 4-lens + visual-judge gate and the
  Option-B wave commit (consistent with FRD-06 / La Fragua).
- AC-02-010.5 — WHEN the owner activates the **Construcción** (build) phase's "Entrar a La Fragua"
  action, THE system SHALL **navigate the host app** to Portfolio → that project → the **Party** tab
  (FRD-06 / La Fragua) for that project, WITHOUT an inner iframe reload of the card detail.
- AC-02-010.6 — THE Campaña view SHALL be **read-only**: it SHALL NOT call Claude, write any file, or
  trigger any build; the only "communication" it depicts between phases is the deliverable document
  travelling to the next phase (artifact across time).
- AC-02-010.7 — IF a phase has no deliverable to show because it is locked (a future phase), THEN the
  system SHALL render a graceful **locked/empty state** for that phase (no document, locked marker)
  without breaking the view.

## Edge cases
- Idea with no documents → show only the summary (Documentos tab).
- Category (web/mobile/desktop/AI/…), return (monetary/opportunity/personal/mixed) and score are shown with a legend explaining them.
- An `in-pipeline` card whose project / `status.yaml` is missing or malformed → La Campaña active phase falls back to **research** (index 0) and the view still renders (AC-02-010.2).
- A `discovered` card (no project yet) → La Campaña active phase = **research**; the future phases are all locked (AC-02-010.3 / AC-02-010.7).
- A `shipped` card → La Campaña active phase = **release**; the build phase's "Entrar a La Fragua" still navigates to the project's Party tab (AC-02-010.5).
- Clicking the build phase's "Entrar a La Fragua" while the card detail is embedded must not reload the embed; it hands off to the host (AC-02-010.5).

## Does NOT include
- No live agent chat or simulation backed by real-time events in La Campaña — it is a faithful, read-only depiction of the per-phase team and the document hand-off across time (the live build animation belongs to FRD-06 / La Fragua, fed by `~/.claude/dashboard-events.ndjson`).
- No new write: the three-tab restructure and La Campaña add **zero** mutations; the single write in the app remains discard (REQ-02-007).
- No mode selector / pause / reset controls in La Campaña (those are demo-only in the prototype; MC is read-only).
- No regeneration of room art or new sprites — assets are reused/added by the design phase, not specified here.
