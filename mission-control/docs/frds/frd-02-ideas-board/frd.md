---
id: FRD-02
type: frd
title: FRD-02 — Ideas board
parent: product/prd.md
status: ACTIVE
implementation_status: IN_REVIEW
ui: true
visual_source: docs/design/prototype/index.html
visual_source_mocks: docs/frds/frd-02-ideas-board/mocks/ideas-board.html
last_updated: '2026-10-22'
floor: false
---
# FRD-02 — Ideas board

Read-only kanban of the idea base, with idea capture, a navigable detail and discard.

> **Design freeze amendment (2026-10-22, S2.2).** The approved Órbita prototype (`docs/design/prototype/index.html`) is the visual and functional oracle for this FRD. Quoted UI strings are the prototype's Spanish strings. Items the owner left out of the v2 redesign (decision 2026-10-21) stay in place, prefixed **Out of v2**, so their ids keep tracing. Items the prototype draws and this FRD lacked are REQ-02-016 (AC-02-016.1 to AC-02-016.8). Source: `docs/design/freeze/reconciliation.md`.

## Acceptance criteria (EARS)
- The board SHALL place each idea into one of the columns `discovered → documented → design → architecture → building → shipped` (plus a `discarded` column) by **deriving the column from two axes** (the card `status` and, once handed off, the project `phase` — see FRD-01), NOT from the card `status` alone:
  - card `status: discovered` or `recommended` (not handed off yet) → **discovered** column (**Out of v2 (owner decision 2026-10-21):** a `recommended` card showing a "recommended" badge; in v2 the card sits in the column without a badge).
  - card `status: in-pipeline` → the column comes from the linked project's `.pandacorp/status.yaml` **phase**: `product`→documented, `design`→design, `architecture`→architecture, `implementation`→building, `release`→shipped.
  - card `status: shipped` → **shipped** column; card `status: discarded` → **discarded** column.
  - The board SHALL NOT expect `design`/`architecture`/`building` to ever appear as a card `status` (those columns only come from the project phase). IF an `in-pipeline` card's project or `status.yaml` is missing, THEN it SHALL fall back to the **documented** column without breaking.
- **REQ-02-002** — The board SHALL NOT allow moving cards by hand (drag or arrows): the transitions are written by the skills. The columns SHALL have the same width, be **wide** (not tiny) and have **horizontal scroll** when they don't fit; the text SHALL wrap onto several lines if it doesn't fit.
- **REQ-02-003** — WHEN the owner clicks "Capturar ideas", the system SHALL open a **modal overlay** (dark backdrop + blur) with the four intake commands — `/pandacorp:explore`, `:new-idea`, `:discover` and `:recommend` — each with an icon, title, description and copy-command row. Clicking the backdrop or the ✕ button SHALL close the modal. The board SHALL remain visible behind the modal as context.
- WHEN the owner clicks a card, the system SHALL show the card: summary, key points, a navigator of the idea's documents, and the next-step command (with a copy button).
- **REQ-02-005** — EACH card SHALL show two labels besides the score: **category** (`project_type`: web, mobile, desktop, ai, claude-code, prompt-system, automation, cli, rework…) and **return** (`return_type`: monetary, opportunity, personal or mixed). The board SHALL allow **filtering by category**.
- **REQ-02-006** — WHILE an idea's project has `running: true` (build in progress, phase `implementation` → "building" column), the system SHALL show an indicator on its card that it is being built.
- WHEN the owner presses "Descartar idea", the system SHALL rewrite `status: discarded` in the `.md` frontmatter, preserving the rest of the file (one of the app's small, bounded set of human-triggered writes — see REQ-02-012 and architecture §7).
- **REQ-02-008** — WHEN the owner presses "Descartar idea", the system SHALL open a confirmation **modal** titled "Descartar idea" (the shared `Modal` core, DR-057) that captures an **optional reason** ("Motivo (opcional)" free text; **Out of v2 (owner decision 2026-10-21):** the quick-tags — *saturado/competencia · no me interesa el tema · no apalanca mi canal · muy complejo · no monetiza en Perú · otro*) and SHALL write it to the `discard_reason` frontmatter field alongside `status`. The reason is optional (confirming without one writes only `status`), and the capture is part of the same write. (Owner rule: reveal-more is a modal, never an inline expand-that-pushes-content — the reason capture does **not** expand inline below the trigger. **Out of v2 (owner decision 2026-10-21):** while the write is in flight the modal stays open with a disabled "Descartando…" state; backdrop/✕/Escape are inert until it settles.) This feeds `/pandacorp:discover`'s rejection-pattern learning so it stops proposing ideas the owner keeps rejecting (factory v9.8.0). On discard the system SHALL also record `status_before_discard` (the prior status) so a restore is exact.
- **REQ-02-017** — The board SHALL NOT render a "Descartado" column. Discarded ideas are reached via a **"Descartadas · N" button** (beside "Capturar ideas", always shown, N = the count of discarded ideas) that opens a **modal** titled "Ideas descartadas · N" listing them (title, category and discard reason, with "leer propuesta y restaurar"); selecting one opens its detail. (Owner rule: no inline expand-that-pushes-content — reveal-more is a modal. The shared `Modal` core, DR-057, powers this and the intake modal.)
- **REQ-02-018** — WHEN the owner opens a discarded idea's detail, the system SHALL show its **full documentation** (in the Documentos tab) and a banner with the **discard reason**, and SHALL offer **"Restaurar"** — which opens the "Restaurar idea" confirmation dialog (no reason field: restore takes none) and, on confirm, restores the idea to the status it had **before** being discarded (`status_before_discard`, fallback `discovered`) and clears `discard_reason` + `status_before_discard`. Restore is the board's second write (ADR-0002).
- **REQ-02-014** — WHEN a board column has no cards, it SHALL show an accessible empty-state marker: an element with role `status` whose visible text is "Sin ideas en esta fase" (columns are pipeline phases), so the empty state is conveyed by text and not by shape alone (WO-02-014).

## Card detail — "La Campaña" + tabbed restructure (extension, 2026-06-18)

> Visual contract: `prototype/party-pipeline.html` (La Campaña) embedded in `prototype/index.html`
> (the board card detail). See `prototype/party-redesign-spec.md` §4 (La Campaña), §5 (placement),
> §2 (the real engine phase model). These REQs **extend** the card detail of REQ-02-004; they do not
> change the board derivation, intake, filter or discard behavior.

### REQ-02-009 — Card-detail tabs (Propuesta · Spec? · Arquitectura? · Documentos · Campaña)

- **AC-02-009.1** — WHEN the owner opens a card, THE system SHALL render the card detail with **three
  horizontal tabs** — **Propuesta · Documentos · Campaña** (in that order) — using the **same tab
  pattern** as the Portfolio project pane (the `stab` selector row), and SHALL default the active tab
  **by the project's stage** (campaign phase): research → **Propuesta**; product or design → **Spec**;
  architecture, implementation or release (incl. shipped) → **Arquitectura**. When the stage's tab is
  not rendered (the corresponding artifacts are absent), the default falls back to the previous available stage tab
  (Arquitectura → Spec → Propuesta); Documentos and Campaña are never the default. Only the initial tab
  is derived: the owner's later pick persists (AC-02-009.4). (Owner decision, discover redesign 2026-06-26; the Comandos tab was folded into the
  campaign ficha earlier.) A **Spec** tab is inserted **between Propuesta and Documentos** when the
  project has a spec digest (REQ-02-011), and an **Arquitectura** tab **after Spec** (and a **Documentos** tab with its document count) whenever the idea is linked to a project (REQ-02-013); an idea with no linked project shows Propuesta · Campaña only. Full order when all exist: Propuesta · Spec · Arquitectura · Documentos · Campaña.
