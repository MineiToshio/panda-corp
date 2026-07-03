---
id: FRD-04-blueprint
type: blueprint
parent: FRD-04
status: ACTIVE
implementation_status: VERIFIED
last_updated: '2026-07-03'
---
# FRD-04 — Project workspace · feature blueprint

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> This is the **per-FRD blueprint** (DR-049): how *this* feature is implemented on top of the
> platform. It references the platform architecture
> ([`../../product/architecture.md`](../../product/architecture.md)) rather than restating it.
> Visual reference: the approved `prototype/index.html` (`projectPane`, `projResumen`,
> `progressBar`, `decisionesBox`, `logBox`, `projComandos`).

## 0. Scope & traceability note

The FRD's acceptance criteria are bare EARS bullets. This blueprint assigns the canonical
traceability IDs (`REQ-04-MMM` → `AC-04-MMM.K`) consumed by the work orders. Each EARS bullet of
`frd.md` maps 1:1 to a `REQ-04-MMM` in source order.

This feature is the **shell** that hosts the per-project tabs. Two tabs are owned by other FRDs and
only **mounted** here:
- **Work orders** tab → [FRD-05](../frd-05-work-orders/blueprint.md) (`CMP-05-*`).
- **Party** tab → [FRD-06](../frd-06-party/frd.md) (`CMP-06-*`).
- The **build mode selector** inside the Commands tab → [FRD-11](../frd-11-build-modes/blueprint.md) (`CMP-11-*`).

