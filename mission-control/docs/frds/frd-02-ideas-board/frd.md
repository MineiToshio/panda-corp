---
id: FRD-02
type: frd
title: FRD-02 — Ideas board
parent: product/prd.md
status: ACTIVE
implementation_status: VERIFIED
ui: true
visual_source: docs/frds/frd-02-ideas-board/mocks/la-campana.html
last_updated: '2026-06-20'
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
- WHEN the owner presses "Discard idea", the system SHALL open a confirmation **modal** (the shared `Modal` core, DR-057) that captures an **optional reason** (quick-tags — *saturado/competencia · no me interesa el tema · no apalanca mi canal · muy complejo · no monetiza en Perú · otro* — plus free text) and SHALL write it to the `discard_reason` frontmatter field alongside `status`. The reason is optional (confirming without one writes only `status`), and the capture is part of the same write. (Owner rule: reveal-more is a modal, never an inline expand-that-pushes-content — the reason capture does **not** expand inline below the trigger. While the write is in flight the modal stays open with a disabled "Descartando…" state; backdrop/✕/Escape are inert until it settles.) This feeds `/pandacorp:discover`'s rejection-pattern learning so it stops proposing ideas the owner keeps rejecting (factory v9.8.0). On discard the system SHALL also record `status_before_discard` (the prior status) so a restore is exact.
- The board SHALL NOT render a "Descartado" column. Discarded ideas are reached via a **"Ver descartadas" button** (beside "Capturar ideas", shown only when discarded ideas exist) that opens a **modal** listing them (title + discard reason); selecting one opens its detail. (Owner rule: no inline expand-that-pushes-content — reveal-more is a modal. The shared `Modal` core, DR-057, powers this and the intake modal.)
- WHEN the owner opens a discarded idea's detail, the system SHALL show its **full documentation** (the Documentos tab, the default) and a banner with the **discard reason**, and SHALL offer **"Volver a agregar"** — which restores the idea to the status it had **before** being discarded (`status_before_discard`, fallback `discovered`) and clears `discard_reason` + `status_before_discard`. Restore is the board's second write (ADR-0002).

## Card detail — "La Campaña" + tabbed restructure (extension, 2026-06-18)

> Visual contract: `prototype/party-pipeline.html` (La Campaña) embedded in `prototype/index.html`
> (the board card detail). See `prototype/party-redesign-spec.md` §4 (La Campaña), §5 (placement),
> §2 (the real engine phase model). These REQs **extend** the card detail of REQ-02-004; they do not
> change the board derivation, intake, filter or discard behavior.

### REQ-02-009 — Three-tab card detail (Propuesta · Documentos · Campaña)

- AC-02-009.1 — WHEN the owner opens a card, THE system SHALL render the card detail with **three
  horizontal tabs** — **Propuesta · Documentos · Campaña** (in that order) — using the **same tab
  pattern** as the Portfolio project pane (the `stab` selector row), and SHALL default the active tab
  to **Propuesta**. (Owner decision, discover redesign 2026-06-26; the Comandos tab was folded into the
  campaign ficha earlier.)
- AC-02-009.5 — WHEN the **Propuesta** tab is active, THE system SHALL render the idea's **memo-pitch**
  (the card's hot→cold body produced by `/discover`/`/new-idea`, plugin v9.9.0) natively via the
  `IdeaPitch` component (CMP-02-idea-pitch) using the design tokens — the on-brand pitch that makes the
  owner decide. The card `.md` is the source of truth; this is its native rendering inside the board.
- AC-02-009.2 — WHEN the owner clicks a tab, THE system SHALL show that tab's body and mark only that
  tab active; **Propuesta** SHALL render the idea's memo-pitch (AC-02-009.5), **Documentos** SHALL
  render the existing document navigator (summary + key points + the idea's docs, unchanged behavior of
  REQ-02-004), and **Campaña** SHALL render La Campaña (REQ-02-010).
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
- AC-02-010.7 — A **locked** (future, not-yet-reached) phase's ficha SHALL still render its **full
  information** (description, LEE/ESCRIBE, the whole team) — the ficha is information *about* the phase,
  readable regardless of progress (owner, 2026-06-22); the header label ("en espera") signals it is a
  future phase. Only the build phase's "Entrar a La Fragua" **action** is withheld until the build is
  reached. (Superseded the earlier locked/empty placeholder, which hid the phase info.)

### Card-detail fidelity pass (amendment, 2026-06-22)
A visual-fidelity reconciliation of the card detail against `prototype/party-pipeline.html` (the
campaign map) + `prototype/index.html` `detailView()`:
- **AC-02-010.4 amended** — the **active** phase's ficha is shown **by default** (the prototype opens
  the active phase) and **stays pinned**: clicking another phase switches it; clicking the open one
  keeps it open (the detail below the map is always visible, never toggled closed). The ficha gains a
  header "`{n} · {name}` — {state}" (e.g. "Investigación — EN CURSO"). The active room's cast **roams**
  — sprites wander and collaborate (lead halo, speech on meet); `prefers-reduced-motion` renders them
  static. The campaign body is one bordered panel below the (bare, icon-bearing) tab pills; the header
  caption is left-aligned; the stage is full-width with the rooms centred; the road connectors sit
  **under** the rooms.
- **AC-02-010.3 deliverable** — each non-locked room shows the short artifact with its icon only
  (`🔍 research.md`, `📋 PRD + FRDs`, …); the "entrega ▸" label + arrow were dropped. The inter-phase
  connectors render as the prototype's striped **road** (done ✓ / flowing → / locked), not the Fragua
  stone PNG.
- **AC-02-009.1** — the three tabs carry their icons (`ti-map-2 · ti-files · ti-wand`).
- **AC-02-009.2/.3 Documentos** is a **rail (210px) + reader**: the rail always lists **Resumen** (the
  summary reader) plus one item per project document; selecting an item shows it in the reader (a board
  card defers the full document read to the project workspace). **Comandos** uses the shared `CmdRow`,
  and building/operation cards add a project-command box (`workspaceCommands`).
- **AC-02-009.4 In-document links open in the reader** — a relative link inside a document to another
  document the reader surfaces (e.g. the PRD linking an FRD) SHALL open that document in the SAME
  card-detail reader (it selects it in the rail — client-state navigation, not a page nav); an off-app
  URL SHALL open in a new tab; any other relative link SHALL render as plain text (never a broken link).
- **Board columns use La Campaña's phase names** (numbered): `1 Investigación · 2 Producto · 3 Diseño ·
  4 Arquitectura · 5 Construcción · 6 Release` (+ `Descartada`). Same vocabulary as the campaign;
  the two-axis column derivation is unchanged.
- **"en curso" is gated on a genuinely running agent** (the project `running` flag, threaded from the
  card). The active phase reads **"fase actual" / "FASE ACTUAL"** and its cast **idle-bobs in place**
  unless an agent is actually running; only then does it read "en curso" and the cast roams.

## Edge cases
- Idea with no documents → the Documentos rail still shows **Resumen** (the reader = the summary); there
  are simply zero project-document items.
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