- **AC-02-009.5** — WHEN the **Propuesta** tab is active, THE system SHALL render the idea's **memo-pitch**
  (the card's hot→cold body produced by `/discover`/`/new-idea`, plugin v9.9.0) natively via the
  `IdeaPitch` component (CMP-02-idea-pitch) using the design tokens — the on-brand pitch that makes the
  owner decide. The card `.md` is the source of truth; this is its native rendering inside the board.
  The hero badges SHALL include **"qué es" chips** — the app type (`project_type`: web / mobile / api …)
  and, when an in-pipeline project declares it, the web target platform (`target_platforms`: desktop /
  mobile / responsive) — and SHALL **omit the opaque verdict ("build") badge** (it conveys the kill/build
  decision, not what the product is). The same chips appear in the Spec hero (AC-02-011.2); both reuse a
  single `projectMetaChips` helper so they never drift.
- **AC-02-009.2** — WHEN the owner clicks a tab, THE system SHALL show that tab's body and mark only that
  tab active; **Propuesta** SHALL render the idea's memo-pitch (AC-02-009.5), **Documentos** SHALL
  render the existing document navigator (summary + key points + the idea's docs, unchanged behavior of
  REQ-02-004), and **Campaña** SHALL render La Campaña (REQ-02-010).
- **AC-02-009.3** — WHEN the owner clicks a document entry (in any tab context that exposes a document),
  THE system SHALL switch the active tab to **Documentos** and show that document, so a document
  click always lands the owner on **Documentos**.
- **AC-02-009.4** — THE system SHALL **persist the active tab choice** for the open card across
  re-renders of the card detail (the tab selection survives interactions that re-render the detail
  without navigating away from the card).

### REQ-02-010 — "La Campaña" pipeline (the Campaña tab)

- **AC-02-010.1** — WHEN the **Campaña** tab is active, THE system SHALL render **La Campaña**: the
  **6-phase pipeline** in fixed order `research → product → design → architecture → build → release`,
  each phase shown as a room, wrapped in a labelled container ("El viaje de esta idea por las 6
  fases"). The phase names are Investigación · Producto · Diseño · Arquitectura · Construcción ·
  Lanzamiento.
- **AC-02-010.2** — THE system SHALL **derive the ACTIVE phase from the project's real status** (the card
  `status` / linked project `status.yaml` phase) with the mapping `discovered→research`,
  `documented→product`, `design→design`, `architecture→architecture`, `building→build`,
  `shipped→release`; IF the status is absent or unrecognized THEN the active phase SHALL default to
  **research** (index 0) without breaking.
- **AC-02-010.3** — THE system SHALL render each phase by its position relative to the active phase:
  phases **before** the active one as **done** (showing their delivered deliverable), the active one
  as **current** (glowing), and phases **after** it as **locked**.
- **AC-02-010.4** — WHEN the owner clicks a phase, THE system SHALL show that phase's **ficha**: a
  description, what it **reads** (LEE — the deliverable from the previous phase) and **writes**
  (ESCRIBE — the deliverable for the next phase), and the **whole team** of that phase — every
  specialist with its role and what it does (not only the lead). The teams SHALL be: research =
  `researcher`; product = `product-manager`; design = `designer` + `copywriter`; architecture =
  `architect`; build = `implementer` + `reviewer` + `analytics` + `security-auditor`; release =
  `devops` (**reconciled-from-code, DR-085, 2026-09-25**: the security audit is the LAST STEP of
  construction, not a separate release activity — `security-auditor` sits on the build team, and
  release keeps only `devops`; see `factory/decisions/registry.yaml` DR-085 and
  `CampaignPipeline/phases.ts`). The deliverable chain (LEE→ESCRIBE) SHALL be `research.md →
  PRD/FRDs (EARS) → mockups + design tokens + components.md (microcopy) → blueprint + ADRs +
  Build Plan + work orders → código verificado y endurecido (auditado, GREEN) → app lanzada
  (interna o externa) + plan de lanzamiento`.
- **AC-02-010.8** — (amended 2026-10-22, v2 plan: Claude Design sunset, change card `design-phase-copy-claude-design-sunset`) THE fichas SHALL reflect the **current factory**: the **Design** ficha SHALL state
  that the `designer` writes the design directions as **HTML** in the repo and publishes them as **private
  Artifacts** for the owner's review (the exact prototype copy: "Creación del sistema visual y la microcopia.
  El designer escribe las direcciones de diseño en HTML y las publica como Artifacts privados para que las
  revises, y el copywriter aporta la voz, para que el producto sea bello, accesible y coherente en lenguaje."
  and, on the designer's team line, "Escribe los mockups en HTML y los publica como Artifacts privados para tu
  revisión, define los tokens de diseño y el inventario components.md, y asegura la consistencia visual."),
  that it produces **`components.md`** + **mocks** + design tokens (and microcopy via `copywriter`), and no
  ficha or other app text SHALL mention Claude Design;
  the **Architecture** ficha SHALL state that it **plans the foundation
  (shared primitives) and the file artifacts** of each work order (plus the blueprint, ADRs and Build
  Plan); and the **Build** ficha SHALL reflect the **v2 build flow** — foundation-first, disjoint
  waves serialized by file artifact, per-WO fidelity loop, the 4-lens + visual-judge gate and the
  Option-B wave commit (consistent with FRD-06 / La Fragua).
- **AC-02-010.9** — Each phase's ficha SHALL carry a **"Qué puedes correr"** section listing that phase's
  **runnable commands** (the first is the advance/recommended step; the rest are the phase's other
  options), each as a **copyable** `CmdRow` (the first labelled "Siguiente paso", the rest under
  "Otras opciones de esta fase"). The command text SHALL **substitute the project slug**
  into the `<idea>` token (e.g. `/pandacorp:spec <idea>` renders `/pandacorp:spec <slug>`) so it
  copy-pastes directly — never a literal `<idea>` placeholder. The factory-run commands (`spec`,
  `explore`) carry the project name; the in-project commands (`design`, `blueprint`, `implement`,
  `release`, `iterate`, `bug`, `change`, `review-launch`, `new-version`, `sync`) do not. A command
  that has **modes** SHALL NOT render an inline `<select>` (amended 2026-10-22 to the approved
  prototype): the **`spec`** clarification modes (`--ask` / `--auto` / `--infer`, DR-095) SHALL sit
  in a disclosure whose summary reads "Cuántas preguntas te hago antes de generar la documentación"
  and which lists each mode with its own copyable command (the mode's flag folded into the command,
  e.g. `/pandacorp:spec <slug> --ask`); the **`implement`** build modes are offered by the
  four-card picker behind "Elegir modo de construcción" (FRD-11 AC-11-005.1). A one-line hint
  SHALL describe each mode. Commands without modes render as a plain row. Read-only
  (AC-02-010.6): showing the command is not running it.
- **AC-02-010.5** — WHEN the owner activates the **Construcción** (build) phase's "Entrar a La Fragua"
  action, THE system SHALL **navigate the host app** to Portafolio → that project's **Resumen** tab,
  whose head is La Fragua (FRD-06; there is no Party tab), WITHOUT an inner iframe reload of the
  card detail. THE system SHALL NOT show the action until the build phase is reached (a locked build
  phase shows its ficha without the action, AC-02-010.7).
- **AC-02-010.6** — THE Campaña view SHALL be **read-only**: it SHALL NOT call Claude, write any file, or
  trigger any build; the only "communication" it depicts between phases is the deliverable document
  travelling to the next phase (artifact across time).
- **AC-02-010.7** — A **locked** (future, not-yet-reached) phase's ficha SHALL still render its **full
  information** (description, LEE/ESCRIBE, the whole team) — the ficha is information *about* the phase,
  readable regardless of progress (owner, 2026-06-22); the header label ("en espera") signals it is a
  future phase. Only the build phase's "Entrar a La Fragua" **action** is withheld until the build is
  reached. (Superseded the earlier locked/empty placeholder, which hid the phase info.)
- **AC-02-010.10** — WHILE the idea is still under investigation (a pre-pipeline `discovered` /
  `recommended` card → the **research** ficha), THE "Qué puedes correr" section SHALL offer
  **`/pandacorp:explore <idea>`** (slug interpolated) as the optional refine step alongside `spec` —
  the visible path to evolve the idea conversationally BEFORE documenting the MVP. Explore is an
  option, never the advance step (spec remains first). No later (in-pipeline / shipped) phase's ficha
  SHALL offer explore. (Change `mc-nextstep-offer-explore`, 2026-07-02.)

### Card-detail fidelity pass (amendment, 2026-06-22)
A visual-fidelity reconciliation of the card detail against `prototype/party-pipeline.html` (the
campaign map) + `prototype/index.html` `detailView()`:
- **AC-02-010.11** — (amended 2026-10-22, v2 plan: renumbered from the fidelity-pass restatement "AC-02-010.4 amended", so each id is defined once) the **active** phase's ficha is shown **by default** (the prototype opens
  the active phase) and **stays pinned**: clicking another phase switches it; clicking the open one
  keeps it open (the detail below the map is always visible, never toggled closed). The ficha header
  shows the kicker "Fase {n} de 6", the phase name and a state chip (e.g. "Fase 1 de 6" · "Investigación" ·
  "en curso"), with previous/next phase arrows (AC-02-016.6). The active room's cast **roams**
  — sprites wander and collaborate (lead halo, speech on meet), moved by `transform` only (FRD-13
  motion rule); `prefers-reduced-motion` renders them static. The campaign body is one bordered panel
  below the (bare, icon-bearing) tab pills; the header caption is left-aligned; the stage is
  full-width with the rooms centred.