FRD-04 owns the **workspace chrome** (tab bar, header, "Mission Objectives" bar) and the tabs it
implements directly: **Summary**, **Changes**, **Documents**, **Commands** (the command list; the
mode selector is FRD-11's component slotted in).

## 1. Requirements (derived IDs)

| REQ | EARS (from `frd.md`) |
|---|---|
| REQ-04-001 | The workspace SHALL offer tabs in order **Summary · Work orders · Changes · Party · Observability · Documents · Commands**. |
| REQ-04-002 | The header SHALL show title, stage, version, the `progress` line and a **"Mission Objectives"** bar (% of work orders completed), visible on all tabs. |
| REQ-04-003 | The **Summary** tab SHALL show summary, key points, **decision points** (highlighted, with a count) and a high-level **activity log**, read from `.pandacorp/inbox/decisions.md` and `.pandacorp/comms/progress.md`. |
| REQ-04-004 | WHEN there are pending decisions, the workspace SHALL highlight them. |
| REQ-04-005 | The **Commands** tab SHALL show the stage-relevant commands (continue `implement`, `release`, `iterate`, with when to use each) and the **build mode selector** (FRD-11). |
| REQ-04-006 | The **Documents** tab SHALL allow navigating and reading the project's documents rendered. |
| REQ-04-007 | The **Changes** tab SHALL list the project's change queue (`.pandacorp/inbox/changes/` + archived `done/`), grouped by status, with a detail modal per item carrying a targeted `implement change:<id>` command. |
| REQ-04-008 | WHEN a Changes-tab item is ready/draft, its detail modal SHALL offer a **"Descartar"** action that rewrites `status: discarded` (ADR-0002 pattern) and closes the modal on success; never offered for done/already-discarded items. |
| REQ-04-009 | The Changes tab SHALL show Listos/Borradores by default and hide Hechos/Descartados behind "Ver hechos (N)" / "Ver descartados (N)" toggles. |

### Acceptance criteria (EARS, expanded)

- **AC-04-001.1** GIVEN a selected project, the workspace SHALL render exactly seven tabs in the
  order Summary, Work orders, Changes, Party, Observability, Documents, Commands.
- **AC-04-001.2** WHEN no tab is explicitly selected, the workspace SHALL default to **Summary**.
- **AC-04-002.1** The header SHALL render `title`, the stage label (from `phase`), `version` and the
  `progress` string when present; when `progress` is absent the line is omitted (no empty line).
- **AC-04-002.2** The Mission Objectives bar SHALL show `work_orders_done / work_orders_total` and the
  percentage; WHEN `work_orders_total` is 0 or absent the bar is omitted.
- **AC-04-002.3** The header and Mission Objectives bar SHALL be visible regardless of the active tab.
- **AC-04-003.1** The Summary tab SHALL render the project summary and key points.
- **AC-04-003.2** The Summary tab SHALL render the activity log read from `.pandacorp/comms/progress.md`;
  WHEN the file is absent it SHALL show a graceful "no activity yet" empty state.
- **AC-04-003.3** The Summary tab SHALL render the decision points read from `.pandacorp/inbox/decisions.md`,
  each highlighted, with a total count badge.
- **AC-04-004.1** WHEN `pending_decisions > 0`, the decision points block SHALL be visually highlighted
  (warning treatment) and show the count; otherwise it SHALL show a neutral "no pending points" state.
- **AC-04-005.1** The Commands tab SHALL render the stage-relevant command rows from `lib/next-step.ts`,
  each with a copy button and a "when to use" description.
- **AC-04-005.2** The Commands tab SHALL mount the FRD-11 build mode selector (`CMP-11-mode-selector`).
- **AC-04-006.1** The Documents tab SHALL render the feature-centric document tree (nav) from `lib/docs.ts`.
- **AC-04-006.2** WHEN a document is selected, the Documents tab SHALL render its markdown body
  (`react-markdown`); the first available document is selected by default.
- **AC-04-006.3** WHEN the project has no readable documents, the Documents tab SHALL show a graceful empty state.
- **AC-04-006.4** Every Documents-tab navigation link (doc tree AND in-document links) SHALL preserve the embedding context — carry `?project` and `tab=documents` — so selecting a document never drops to the Summary tab; the document body SHALL render at the **full width** of the reader pane (no fixed measure cap).
- **AC-04-006.5** WHEN a document body contains a link, the reader SHALL resolve it: a relative path to a document the tree surfaces → opens in the **same reader** (`?project&tab=documents&doc=<id>`); an off-app URL (http/https/mailto) → new tab; any other relative path → **plain, non-clickable text** (no 404).
- **AC-04-007.1** The Changes tab SHALL group change-queue items by status — **ready · draft · done · discarded** — rendering a section (with count) per non-empty group; a project with no queue items SHALL show a graceful empty state.
- **AC-04-007.2** WHEN the reader cannot interpret one or more files (invalid/missing `type` or `status`, or a body with no H1 title), the tab SHALL render a fail-loud error banner naming the offending file(s) (DR-078) — never a misleadingly-empty list.
- **AC-04-007.3** Clicking a card SHALL open a detail modal showing type, urgency (`expedite` only), status, date, affected FRD, dependencies, a warning when `rebuilds_verified`, the body as titled colour-coded sections, and a copyable `/pandacorp:implement change:<id>` command scoped to that item's real id.
- **AC-04-008.1** WHEN the selected item's status is `ready` or `draft`, the detail modal SHALL render a "Descartar" button; a `done` or `discarded` item SHALL never show it.
- **AC-04-008.2** Clicking "Descartar" SHALL show an INLINE confirm step ("¿Descartar este cambio?" + Sí/No) — never a second `Modal` nested inside the detail modal already open.
- **AC-04-008.3** Confirming SHALL call the `discardChange` write, which rewrites `status: discarded` and records `status_before_discard` (the prior value), preserving the body and every other frontmatter field verbatim (the same bounded-write pattern as `discardIdea`, ADR-0002) — never touching any sibling file.
- **AC-04-008.4** WHEN the write succeeds, the detail modal SHALL close and the change-queue list SHALL refresh (via `revalidatePath`) so the item disappears from the default Listos/Borradores view.
- **AC-04-008.5** WHEN the write fails (`not-found` / `parse-error` / `not-discardable`), the button SHALL revert to idle and show a Spanish error message; the modal SHALL stay open.
- **AC-04-009.1** GIVEN the Changes tab has any items, ONLY the **Listos** and **Borradores** groups SHALL render by default; **Hechos** and **Descartados** SHALL be hidden.
- **AC-04-009.2** A "Ver hechos (N)" / "Ver descartados (N)" toggle button SHALL render for each of those two buckets **only when it has at least one item**; clicking it SHALL reveal that bucket's section (button label flips to "Ocultar …") and clicking again SHALL hide it.

## 2. Interfaces (`lib/**`)

This feature **owns** `lib/docs.ts` (shared with FRD-05/08) and **extends** `lib/status.ts` (base
shipped by FRD-01) and `lib/next-step.ts` (base shipped by FRD-02). It consumes — never re-reads —
the platform readers per [architecture §6](../../product/architecture.md#6-read-interfaces-lib--the-data-layer-boundary).

### IF-04-docs — `lib/docs.ts` (NEW, owned here)
Pure readers over the feature-centric `docs/` tree and the owner-facing `.pandacorp/` comms.

```ts
// Path in → typed data out. Tolerates missing files (returns empty, never throws on absence).
export interface DocNode {
  id: string;          // stable key, e.g. "product/prd" | "frds/frd-02-ideas-board/frd"
  label: string;       // display name, e.g. "prd.md"
  group: string;       // "Product" | "Feature: frd-NN-<slug>" | "Global" | "Comms"
  relPath: string;     // path relative to the project root
}
export function listProjectDocs(projectPath: string): DocNode[];      // discovers the tree (§4.5)
export function readDoc(projectPath: string, relPath: string): string | null; // raw markdown or null
export interface ActivityLog { entries: string[]; }                  // from .pandacorp/comms/progress.md
export function readActivityLog(projectPath: string): ActivityLog;    // [] when absent
export interface DecisionPoint { title: string; recommendation?: string; resolved: boolean; }
export function readDecisions(projectPath: string): DecisionPoint[];  // from .pandacorp/inbox/decisions.md; [] when absent
```

> `readDoc` only returns paths that `listProjectDocs` would surface (no arbitrary path traversal —
> the `relPath` is validated against the discovered set). Read-only; never writes.

### IF-04-status — `lib/status.ts` (EXTENDS FRD-01 base)
FRD-01 ships the base parser. FRD-04 relies on the already-defined fields
(`phase`, `version`, `progress`, `work_orders_total`, `work_orders_done`, `pending_decisions`) —
no new fields are added by FRD-04. Header/objectives read these. Partial-tolerant (architecture §4.4).

### IF-04-next-step — `lib/next-step.ts` (EXTENDS FRD-02 base)
Pure map `phase → { commands: CommandRow[] }`. FRD-02 ships the base for pre-project statuses;
FRD-04 adds the **building/release** command sets used by the Commands tab.

```ts
export interface CommandRow { command: string; when: string; } // "/pandacorp:implement", "continue/resume the build"
export function workspaceCommands(phase: Phase): CommandRow[];  // pure; no fs
```

### IF-04-changes — `lib/changes.ts` (NEW, owned here)
Pure reader over a project's change queue. Read-only, fail-loud (DR-078) — never re-implemented by
another surface (Mission Control's own factory-level backlog reader, `lib/backlog.ts`, is a
different, unrelated data source: `factory/backlog/` vs. this project's `.pandacorp/inbox/changes/`).

```ts
export type ChangeQueueStatus = "ready" | "draft" | "done" | "discarded";
export interface ChangeQueueItem {
  id: string;               // filename stem — the same slug `implement change:<id>` expects
  type: "bug" | "feature" | "change";
  cls: "expedite" | "standard" | "intangible" | "fixed-date"; // defaults to "standard"
  status: ChangeQueueStatus;
  date: string; frd: string; rebuildsVerified: boolean; dependsOn: string;
  title: string; body: string; // title = body's first H1; body = the rest
}
export interface ChangeQueueReadResult {
  items: ChangeQueueItem[];
  errors: { file: string; reason: string }[]; // fail-loud, DR-078 — never silently empty
}
export function readChangeQueue(projectPath: string): ChangeQueueReadResult;
```

> Scans `.pandacorp/inbox/changes/*.md` + archived `.../changes/done/*.md`; skips `README.md` and
> `_*` templates. A missing/invalid `type` or `status`, or a body with no H1 title, surfaces in
> `errors[]` — never silently dropped. Read-only; never writes.

### IF-04-discard-change — `lib/changes/discard-change.ts` (NEW, owned here)
The Changes tab's one write (REQ-04-008) — mirrors `lib/discard/discard.ts` (the idea-card discard
write, ADR-0002) exactly, scoped to a project's active `.pandacorp/inbox/changes/` instead of
`factory/ideas/`. Rewrites `status` in place (no file move — unlike `done/`, DR-069's archival move).

```ts
export type DiscardChangeResult =
  | { ok: true }
  | { ok: false; reason: "not-found" | "parse-error" | "not-discardable" };
export function discardChange(projectPath: string, id: string): DiscardChangeResult;
```

> Only `status: ready` or `status: draft` items are discardable — `done` and already-`discarded`
> items return `not-discardable` (file untouched). On success, sets `status: discarded` and records
> `status_before_discard` (the prior value, for a future restore), preserving the body and every
> other frontmatter field verbatim. Path-traversal + symlink guards match `discardIdea`.

## 3. Components (`CMP-04-*`) and app surface

App surface (architecture §11): `app/projects/[slug]` is the workspace, reached from the FRD-03
portfolio rail. In the prototype this is `projectPane`; here it is decomposed into Server Components
(default) with a thin client tab-state holder.

| Component | Kind | Responsibility | Implements |
|---|---|---|---|
| `CMP-04-workspace` | Server | Loads project (status + docs + decisions + log via `lib/**`), renders header + tab bar + active tab. | REQ-04-001, REQ-04-002 |
| `CMP-04-tabbar` | Client | Tab selection state (URL `?tab=` or local), keyboard-navigable, a11y `role=tablist`. | REQ-04-001 |
| `CMP-04-header` | Server | Title, stage, version, progress line. | REQ-04-002 |
| `CMP-04-objectives-bar` | Server | "Mission Objectives" progress bar (done/total, %). | REQ-04-002 |
| `CMP-04-tab-summary` | Server | Summary + key points + `CMP-04-decisions` + `CMP-04-activity-log`. | REQ-04-003 |
| `CMP-04-decisions` | Server | Decision points block, highlighted with count. | REQ-04-003, REQ-04-004 |
| `CMP-04-activity-log` | Server | High-level activity log list. | REQ-04-003 |
| `CMP-04-tab-documents` | Server | Doc nav (`DocNode[]`) + rendered markdown body. | REQ-04-006 |
| `CMP-04-tab-commands` | Server | Stage command rows + slot for `CMP-11-mode-selector`. | REQ-04-005 |
| `CMP-04-tab-changes` | Server | Reads the queue via `IF-04-changes`, hands it to the client panel. | REQ-04-007 |
| `CMP-04-changes-panel` | Client | Groups items by status (Listos/Borradores always visible; Hechos/Descartados behind a toggle), fail-loud error banner, empty state, detail modal. | REQ-04-007, REQ-04-009 |
| `CMP-04-change-card` | Client | One queue item: type icon, id, urgency chip (expedite only), title, date · FRD. Imported by the client panel (no own `"use client"` needed, same pattern as `CMP-22-card`). | REQ-04-007 |
| `CMP-04-change-detail` | Client | Modal body: chips, meta-lines, rebuilds-verified warning, `SectionedMarkdown`, targeted `implement change:<id>` command, discard button (ready/draft only). | REQ-04-007, REQ-04-008 |
| `CMP-04-discard-change` | Client | "Descartar" button with an INLINE confirm step (no nested modal); `useTransition`, prop-injected Server Action, idle/confirming/pending/done/error states. | REQ-04-008 |
| `CMP-04-discard-change-action` | Server Action | Delegates to `IF-04-discard-change`, revalidates `/projects/<slug>` + `/portfolio` on success. | REQ-04-008 |
| `IF-04-docs` | lib | The `docs.ts` readers above. | REQ-04-003, REQ-04-006 |
| `IF-04-changes` | lib | The `changes.ts` reader above. | REQ-04-007 |
| `IF-04-discard-change` | lib | The `discard-change.ts` write above. | REQ-04-008 |

**Mounted, not owned:** the Work orders tab renders `CMP-05-board`; the Party tab renders
`CMP-06-*`; the Commands tab slots `CMP-11-mode-selector`. The workspace passes `projectPath`/slug
down; it does not implement those panels.

## 4. Cross-cutting

- **Read-only**: all access via `lib/**` readers; no writes (the only write in the app is FRD-02
  discard). The `.pandacorp/inbox/decisions.md` / `comms/progress.md` reads are owner-facing Spanish
  files — rendered as-is, never transmitted (architecture §7).
- **Empty/partial states**: every reader tolerates absence; the workspace renders partial data and
  never crashes (architecture §7, FRD-01 edge cases).
- **Tokens & a11y**: UI strings in Spanish (i18n), `tabular-nums` on the objectives counts, tabs are
  `role=tablist`/`aria-selected`, no state-by-color-alone (FRD-13).
- **Server-first**: only `CMP-04-tabbar` is `"use client"`; everything else is a Server Component.

## 5. Traceability matrix

| REQ | AC | Component(s) | Interface(s) |
|---|---|---|---|
| REQ-04-001 | AC-04-001.1/.2 | CMP-04-workspace, CMP-04-tabbar | — |
| REQ-04-002 | AC-04-002.1/.2/.3 | CMP-04-header, CMP-04-objectives-bar | IF-04-status |
| REQ-04-003 | AC-04-003.1/.2/.3 | CMP-04-tab-summary, CMP-04-decisions, CMP-04-activity-log | IF-04-docs |
| REQ-04-004 | AC-04-004.1 | CMP-04-decisions | IF-04-status, IF-04-docs |
| REQ-04-005 | AC-04-005.1/.2 | CMP-04-tab-commands (FRD-11) | IF-04-next-step |
| REQ-04-006 | AC-04-006.1/.2/.3 | CMP-04-tab-documents | IF-04-docs |
| REQ-04-007 | AC-04-007.1/.2/.3 | CMP-04-tab-changes, CMP-04-changes-panel, CMP-04-change-card, CMP-04-change-detail | IF-04-changes |
| REQ-04-008 | AC-04-008.1/.2/.3/.4/.5 | CMP-04-change-detail, CMP-04-discard-change, CMP-04-discard-change-action | IF-04-discard-change |
| REQ-04-009 | AC-04-009.1/.2 | CMP-04-changes-panel | IF-04-changes |

## 6. Build Plan (Phase 2)

Re-implement the workspace **presentation** to match the approved prototype (`projectPane`). The
`lib/**` layer is correct and **VERIFIED** (WO-04-001 `lib/docs.ts`, WO-04-003 `workspaceCommands`) and
is **not** rebuilt. The Comandos tab moved to FRD-11; the Documentos tab folded into WO-04-005.

**Coarse work orders (PLANNED):**

| WO | Surface | Disjoint artifacts |
|---|---|---|
| WO-04-004 | Shell: header + tabbar (6 tabs incl. **Observabilidad**) + objectives bar | `src/app/projects/[slug]/page.tsx`, `_components/{workspace-header,tabbar,objectives-bar}.tsx` |
| WO-04-005 | Resumen tab + Documentos tab | `_components/tab-summary/**`, `_components/tab-documents/**` |

**DAG & parallelism:**
```
WO-04-001 (VERIFIED) ─┐
WO-04-003 (VERIFIED) ─┼─► WO-04-004 (shell, provides Tabbar seam) ─► WO-04-005 (Resumen + Documentos)
FRD-13 foundation ────┘
```
- **WO-04-004 runs first** — it is the **provider**: it defines the Tabbar (the six-tab mount seam) that
  the tab FRDs plug into. It is sequential before WO-04-005 (which mounts into its tab bodies).
- **WO-04-005** runs after the shell. Its two tabs touch **disjoint** subfolders
  (`tab-summary/**` vs `tab-documents/**`), so its internals are independently testable.
- Disjoint artifacts guarantee no same-file collision with the sibling tab FRDs, which own **other**
  subfolders of `_components/` (FRD-05 `wo-*`, FRD-06 `_party`, FRD-12 `_observability`, FRD-14
  `snapshot-panel`, FRD-11 `{mode-selector,tab-commands}`).

**Cross-FRD deps:** `frd-13` (foundation primitives every UI WO consumes). FRD-04 is itself the
**provider** of the Tabbar seam: `frd-05`, `frd-06`, `frd-11`, `frd-12`, `frd-14` depend on `frd-04`.

**In-loop fidelity:** every UI WO renders against `prototype/index.html` (`projectPane`, `projResumen`,
`projDocs`, `progressBar`) on the frozen tokens; the browser fidelity/smoke gate must be clean before
VERIFIED. Reuse `docs/design/components.md` rows — no bespoke title/tab/banner/card forks (DR-057/062).
