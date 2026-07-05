---
id: FRD-01-blueprint
type: blueprint
parent: FRD-01
status: ACTIVE
implementation_status: VERIFIED
last_updated: '2026-06-16'
---
# FRD-01 — Data reading layer — Feature blueprint

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> This is the **feature blueprint** (DR-049): how the data-reading layer is implemented on
> top of the platform. It references the platform architecture
> ([`../../product/architecture.md`](../../product/architecture.md)) — the chosen stack (§2),
> the data model / factory filesystem (§4), the event contract (§5), the `lib/**` boundary
> (§6) and the read-only invariant (§7) — and does **not** restate it.

---

## 0. Scope and the one rule

FRD-01 is **the data layer** — the read interfaces every other feature builds on. It owns the
`lib/**` reader modules that turn the factory filesystem (architecture §4) into typed, serializable
data, plus the **onboarding gate** that fires when `factory/profile.md` is absent.

The platform golden rule (architecture §1) is law here: **read-only, never call Claude.** Every
module in this blueprint is `fs.read*` only. The single write in the whole app
(`lib/discard.ts`) belongs to FRD-02, not here.

This blueprint defines the reader *contracts* (signatures + return types + tolerance rules) so the
feature work orders can be implemented TDD-first against fixtures. `lib/config.ts` already exists
(architecture §6, shipped with the foundation); FRD-01 consumes it and adds the rest.

---

## 1. Components & interfaces

Each reader is a **pure-ish module** in `lib/` (path/handle in → typed data out), unit-tested with
fixtures via `PANDACORP_FACTORY_ROOT`. Components below are the modules; interfaces are their
exported function contracts. All types are serializable (cross the Server→Client boundary cleanly).

| ID | Kind | Artifact | Responsibility | Traces |
|---|---|---|---|---|
| `CMP-01-config` | module | `lib/config.ts` ✅ | Path constants + `resolveFactoryRoot`. **Already shipped** with the foundation. | REQ-01-001 |
| `CMP-01-ideas` | module | `lib/ideas.ts` | Read & parse all idea cards (gray-matter). | REQ-01-003 |
| `CMP-01-profile` | module | `lib/profile.ts` | Read the owner profile; **signal absence** for the onboarding gate. | REQ-01-002 / REQ-01-008 |
| `CMP-01-portfolio` | module | `lib/portfolio.ts` | Parse the portfolio markdown table → project rows (path + repo + business columns). | REQ-01-004 |
| `CMP-01-status` | module | `lib/status.ts` | Read & validate `<projectPath>/.pandacorp/status.yaml`, partial-tolerant. | REQ-01-005 / REQ-01-006 |
| `CMP-01-docs` | module | `lib/docs.ts` | Discover the feature-centric `docs/` tree + `.pandacorp/` comms per project (existence + read). | REQ-01-007 |
| `CMP-01-events` | module | `lib/events.ts` | Tail & parse `dashboard-events.ndjson` (capped) + state diffs (last-event ts, age-in-stage). | REQ-01-009 |
| `CMP-01-onboarding-gate` | UI (Server + client copy) | `app/layout.tsx` guard + `components/OnboardingGate.tsx` | Render the gate before any view when no profile. | REQ-01-001 (onboarding) |
| `IF-01-readProfile` | interface | `readProfile(): ProfileResult` | `{ present: false } \| { present: true; profile: Profile }`. Absence is **explicit**, never invented. | REQ-01-002 / REQ-01-008 |
| `IF-01-readIdeas` | interface | `readIdeas(): IdeaCard[]` | All cards in `IDEAS_DIR`, skipping `NON_IDEA_FILES`; frontmatter + body. | REQ-01-003 |
| `IF-01-readPortfolio` | interface | `readPortfolio(): PortfolioEntry[]` | Project rows from the table; tolerate broken/empty rows. | REQ-01-004 |
| `IF-01-readStatus` | interface | `readStatus(projectPath): StatusResult` | `{ present, malformed, status: Partial<ProjectStatus> }`. Never throws on absent/malformed. | REQ-01-005 / REQ-01-006 |
| `IF-01-readProjectDocs` | interface | `readProjectDocs(projectPath): ProjectDocsIndex` | Discover product layer + per-FRD modules + global + `.pandacorp/` comms. | REQ-01-007 |
| `IF-01-readEvents` | interface | `readEvents(opts?): EventsSnapshot` | Capped tail of NDJSON parsed to `Event[]` + derived `{ lastEventAt, byProject }`. | REQ-01-009 |
| `IF-01-pathExists` | interface | `pathExists(p): boolean` | Read-only existence probe (used by status/docs/portfolio not-found marking). | REQ-01-010 |

> **`visto_hasta` marker (REQ-01-008 dashboard seen-marker)** is **client-local UI state**
> (`localStorage`), NOT a `lib/` reader and NOT a factory write. It is owned by FRD-18; FRD-01 only
> states the constraint that it is not a write. No component here.