- **AC-02-010.12** — (amended 2026-10-22, v2 plan: renumbered from the fidelity-pass restatement "AC-02-010.3 deliverable", so each id is defined once) each room shows its cast and the room name; the hand-off artifact
  (`research.md`, `PRD + FRDs`, `sistema + mocks`, `blueprint + Build Plan`, `el código`) is written
  on the **corridor** between two rooms, which turns solid green once delivered; there is no artifact
  pill inside the room and no striped road.
- **AC-02-009.6** — (amended 2026-10-22, v2 plan: renumbered from the fidelity-pass restatement of "AC-02-009.1", so each id is defined once) every rendered tab carries an inline SVG icon (Propuesta bulb, Spec layers, Arquitectura cube, Documentos file, Campaña flag); the tab for the current location is the only one marked active.
- **AC-02-009.7** — (amended 2026-10-22, v2 plan: renumbered from the fidelity-pass restatement of "AC-02-009.2/.3", so each id is defined once) **Documentos** is a **curated index + reader**: the index sits on the **RIGHT** of the
  reader (folded behind a list below 900 px) and always lists **Resumen** (the summary reader) plus one
  item per project document, grouped by purpose; selecting an item shows it in the reader (a board
  card defers the full document read to the project workspace). Commands live in the Campaña ficha
  (the `Comandos` tab no longer exists), through the shared `CmdRow`; building/release cards add a
  project-command box (`workspaceCommands`).
- **AC-02-009.8** — (amended 2026-10-22, v2 plan: renumbered from the fidelity-pass restatement of "AC-02-009.4", so each id is defined once) **In-document links open in the reader**: a relative link inside a document to another
  document the reader surfaces (e.g. the PRD linking an FRD) SHALL open that document in the SAME
  card-detail reader (it selects it in the rail — client-state navigation, not a page nav); an off-app
  URL SHALL open in a new tab; any other relative link SHALL render as plain text (never a broken link).
- **Board columns use La Campaña's phase names** (numbered): `1 · Investigación · 2 · Producto · 3 · Diseño ·
  4 · Arquitectura · 5 · Construcción · 6 · Lanzamiento`. There is no `Descartada` column: discarded ideas
  sit behind the "Descartadas · N" button. Same vocabulary as the campaign; the two-axis column
  derivation is unchanged.
- **Ambient roam, honest label (amended 2026-06-29).** The active phase's cast **always roams** —
  sprites wander as ambient liveliness of "where the idea is now", for **any** phase (research →
  release), **decoupled** from the build's `running` flag (which only `/pandacorp:implement` sets, so
  previously only the build room ever animated). What stays gated on a **genuinely running agent** (the
  project `running` flag, threaded from the card) is two things, so the wander is ambient but no
  live-work is fabricated: (1) the **label** — (amended 2026-10-22, v2 reconciliation) the current phase's
  ficha/badge state chip reads **"en curso"** (as AC-02-010.11 and the prototype draw it); (2) the **live-work
  markers** — the lead **halo** and the **speech-on-meet** bubbles render only while running. Done
  rooms idle-bob in place; locked rooms are static; `prefers-reduced-motion` renders all static.
  (Superseded the earlier "the active cast idle-bobs unless an agent is running; only then it roams".)

### REQ-02-011 — "Spec" tab: native high-level digest of the project's spec (CMP-02-spec-digest)

> A fourth, **conditional** tab between Propuesta and Documentos that renders the project's spec
> (PRD + research + FRDs) as a visual, scannable Spanish overview — the analogue of Propuesta but
> for the documented spec. Source of truth: the Spanish digest `.pandacorp/comms/spec-resumen.md`
> generated by `/pandacorp:spec` (its template is the rendering contract). Read-only over the factory.

- **AC-02-011.1** — WHEN the open card's linked project has a spec digest (`.pandacorp/comms/spec-resumen.md`
  present and non-empty), THE system SHALL render a **Spec** tab **between Propuesta and Documentos**;
  WHEN no digest exists, THE system SHALL NOT render the Spec tab (the project hasn't reached that
  stage). The reader is fail-loud (DR-078): a missing digest is the deliberate absent state, never a crash.
  The digest (and the project's docs and status) SHALL be read for **any card linked to a project**
  (`project` set): in-pipeline, shipped (launched) or discarded, not only in-pipeline, so a launched
  or discarded project keeps its Spec, Arquitectura and Documentos tabs.
- **AC-02-011.2** — WHEN the **Spec** tab is active, THE system SHALL render the digest natively in three
  sections — **"PRD · qué y por qué"**, **"Research · la evidencia"**, **"FRDs · las piezas del v1"** (plain headings, no emoji) — reusing the Propuesta tab's visual language
  (full-bleed tinted blocks, label rows, role/stat/reference cards, an amber callout for the open
  decisions) for cross-surface coherence (DR-062). PRD/Research subsections are classified by label and
  rendered to be **scannable at a glance** (owner rule): **El problema** → a bullet list (not a prose
  wall); **Hipótesis de valor** → a single short highlighted callout; **Usuarios** → title+description
  role cards; **Métricas** → title+description stat cards; **Alcance v1** → a roomy checklist (not
  cramped pills); **Fuera del v1** → muted chips **without a strike-through** (legibility); **Decisiones
  abiertas** → an amber callout; **Referentes** → reference cards; else prose. Title+description cards
  parse a `- **Title** — desc` bullet (the parser tolerates a parenthetical between the bold and the
  dash, so a mis-authored bullet still yields a title + a description rather than a title-only card).
- **AC-02-011.3** — THE FRDs section SHALL render **one compact card per v1 FRD** (id · title · type tag ·
  one-line summary). WHEN the owner clicks an FRD card, THE system SHALL open a **modal** (not an inline
  expand — owner rule, reusing the core `Modal` with its focus-trap/Escape/return-focus a11y contract)
  showing that FRD's detail — Visión, Historias de usuario, Reglas de negocio, Fuera de alcance,
  Preguntas abiertas and Work orders — colour-coded per section, consistent with the Spec page, and
  ending with the buttons "Contrato", "Blueprint" and "Ver work orders".

- **AC-02-011.4** — WHEN Spec is opened from the Portfolio workspace or a direct project page, THE system SHALL reuse this complete Spec component and digest/count readers under FRD-04 REQ-04-013. The board's conditional-tab behavior remains unchanged; the workspace retains an honest empty state when its digest is absent.

### REQ-02-012 — Mark a card as favourite (visual highlight, any column) (CMP-02-favorite-action)

> A purely **visual** affordance: the owner pins the ideas/projects they care about so they stand
> out on the board. It does **not** change the card `status`, its board column, or any pipeline
> flow — it just highlights. The flag lives in the card `.md` frontmatter (`favorite: true`), so it
> persists and works for a card in **any** column (discovered … shipped, in-pipeline projects
> included). The board's **third write** (ADR-0003), isolated to `lib/favorite/`, human-triggered.

- **AC-02-012.1** — WHEN the owner marks a card as favourite, THE system SHALL write `favorite: true`
  in that card's `.md` frontmatter, preserving the body and all other fields verbatim.
- **AC-02-012.2** — WHEN the owner unmarks a favourite, THE system SHALL **remove** the `favorite`
  field (a non-favourite card carries no `favorite` key — same discipline as the optional
  `discard_reason`). The write SHALL never touch `status` or any other field.
- **AC-02-012.3** — THE system SHALL render a **star toggle** in the top-right corner of **every** board
  card (in any column) and in the card-detail header; clicking it SHALL toggle the favourite flag
  via a Server Action with **optimistic UI** (the star flips immediately and auto-reverts on
  failure). The star SHALL be an outline star when not a favourite and a filled gold star
  when it is, with a Spanish `aria-label` that names the idea ("Marcar como favorita: <título>" /
  "Quitar de favoritas: <título>") and `aria-pressed` reflecting the state.
- **AC-02-012.4** — **Out of v2 (owner decision 2026-10-21):** WHEN a card is a favourite, THE system SHALL highlight it with a distinct **gold
  card background + border** (the `--color-warn` token, distinct from the teal accent used by
  "recomendada"/"en construcción"). The highlight SHALL **not** be conveyed by colour alone — the
  card's `aria-label` SHALL include "favorita" and carry the filled-star control (accessibility.md).
  In v2 the filled gold star of AC-02-012.3 alone marks a favourite.

### REQ-02-013 — "Arquitectura" tab: native high-level digest of the project's architecture (CMP-02-architecture-digest)

> A **conditional** tab **after Spec** (Propuesta · Spec · **Arquitectura** · Documentos · Campaña) that
> renders the project's architecture as a visual, scannable single screen — the analogue of the Spec tab
> but for the architecture phase. Source of truth: the Spanish digest
> `.pandacorp/comms/arquitectura-resumen.md` generated by `/pandacorp:architecture` (its template is the
> rendering contract) for the NARRATIVE, plus the project's LIVE artifacts for the machine-truth blocks.
> Read-only over the factory.

- **AC-02-013.1** — WHEN the open card's linked project has a non-empty architecture digest OR a present structured model artifact (including explicit none or invalid input), THE system SHALL render an **Arquitectura** tab after Spec when available, otherwise after Propuesta. WHEN the card is linked to a project but both artifacts are absent, THE system SHALL still render the tab, with the message "La arquitectura todavía no está publicada." (amended 2026-10-22 to the approved prototype); WHEN the card has no linked project, THE system SHALL omit the tab. Availability SHALL NOT depend on the digest when the model artifact is present. This applies to every project-linked card, including shipped and discarded cards.
- **AC-02-013.2** — WHEN **Arquitectura** is active, THE system SHALL reuse the complete `ArchitectureDigest`: hero, **Stack & tecnologías**, **Integraciones y operación**, **Modelo de datos**, **Variables de entorno**, **Decisiones (ADRs)**, **Plan de implementación**, and per-FRD cards. The **Modelo de datos** heading SHALL remain present and host the shared logical-model viewer (REQ-02-015); existing narrative/content-entity context SHALL remain readable. Stack SHALL describe technology/provider choices and their rationale; Integraciones y operación SHALL preserve all authored service flows, responsibilities and operational tasks without deduplicating away facts merely because a vendor also appears in Stack. Missing narrative SHALL NOT suppress an available model or its error/none state.
- **AC-02-013.3** — THE **Plan de implementación** SHALL render a **state mosaic**: one tile per work
  order, grouped by FRD, each tile coloured and labelled by `implementation_status`. WHILE the
  project has not reached Construcción, the block SHALL be replaced by a line "N work orders
  planificadas". The mosaic is computed from the LIVE work-order frontmatter
  (`docs/frds/*/work-orders/*.md`, DR-049), not from the digest. The interactive dependency graph
  (critical path, parallelism) lives in Observabilidad → Dependencias (FRD-12, amended 2026-10-22 to
  the approved prototype; supersedes the earlier `WoDag` reuse here).
- **AC-02-013.4** — THE **Decisiones (ADRs)** and **Variables de entorno** blocks SHALL be read **live** from
  the real artifacts (`docs/adr/*` and `.env.example`), not duplicated in the digest, so they never drift.
  An ADR row SHALL be clickable and open a **modal** (the core `Modal` a11y contract) with the ADR body.
- **AC-02-013.5** — THE **per-FRD** cards SHALL render one card per FRD (id · title · WO count · blueprint
  one-liner); clicking a card SHALL open a **modal** with that FRD's blueprint summary + its work-orders
  list — consistent with the Spec tab's FRD-card→modal pattern (owner rule: heavy detail in a modal).
- **AC-02-013.6** — (amended 2026-10-22, v2 reconciliation) **Out of v2 (owner decision 2026-10-21):** WHEN an FRD's modal is open AND that FRD has **more than one** live work order, THE
  system SHALL render, at the end of the modal, a **scoped dependency DAG** (the same `WoDag` reused by
  the main Plan de implementación) showing ONLY that FRD's work orders and their intra-FRD dependencies
  /parallelism. WHEN the FRD has a single work order, THE system SHALL NOT render the DAG (there is no
  dependency/parallelism to show). In v2 the FRD modal ends with its links only (Contrato,
  Blueprint, Ver work orders).

### REQ-02-015 — Shared logical data-model viewer (CMP-02-data-model-viewer)

The project-owned source is `docs/product/data-model.json`. Contract and reader details live in [ADR-0006](../../adr/ADR-0006-shared-logical-data-model-viewer.md) and the [platform architecture](../../product/architecture.md). The architecture tooling producer/backfill is a separate factory dependency; this consumer never fabricates the source.

- **AC-02-015.1** — WHEN a valid version-1 relational or document model is available, THE viewer SHALL display every declared entity, ordered attribute, logical type, optionality, PK/FK/UQ membership as per-attribute badges and composite-key group, preserving isolated entities, self-relations, parallel edges and declared association entities without inventing joins. **Out of v2 (owner decision 2026-10-21):** the visual distinction of composite key groups, isolated entities and self-relations (the keys show as per-attribute badges only).
- **AC-02-015.2** — WHEN a relationship is displayed or selected, THE viewer SHALL preserve both endpoint cardinalities, explicitly labelled `1`, `0..1`, `0..*` or `1..*` (the "Relaciones N" list shows each as `from min..max → to min..max`); it SHALL NOT render a lower relationship inspector or duplicate relationship-button list. **Out of v2 (owner decision 2026-10-21):** the attribute mappings shown on links and the independently selectable graph connectors.
- **AC-02-015.3** — WHEN the viewer opens at desktop or tablet width, THE default SHALL be **Diagrama** (on phones it opens on **Esquema**, amended 2026-10-22), using content-sized entity cards that show full names, attribute names and types without ellipsis, 24px attribute rows and 12px field text; THE viewer SHALL offer native pointer-drag panning of the canvas background, zoom, fit/reset, keyboard arrows and labelled directional buttons without requiring scrollbars to navigate the diagram.
- **AC-02-015.4** — WHEN the owner chooses **Esquema**, THE viewer SHALL display a single column of compact, initially collapsed entity accordions; activating an entity SHALL expand its natural-height, selectable Prisma-like text, attributes, keys and explicit relationship/cardinality text from the same artifact, close any other open entity in that viewer, and permit collapsing it again; this SHALL be a viewing representation, not an executable Prisma schema or an HTML attribute table.
- **AC-02-015.5** — (amended 2026-10-22, v2 reconciliation) WHEN the owner searches an entity/attribute or selects an entity or a relationship (via the "Relaciones N" rows; activating a graph connector is out of v2, consistent with AC-02-015.2), THE viewer SHALL reveal matching entities, center diagram search results and highlight matching/connected graph elements without editing or dropping model data or adding a lower detail panel. Activating the same explicitly selected relationship row again SHALL clear selection. Selected relationships SHALL use the routed line/cardinality strokes as their visual indicator, without an outline around the SVG group bounds; other controls SHALL retain their existing focus indicators. Active expanded search SHALL announce matches or no matches inside its dialog.
- **AC-02-015.6** — WHEN the owner expands the model, THE viewer SHALL request native browser fullscreen ("Pantalla completa") on a model-only host within the activating gesture (**Out of v2 (owner decision 2026-10-21):** the fallback to a viewport-filling diagram dialog when native fullscreen is unavailable or rejected); it SHALL use its own compact top-right icon toolbar (amended 2026-10-22, v2 plan: the dependency map no longer has this toolbar, FRD-12 AC-12-004.5) for zoom, percentage/reset, fit and fullscreen/minimize, with search and click-pan alternatives and no source bands, tabs, visible instructions, legend or lower details; it SHALL preserve its model and selection, provide modal keyboard navigation/Escape, restore the actual activating text/icon trigger focus on close or native fullscreen exit, and prevent another selected project's model from leaking into the view.
- **AC-02-015.7** — WHEN the source is absent, explicitly `persistence: none`, valid with no entities, malformed, oversized, unreadable or unsupported, THE viewer SHALL show the corresponding missing/none/empty/error state and keep the rest of Architecture usable; invalid input SHALL never appear as a valid empty diagram. Malformed, oversized, unsupported and unreadable sources share ONE explicit error notice in Modelo de datos (same copy shape, naming what failed), distinct from the explicit-none state ("Este proyecto declara explícitamente que no usa base de datos.") and from the not-published state.
- **AC-02-015.8** — WHEN a usable designed model is displayed without independent schema verification, THE inline viewer SHALL state **"Modelo diseñado, no verificado contra una base viva"**; phase, timestamps and work-order state SHALL NOT imply operational-schema verification.
- **AC-02-015.9** — WHEN identical project artifacts are opened from the board, portfolio workspace or direct project page, THE system SHALL use the same reader and viewer and SHALL retain all other Architecture sections (REQ-02-013).
- **AC-02-015.10** — WHEN arranging a valid model, THE viewer SHALL use deterministic orthogonal field-port routing, keep every entity nonoverlapping and every connector outside card interiors, retain distinct self/parallel links and center an initially readable, complete connected entity rather than clipping the first table. Ajustar SHALL fit the complete graph; Restablecer SHALL restore the readable starting view. (Unchanged in v2: the owner kept the app's layout engine at M1 2026-10-22; the prototype's simpler masonry layout is not adopted for the data model, and its canvas is compared by computed styles, not pixels.)
- **AC-02-015.11** — WHEN asynchronous layout is pending, fails or belongs to a previous project, THE viewer SHALL show an explicit bounded loading/error state, isolate responses by model identity and cancel old/overdue worker tasks, without blocking browser interaction. (Kept in v2: the data model keeps the app's current layout engine, owner decision at M1 2026-10-22, so this behaviour stays; the prototype does not draw the state and it is verified by behaviour tests, not by pixels.)
  Model identity is based on content: an equal RSC payload preserves the ready viewer, layout reference, pan, zoom and fullscreen without returning to loading. A changed model cancels the old task and lays out again. This content-identity guarantee does not protect URL selections: client parameters pushed during an in-flight canonical replace, or a real RSC refresh through `useUrlState.ts:45-46`, can still lose `expanded`, `entity` and `modelQuery`. Those cases belong to `nav-client-params-in-flight`, outside WO-02-019.

- **AC-02-015.12** — WHEN the owner zooms or pans, THE model viewer SHALL use 15% button steps and delta-mode-normalized proportional wheel scaling, batch wheel/pointer updates once per animation frame, retain unchanged entity/edge content and cancel queued frames on direct reset/fit or unmount.

- **AC-02-015.13** — WHEN interacting with inline or expanded diagram entity cards, THE viewer SHALL prevent text selection inside those cards and clear any existing browser selection on canvas pointer-down; expanded schema text SHALL remain selectable.
- **AC-02-015.14** — WHEN Propuesta, Spec or Arquitectura is displayed, THE content panels SHALL use the available host width without a fixed inner panel-width cap; long introductory prose MAY retain its readable line-length limit.

### REQ-02-016 — Board search and navigation, idea-page header and cards (added 2026-10-22, design freeze)

> Group A of the design freeze: behaviours the approved Órbita prototype draws and this FRD lacked.

- **AC-02-016.1** — (amended 2026-10-22, v2 reconciliation) WHEN the owner types in the board search ("Buscar por nombre o contenido…"), THE system SHALL show only the ideas whose title or content matches, across every phase column.
- **AC-02-016.2** — THE board SHALL show one phase selector chip per phase with its idea count, and WHEN a chip is activated THE system SHALL scroll that phase's column into view.
- **AC-02-016.3** — WHEN the owner turns on "Ocultar columnas vacías", THE board SHALL remove the empty phases and their selector chips, and SHALL remember the choice in this browser.
- **AC-02-016.4** — WHILE a category filter is active, THE board SHALL show the live count "N ideas coinciden".
- **AC-02-016.5** — THE idea page SHALL show a header with the idea's stage line ("Etapa: <fase>", or "Descartada" for a discarded idea; no phase stepper), a "Volver al tablero" link, and its favorite, open-project and discard actions on one row.
- **AC-02-016.6** — THE Campaña SHALL show a six-segment strip with "N/6 entregadas", and the phase sheet SHALL offer previous and next phase arrows.
- **AC-02-016.7** — EACH FRD card in the Spec and Arquitectura tabs SHALL open its detail from its whole area, SHALL carry a coloured kind tag (UI, Infra, Tool/CLI, API or Data, taken from the FRD's `ui:` field when the digest lacks it), and SHALL show work-order progress only once construction has started (before that, the planned count).
- **AC-02-016.8** — THE "Variables de entorno" block SHALL group variables by their `.env.example` section, SHALL label a variable without its own comment "Sin descripción en .env.example" with a count badge, and SHALL fold any group longer than 12 variables.

**Worked example (AC-02-016.2, AC-02-016.3).** The board has 6 phases, with Diseño and Lanzamiento empty. The owner turns on "Ocultar columnas vacías": 4 columns and 4 chips remain; reloading this browser keeps them hidden. Activating the chip "Arquitectura 2" scrolls that column into view.

## Edge cases
- Idea with neither architecture digest nor structured model artifact → a project-linked idea keeps the Arquitectura tab with "La arquitectura todavía no está publicada."; an idea with no linked project has no Arquitectura (nor Spec or Documentos) tab (AC-02-013.1, AC-02-009.1).
- Idea with no spec digest → the Spec tab is simply absent; the other tabs render unchanged (AC-02-011.1).
- Favourite is orthogonal to the column: a card keeps its derived column whether or not it is a favourite; toggling the star never moves it (REQ-02-012).
- Idea with no documents → the Documentos rail still shows **Resumen** (the reader = the summary); there
  are simply zero project-document items.
- ~~Category, return and score are shown with a legend explaining them.~~ **Out of v2 (2026-10-22 reconciliation):** the approved prototype draws no legend; the labels of REQ-02-005 stand alone.
- An `in-pipeline` card whose project / `status.yaml` is missing or malformed → La Campaña active phase falls back to **research** (index 0) and the view still renders (AC-02-010.2).
- A `discovered` card (no project yet) → La Campaña active phase = **research**; the future phases are all locked (AC-02-010.3 / AC-02-010.7).
- A `shipped` card → La Campaña active phase = **release**; the build phase's "Entrar a La Fragua" still navigates to the project's Resumen, headed by La Fragua (AC-02-010.5).
- Clicking the build phase's "Entrar a La Fragua" while the card detail is embedded must not reload the embed; it hands off to the host (AC-02-010.5).

## Does NOT include
- No live agent chat or simulation backed by real-time events in La Campaña — it is a faithful, read-only depiction of the per-phase team and the document hand-off across time (the live build animation belongs to FRD-06 / La Fragua, fed by `~/.claude/dashboard-events.ndjson`).
- No new write *from La Campaña*: the tabbed detail and La Campaña add **zero** mutations. The app's writes are the bounded, human-triggered set listed in `docs/product/architecture.md` §7 (amended 2026-10-22, gate fix): idea discard/restore status (REQ-02-007) and the visual favourite flag (REQ-02-012), isolated to this FRD's `lib/discard/` + `lib/favorite/` (ADR-0002, ADR-0003), plus change discard (FRD-04), backlog discard (FRD-22) and the guild ledger (ADR-0005), owned by their own FRDs.
- No mode selector / pause / reset controls in La Campaña (those are demo-only in the prototype; MC is read-only).
- No regeneration of room art or new sprites — assets are reused/added by the design phase, not specified here.

### REQ-02-015 graph-control consistency amendment

(Amended 2026-10-22, v2 plan.) The data-model viewer owns its compact top-right icon toolbar (the `GraphControls` component, with the shared browser-fullscreen hook, ADR-0008); the dependency map no longer renders it (FRD-12 AC-12-004.5, deterministic prototype layout). Model wheel and pointer camera updates are animation-frame batched; fine wheel deltas are normalized, button zoom steps are 15%, and stable entity/edge content is retained during camera movement. Existing model/source/layout/cardinality requirements remain unchanged.

## Persistent navigation integration — FRD-25 (2026-10-17)

The [cross-cutting URL contract](../frd-25-persistent-navigation/frd.md) supersedes earlier local-only tab/detail state, exact-root navigation matching and display-name-derived project addresses in this document. Meaningful selections/filters are URL-owned, legacy links retain their resource and presentation context, and reload/Back/Forward restore that location. Existing visual design, data-read boundaries, action gates and machine-status history remain unchanged. Implementation scope and evidence live in FRD-25's blueprint/work-order record and delivery note.