---

## 2. Type contracts (the data-layer surface)

Defined alongside their modules (or in `lib/types.ts` if shared). Shapes mirror architecture §4.

```ts
// lib/profile.ts
type Profile = {
  name?: string;
  goals?: string;
  interests?: string[];
  assets?: string[];
  projectsPath?: string;   // bounds the FRD-16 orphan scan
  body: string;            // markdown body for personalized views
};
type ProfileResult = { present: false } | { present: true; profile: Profile };

// lib/ideas.ts
type IdeaStatus = "discovered" | "recommended" | "in-pipeline" | "shipped" | "discarded";
type IdeaCard = {
  slug: string;            // filename without .md
  title: string;
  status: IdeaStatus;
  projectType?: string;    // project_type chip
  returnType?: "monetary" | "opportunity" | "personal" | "mixed";
  score?: number;
  project?: string;        // path filled once in-pipeline (pointer)
  body: string;            // markdown summary + key points
};

// lib/portfolio.ts
type PortfolioEntry = {
  name: string;
  path: string;            // raw path cell (may be relative or "inside the factory")
  repo?: string;           // repo URL, "—"/empty normalized to undefined
  originIdea?: string;
  phase?: string;          // table cell (advisory; status.yaml is authoritative)
  users?: string;          // business snapshot (FRD-03)
  returnMetric?: string;
  verdict?: string;
  lastSync?: string;
};

// lib/status.ts
type Phase = "product" | "design" | "architecture" | "implementation" | "release";
type ProjectStatus = {
  // Reconciled from code 2026-07-05 (DR-092/DR-115): `progress`/`workOrdersTotal`/
  // `workOrdersDone` removed — dead status.yaml replica fields with no display reader.
  // WO counts derive live via listWorkOrders/aggregateProgress.
  project: string; phase: Phase; version: string; running: boolean;
  pendingDecisions: number; pendingBugs: number; rethinkPending: boolean;
  advancePending: boolean; lastGreenSha: string; safeToTest: boolean;
  overlayVersion?: string; createdWith?: string; updatedAt?: string; repo?: string;
};
type StatusResult =
  | { present: false; malformed: false; status: null }
  | { present: true; malformed: boolean; status: Partial<ProjectStatus> };

// lib/events.ts  (schema = architecture §5)
type Event = {
  event: string; at: string; agent?: string; session?: string;
  tool?: string; status?: "ok" | "fail"; workOrder?: string; task?: string;
  project?: string;        // optional; missing ⇒ legacy/global (CLAUDE.md)
};
type EventsSnapshot = {
  events: Event[];                          // capped tail (default 200)
  lastEventAt: string | null;
  byProject: Record<string, { lastEventAt: string }>;  // for live/no-signal + age-in-stage
};

// lib/docs.ts
type FrdModule = {
  slug: string; hasFdd: boolean; hasBlueprint: boolean;
  hasMocks: boolean; hasWorkOrders: boolean;
};
type ProjectDocsIndex = {
  prd?: string; architecture?: string;        // product layer (paths present)
  frds: FrdModule[];                           // per-feature modules discovered
  hasAdr: boolean; hasAnalytics: boolean; hasDecisionLog: boolean;
  comms: { progress?: string; decisions?: string; bugs: string[] };  // .pandacorp/ (gitignored)
};
```

---

## 3. Tolerance rules (cross-cutting, architecture §7)

Every reader is **fail-soft** — a missing or malformed input yields a partial/empty result, never a
throw or a blank screen:

- `readProfile` → `{ present: false }` on absent file (drives the gate, REQ-01-001).
- `readIdeas` → skips `NON_IDEA_FILES`; a card with unparseable frontmatter is skipped (logged),
  not fatal; empty folder → `[]` (REQ-01 edge case).
- `readPortfolio` → empty/missing file → `[]`; rows missing cells degrade to `undefined` fields.
- `readStatus` → absent → `{ present: false }`; malformed YAML → `{ present: true, malformed: true,
  status: {} }`; partial keys tolerated (REQ-01-005/006, edge case).
- `readProjectDocs` → only reports what exists; absent layers → empty/false.
- `readEvents` → missing NDJSON → empty snapshot; a malformed line is skipped, valid lines kept;
  tail capped at 200 (architecture §3/§5).
- `pathExists` → never throws; a not-found project is **marked**, the rest of the view survives
  (REQ-01-010).

---

## 4. Platform surfaces used / created

- **`lib/**` boundary** (architecture §6): this feature creates `ideas`, `profile`, `portfolio`,
  `status`, `docs`, `events` and a small `pathExists` helper (place in `lib/fs-utils.ts` or inside
  `config.ts` — proposed: **`lib/fs-utils.ts`**, a new tiny module; noted for the report).
- **App surface** (architecture §11): FRD-01 is cross-cutting (no page of its own) **except** the
  onboarding gate, which lives in the root `app/layout.tsx` render path
  (`components/OnboardingGate.tsx`). The gate renders the `/pandacorp:onboarding` command with a
  copy button (the shared `components/CopyButton.tsx` is introduced by FRD-02/03; FRD-01 may ship a
  minimal copy affordance or depend on it — see WO ordering).
- **No route handlers** (those are FRD-15/16 only).

---

## 5. Requirement → component traceability (REQ-01-MMM)

The FRD lists its acceptance criteria as EARS bullets; numbered here in order for traceability.

| REQ | Acceptance criterion (abridged) | Component(s) / interface(s) |
|---|---|---|
| REQ-01-001 | No `profile.md` → onboarding gate before any view, with copy command. | `CMP-01-onboarding-gate`, `IF-01-readProfile` |
| REQ-01-002 | `profile.md` present → read it to personalize. | `CMP-01-profile`, `IF-01-readProfile` |
| REQ-01-003 | Read all `factory/ideas/*.md` (skip template/log) + frontmatter. | `CMP-01-ideas`, `IF-01-readIdeas` |
| REQ-01-004 | Read `factory/portfolio.md` → projects + paths. | `CMP-01-portfolio`, `IF-01-readPortfolio` |
| REQ-01-005 | Read each project's `status.yaml` (phase, version, running, last_green_sha, safe_to_test). WO counts derive live from the work-order files (`listWorkOrders`), decisions/bugs from the live inbox (`readStatusWithLiveInboxCounts`) — never the status.yaml counters (DR-092/DR-115). | `CMP-01-status`, `IF-01-readStatus` |
| REQ-01-006 | In-pipeline card → column from project `phase` (status.yaml is the single source). | `CMP-01-status` (provides phase; column derivation = FRD-02 `lib/board.ts`) |
| REQ-01-007 | Read per-project feature-centric `docs/` + `.pandacorp/` comms. | `CMP-01-docs`, `IF-01-readProjectDocs` |
| REQ-01-008 | Read event stream → diffs, live/no-signal, age-in-stage. (`visto_hasta` = client-local, FRD-18.) | `CMP-01-events`, `IF-01-readEvents` |
| REQ-01-009 | Persist `visto_hasta` as client-local UI state (not a factory write). | *(FRD-18; constraint only — no component here)* |
| REQ-01-010 | Project path missing → mark not-found, don't break the view. | `IF-01-pathExists`, `CMP-01-status` tolerance |
| REQ-01-011 | NEVER call Claude / never write (except FRD-02 discard). | cross-cutting invariant (all readers `fs.read*`) |

> Note: REQ numbering maps the FRD's EARS bullets in document order (001 = first bullet … 011 = last
> bullet, "never call Claude/write"). The onboarding-gate criterion and the "personalize" criterion
> are split into REQ-01-001 and REQ-01-002.

---

## 6. AC ⇄ design check (acceptance-criteria reconciliation)

- Onboarding gate "before any other view" → enforced in `app/layout.tsx` (server guard reads
  `readProfile` and short-circuits to the gate). ✅
- "single source of truth for phase" → `lib/status.ts` exposes `phase`; the column map lives in
  FRD-02 (`lib/board.ts`) which consumes it. No duplication. ✅
- "never break the rest of the view" → §3 tolerance rules + `pathExists`. ✅
- Event cap (architecture §3) → `readEvents` default cap 200. ✅

No FRD-01 criterion is unbuildable on the platform.

## 7. Build Plan (Phase 2 — the shared live transport, FND-5)

The data-reading layer is **VERIFIED and frozen** (WO-01-000..008 — the readers/parsers; the Phase-2
gap is presentational, not in `lib/`). Phase 2 adds ONE new piece here: the real-time wire.

- **Already VERIFIED (do NOT rebuild):** WO-01-000..008 — `pathExists`, `readProfile`, `readIdeas`,
  `readPortfolio`, `readStatus`, `readProjectDocs`, `readEvents`, onboarding gate.
- **Foundation wave (`foundation: true`):**
  - **WO-01-009 (FND-5)** — the shared SSE transport (`app/api/live/route.ts`) + the `useLiveSnapshot`
    hook, built **on the existing readers** (no `lib/` parsing re-implemented). Read-only; pushes deltas.
- **Cross-FRD deps:** none upstream. **Downstream (real-time consumers that depend on `frd-01`):**
  FRD-05 (Work orders), FRD-06 (Party), FRD-12 (Observabilidad), FRD-18 (Inicio) — each subscribes to
  its own event slice via `useLiveSnapshot`, replacing any polling.
- **Gate:** SSE delivers an appended event to a subscribed client; `?project=` slices correctly; no leak
  on unmount; defensive on missing/locked files. Its `## Status Note` publishes the frame + hook contract.
