# Mission Control — API Contract

> **Source-of-truth hierarchy:** `FRD > design-tokens > blueprint > work order > this file`.
> This document describes the **pure TypeScript interfaces** and **shared component contracts**
> produced by each work order. There are no HTTP endpoints in this scope — Mission Control is a
> local, read-only Next.js app that reads files from the factory filesystem. The "API" here is the
> **internal module and component contract** that downstream features consume.
>
> Status: **complete for WO-01-000** (test fixtures + harness) +
> **complete for WO-01-001** (IF-01-pathExists, `lib/fs-utils.ts`) +
> **complete for WO-01-002** (IF-01-readProfile, `lib/profile.ts`) +
> **complete for WO-01-003** (IF-01-readIdeas, `lib/ideas.ts`) +
> **complete for WO-01-004** (IF-01-readPortfolio, `lib/portfolio.ts`) +
> **complete for WO-01-005** (IF-01-readStatus, `lib/status.ts`) +
> **complete for WO-01-006** (IF-01-readProjectDocs, `lib/docs.ts`) +
> **complete for WO-01-007** (IF-01-readEvents, `lib/events.ts`) +
> **complete for WO-13-001** (IF-13-tokens, IF-13-agent-colors, IF-13-state-vocab) +
> **complete for WO-02-002** (CMP-02-copy-button) +
> **complete for WO-02-001** (IF-02-deriveColumn, `lib/board.ts`).

---

## WO-02-001: `deriveColumn` — two-axis kanban column derivation

**Module:** `lib/board.ts`
**Traces:** CMP-02-board-derive, IF-02-deriveColumn; REQ-02-001; AC-02-001.1..6
**Dependencies:** WO-01-003 (`IdeaCard` from `lib/ideas.ts`), WO-01-005 (`StatusResult` from `lib/status.ts`)

### IF-02-deriveColumn

```ts
// lib/board.ts

export type BoardColumn =
  | "discovered"
  | "documented"
  | "design"
  | "architecture"
  | "building"
  | "shipped"
  | "discarded";

/**
 * Derive the kanban column for an idea card from two axes:
 *   1. The card's `status` field (IdeaCard from lib/ideas.ts).
 *   2. The linked project's `phase` field (StatusResult from lib/status.ts).
 *
 * Pure function: no fs, no writes, no network, no side effects. Never throws.
 *
 * @param card          - The parsed idea card from readIdeas.
 * @param projectStatus - The parsed project status from readStatus, or null when
 *                        no project path was resolved.
 * @returns The BoardColumn the card belongs in. Never throws (AC-02-001.6).
 */
export function deriveColumn(card: IdeaCard, projectStatus: StatusResult | null): BoardColumn;
```

### Mapping table (blueprint §2, REQ-02-001)

| Card `status` | Project `phase` | Column |
|---|---|---|
| `discovered` | — | `discovered` |
| `recommended` | — | `discovered` (+ "recommended" badge on the card) |
| `in-pipeline` | `product` | `documented` |
| `in-pipeline` | `design` | `design` |
| `in-pipeline` | `architecture` | `architecture` |
| `in-pipeline` | `implementation` | `building` |
| `in-pipeline` | `release` | `building` |
| `in-pipeline` | `operation` | `shipped` |
| `in-pipeline` | missing / absent / malformed / undefined | `documented` (fallback, AC-02-001.6) |
| `shipped` | — | `shipped` |
| `discarded` | — | `discarded` |

### Invariants

- **Pure:** no I/O, no writes, no network, no Claude calls, no side effects.
- **Never throws** (AC-02-001.6 "without breaking"): all fallback paths are safe.
- **No invalid card statuses produce wrong columns** (AC-02-001.5): `design`, `architecture`,
  `building` can never be card statuses (they come from project phase only). If an invalid
  status reaches the function at runtime, it returns `"discovered"` and does not throw.
- **Deterministic:** same inputs always produce the same output.
- **Input objects are never mutated.**
- **Regression B1' (2026-06-16):** `readStatus` rejects NaN/invalid phase upstream; `deriveColumn`
  receives `phase: undefined` in that case and falls back to `documented`.
- **Regression I3 (2026-06-16):** `readStatus` rejects array-typed phase values; same fallback applies.

### Fallback conditions for `in-pipeline` cards (AC-02-001.6)

All three cases below produce `"documented"` and never throw:

| Condition | Fallback |
|---|---|
| `projectStatus` is `null` | `documented` — no project path was resolved |
| `projectStatus.present === false` | `documented` — `status.yaml` absent or project missing |
| `projectStatus.status.phase === undefined` | `documented` — malformed YAML, missing key, or upstream rejection (B1', I3) |

### Re-exports

`lib/board.ts` re-exports `IdeaCard` (from `lib/ideas.ts`) and `StatusResult` (from `lib/status.ts`)
so downstream consumers can import all board-related types from a single module.

### Consumption (downstream features)

- **`app/board/page.tsx`** (CMP-02-board-view, WO-02-005): calls `deriveColumn(card, readStatus(card.project))` for each idea card to place it in the correct column.
- **`components/IdeaCard.tsx`** (CMP-02-card): receives `BoardColumn` from the page; adds "recommended" badge when `card.status === "recommended"` and `column === "discovered"`.

---

## WO-01-000: Test fixtures + `PANDACORP_FACTORY_ROOT` harness

**Module:** `tests/fixtures/index.ts` (+ static fixture tree under `tests/fixtures/`)
**Traces:** AC-01-000.1, AC-01-000.2, AC-01-000.3; enables REQ-01-001..011

### Purpose

Provides a deterministic filesystem fixture tree and an environment-isolation helper so every
`lib/` reader can be unit-tested in isolation. No reader WO is testable without this foundation.

### Invariants (all readers, inherited by every downstream WO)

- **Read-only.** Every `lib/` function only reads files (`fs.read*`). No writes.
- **Never calls Claude.** No AI SDK, no HTTP egress.
- **Fail-soft.** Missing or malformed inputs yield a typed partial/empty result, never a throw.
- **Serializable.** All return types cross the Next.js Server→Client boundary cleanly
  (no class instances, no functions, no `Date` objects — use ISO 8601 strings for timestamps).

### Test harness exports

```ts
// tests/fixtures/index.ts

/** Absolute path to the fixtures directory. */
export const FIXTURES_DIR: string;

/**
 * Personalized factory fixture: profile.md present, all five idea statuses including
 * tolerance cases (malformed card, NON_IDEA_FILES), portfolio with three rows
 * (full, missing-repo, broken-path), proj-a with complete status + full docs tree +
 * .pandacorp/ comms, proj-b with malformed YAML.
 */
export const FIXTURE_FULL: string;

/**
 * Fresh factory fixture: NO profile.md, empty ideas folder.
 * Use for onboarding-gate trigger and empty-ideas edge case.
 */
export const FIXTURE_FRESH: string;

/** Absolute path to the events fixture directory. */
export const FIXTURE_EVENTS_DIR: string;

/** NDJSON with 10 valid events (with + without `project` field) + 1 malformed line. */
export const FIXTURE_EVENTS_NDJSON: string;

/** Empty NDJSON file (0 bytes). */
export const FIXTURE_EVENTS_EMPTY_NDJSON: string;

/**
 * Sets `PANDACORP_FACTORY_ROOT` to `fixturePath`, runs `fn`, then restores
 * the prior value (or deletes the var if it was not previously set).
 * The callback may be async; the returned Promise resolves to its return value.
 * Env is restored even when the callback throws.
 * Nestable: inner scope overrides, outer scope restores.
 */
export function withFactoryRoot<T>(
  fixturePath: string,
  fn: () => T | Promise<T>,
): Promise<T>;
```

### Usage pattern (for every lib/ reader test)

```ts
import { FIXTURE_FULL, withFactoryRoot } from "@/tests/fixtures/index";
import { readProfile } from "@/lib/profile";

it("reads profile from fixture", async () => {
  await withFactoryRoot(FIXTURE_FULL, async () => {
    const result = readProfile();
    expect(result.present).toBe(true);
  });
});
```

### Fixture tree — `factory-full/`

```
tests/fixtures/
  factory-full/                         # AC-01-000.1: personalized factory
    factory/profile.md                  # has name/goals/interests/assets/projects_path + body
    factory/ideas/
      idea-discovered.md                # status: discovered
      idea-recommended.md               # status: recommended
      idea-in-pipeline.md               # status: in-pipeline, project pointer to proj-a
      idea-shipped.md                   # status: shipped
      idea-discarded.md                 # status: discarded
      idea-malformed.md                 # broken frontmatter — must be skipped, not fatal
      _idea-template.md                 # NON_IDEA_FILES — must be ignored by readIdeas
      decision-log.md                   # NON_IDEA_FILES — must be ignored by readIdeas
    factory/portfolio.md                # 3 rows: full | missing-repo (—) | broken-path
    projects/proj-a/
      .pandacorp/status.yaml            # complete — all REQ-01-005 fields, valid YAML
      .pandacorp/comms/progress.md
      .pandacorp/inbox/decisions.md
      .pandacorp/inbox/bugs/bug-1.md
      docs/product/prd.md
      docs/product/architecture.md
      docs/frds/frd-01-x/
        frd.md
        blueprint.md
        mocks/                          # hasMocks: true
        work-orders/                    # hasWorkOrders: true
      docs/adr/ADR-0001-stack.md
      docs/decision-log.md
    projects/proj-b/
      .pandacorp/status.yaml            # MALFORMED YAML — tolerance case for readStatus
  factory-fresh/                        # AC-01-000.3: no profile.md, empty ideas
    factory/ideas/                      # empty directory
  events/
    dashboard-events.ndjson             # 10 valid events + 1 malformed line
    dashboard-events-empty.ndjson       # 0 bytes
```

### Reader type contracts (FRD-01 blueprint §2)

All types below are serializable (no class instances, no `Date`, no functions).

```ts
// lib/config.ts — already shipped; re-exported for reference
export function resolveFactoryRoot(env?: string, cwd?: string): string;
export const FACTORY_ROOT: string;
export const IDEAS_DIR: string;
export const PROFILE: string;
export const PORTFOLIO: string;
export const NON_IDEA_FILES: readonly string[];  // ["_idea-template.md", "decision-log.md"]
export function projectStatusPath(projectPath: string): string;

// lib/profile.ts
type Profile = {
  name?: string;
  goals?: string;
  interests?: string[];
  assets?: string[];
  projectsPath?: string;  // bounds FRD-16 orphan scan
  body: string;           // markdown body
};
type ProfileResult = { present: false } | { present: true; profile: Profile };
export function readProfile(profilePath?: string): ProfileResult;
// Tolerance: absent file → { present: false }; malformed frontmatter → present with partial fields.
// `projects_path` (snake_case in YAML) is mapped to `projectsPath` (camelCase) in the return type.
// Resolves path at call-time so PANDACORP_FACTORY_ROOT env changes are respected in tests.

// lib/ideas.ts
type IdeaStatus = "discovered" | "recommended" | "in-pipeline" | "shipped" | "discarded";
type IdeaCard = {
  slug: string;           // filename without .md
  title: string;
  status: IdeaStatus;
  projectType?: string;
  returnType?: "monetary" | "opportunity" | "personal" | "mixed";
  score?: number;
  project?: string;       // pointer when in-pipeline
  body: string;
};
export function readIdeas(): IdeaCard[];
// Tolerance: NON_IDEA_FILES skipped; malformed frontmatter card skipped (not fatal); empty folder → [].

// lib/portfolio.ts
type PortfolioEntry = {
  name: string;
  path: string;           // raw path cell; callers use pathExists to check
  repo?: string;          // "—"/empty normalized to undefined
  originIdea?: string;
  phase?: string;         // advisory; status.yaml is authoritative
  users?: string;
  returnMetric?: string;
  verdict?: string;
  lastSync?: string;
};
export function readPortfolio(arg?: string): PortfolioEntry[];
// `arg` may be omitted (default config.PORTFOLIO), a file path, or raw markdown content.
// Tolerance: absent/empty file → []; no table → []; rows with missing cells degrade to undefined fields.
// Placeholder cells ("—", "-", "") → undefined. Column order is name-based, not position-based.

// lib/status.ts
type Phase = "product" | "design" | "architecture" | "implementation" | "release" | "operation";
type ProjectStatus = {
  project: string; phase: Phase; version: string; running: boolean;
  progress?: number; workOrdersTotal: number; workOrdersDone: number;
  pendingDecisions: number; pendingBugs: number; rethinkPending: boolean;
  advancePending: boolean; lastGreenSha: string; safeToTest: boolean;
  overlayVersion?: string; createdWith?: string; updatedAt?: string; repo?: string;
};
type StatusResult =
  | { present: false; malformed: false; status: null }
  | { present: true; malformed: boolean; status: Partial<ProjectStatus> };
export function readStatus(projectPath: string): StatusResult;
// Tolerance: absent → { present: false }; malformed YAML → { present: true, malformed: true, status: {} }.
// YAML snake_case → camelCase: work_orders_total → workOrdersTotal, etc.

// lib/events.ts
type Event = {
  event: string; at: string;  // at = ISO 8601
  agent?: string; session?: string; tool?: string;
  status?: "ok" | "fail"; workOrder?: string; task?: string;
  project?: string;  // absent = legacy/global
};
type EventsSnapshot = {
  events: Event[];
  lastEventAt: string | null;
  byProject: Record<string, { lastEventAt: string }>;
};
export function readEvents(opts?: { path?: string; cap?: number }): EventsSnapshot;
// Default cap: 200. Tolerance: absent file → empty snapshot; malformed JSON line skipped.
// `path` defaults to ~/.claude/dashboard-events.ndjson. `work_order` mapped to workOrder.

// lib/docs.ts
export type FrdModule = {
  slug: string; hasFdd: boolean; hasBlueprint: boolean;
  hasMocks: boolean; hasWorkOrders: boolean;
};
export type ProjectDocsIndex = {
  prd?: string; architecture?: string;
  frds: FrdModule[];
  hasAdr: boolean; hasAnalytics: boolean; hasDecisionLog: boolean;
  comms: { progress?: string; decisions?: string; bugs: string[] };
};
export function readProjectDocs(projectPath: string): ProjectDocsIndex;
// Tolerance: absent files/folders → field absent or []; never throws.

// lib/fs-utils.ts
export function pathExists(p: string): boolean;
// Never throws; unreachable path returns false.
```

---

## WO-01-002: `readProfile` — owner profile reader

**Module:** `lib/profile.ts`
**Traces:** CMP-01-profile, IF-01-readProfile; REQ-01-001 (absence signal), REQ-01-002 (parse + personalize)

### Contract

```ts
export type Profile = {
  name?: string;
  goals?: string;
  interests?: string[];
  assets?: string[];
  projectsPath?: string;  // mapped from `projects_path` in YAML frontmatter
  body: string;           // raw markdown body (always present, "" if empty file)
};

export type ProfileResult =
  | { present: false }
  | { present: true; profile: Profile };

export function readProfile(profilePath?: string): ProfileResult;
```

### Behaviour

| Case | Result |
|---|---|
| `factory/profile.md` absent | `{ present: false }` — drives the onboarding gate (AC-01-001.1) |
| File present, valid frontmatter | `{ present: true; profile }` with all parsed fields (AC-01-002.1) |
| Malformed frontmatter (gray-matter throws) | `{ present: true; profile: { body } }` — fail-soft (blueprint §3) |
| Empty file (0 bytes) | `{ present: true; profile: { body: "" } }` — optional fields are `undefined` |
| Missing optional field | `undefined` — never `null`, never fabricated |

### Key mapping

`projects_path` (snake_case in YAML) → `projectsPath` (camelCase in `Profile`).
All other fields (`name`, `goals`, `interests`, `assets`) are direct.

### Path resolution

When called with no argument, resolves `factory/profile.md` relative to `resolveFactoryRoot()` at
**call-time** (not at module import time). This ensures `PANDACORP_FACTORY_ROOT` env overrides set
by `withFactoryRoot` in tests are respected.

### Invariants (REQ-01-011)

- Read-only: only calls `fs.readFileSync` — no writes, no network, no Claude calls.
- Never throws — errors from fs or gray-matter are caught and mapped to the tolerant shapes above.
- Result is fully serializable (no class instances, no `Date`, no functions).

---

## WO-01-003: `readIdeas` — idea cards reader

**Module:** `lib/ideas.ts`
**Traces:** IF-01-readIdeas; REQ-01-003; AC-01-003.1
**Dependencies:** WO-01-000 (fixtures), WO-01-001 (pathExists pattern), `gray-matter@^4`

### IF-01-readIdeas

```ts
// lib/ideas.ts

export type IdeaStatus =
  | "discovered"
  | "recommended"
  | "in-pipeline"
  | "shipped"
  | "discarded";

export type IdeaCard = {
  slug: string;           // filename without .md; derived from filesystem name
  title: string;          // frontmatter `title:` field
  status: IdeaStatus;     // frontmatter `status:` field; validated against union
  projectType?: string;   // frontmatter `project_type:` → camelCase mapped
  returnType?: "monetary" | "opportunity" | "personal" | "mixed";  // `return_type:` → camelCase
  score?: number;         // frontmatter `score:` — undefined when absent, never 0-coerced
  project?: string;       // frontmatter `project:` pointer (populated when in-pipeline)
  body: string;           // markdown body after frontmatter delimiters (gray-matter `.content`)
};

/**
 * Read and parse all idea cards from the ideas directory.
 *
 * @param ideasDir - Optional path override. Defaults to `IDEAS_DIR` from `lib/config.ts`
 *   (resolved from `PANDACORP_FACTORY_ROOT` env or one level up from cwd).
 * @returns Typed array of `IdeaCard`, sorted by slug for idempotency. Never throws.
 */
export function readIdeas(ideasDir?: string): IdeaCard[];
```

**Key behaviour:**
- Reads every `*.md` file in `ideasDir` (or the default `IDEAS_DIR`).
- Skips filenames listed in `NON_IDEA_FILES` (`["_idea-template.md", "decision-log.md"]`).
- Only processes `.md` files — non-`.md` files are ignored.
- Frontmatter is parsed with `gray-matter`; snake_case keys are mapped to camelCase
  (`project_type` → `projectType`, `return_type` → `returnType`).
- `slug` = filename without the `.md` extension.
- `body` = `gray-matter` `.content` property (the markdown body after the `---` delimiters,
  **not** the raw YAML frontmatter).
- Cards are sorted by slug before returning (idempotency — `readdir` order is not guaranteed).

**Tolerance rules (blueprint §3):**

| Condition | Result |
|---|---|
| `ideasDir` does not exist | Returns `[]` (no throw) |
| `ideasDir` is unreadable (`readdirSync` throws) | Returns `[]` (no throw) |
| File is in `NON_IDEA_FILES` | Silently skipped |
| File does not end in `.md` | Silently skipped |
| `gray-matter` throws on malformed frontmatter | Card skipped (no batch abort) |
| Card frontmatter missing `title` or invalid `status` | Card skipped |
| `score` absent from frontmatter | `card.score === undefined` (never `0`) |
| `return_type` not in the valid union | `card.returnType === undefined` |
| Folder exists but is empty | Returns `[]` |

**Regression anchor (B1, 2026-06-16):** `idea-malformed.md` causes `gray-matter` to throw on
broken YAML (`"unterminated quoted string"`). The reader catches errors **per card** (not per
batch) so the remaining valid cards are always returned.

**Invariants:**
- Read-only: zero writes, no Claude calls (`fs.readFileSync` + `gray-matter` only).
- Synchronous: safe for Next.js Server Components without `await`.
- `status` is always validated against the `IdeaStatus` union before inclusion.
- `returnType` is always validated against its union before inclusion.
- `score` is always a `number` or `undefined` — never `null`, never `0` for absent values.

---

## WO-01-004: `readPortfolio` — portfolio markdown table reader

**Module:** `lib/portfolio.ts`
**Traces:** CMP-01-portfolio, IF-01-readPortfolio; REQ-01-004; AC-01-004.1
**Dependencies:** WO-01-000 (fixtures)

### IF-01-readPortfolio

```ts
// lib/portfolio.ts

export type PortfolioEntry = {
  name: string;
  /** Raw path cell; existence is NOT validated here (REQ-01-010: that is pathExists()'s job). */
  path: string;
  /** Repo URL. Placeholder cells ("—", "-", "") normalized to `undefined`. */
  repo?: string;
  originIdea?: string;
  /** Advisory phase cell; `status.yaml` is the authoritative source for phase. */
  phase?: string;
  /** Raw string (e.g. "12" or "340") — never coerced to a number. */
  users?: string;
  returnMetric?: string;
  verdict?: string;
  lastSync?: string;
};

/**
 * Read and parse the portfolio markdown table.
 *
 * @param arg - Optional. Three accepted forms:
 *   - **omitted** — reads from `config.PORTFOLIO` (path derived from `PANDACORP_FACTORY_ROOT`
 *     at call-time so `withFactoryRoot` env swaps in tests are respected).
 *   - **file path** — any string that does not contain `\n`; the file is read from disk.
 *   - **raw markdown content** — any string containing `\n`; parsed in-memory without I/O.
 * @returns `PortfolioEntry[]`. Never throws. Empty on absent/empty file or no table found.
 */
export function readPortfolio(arg?: string): PortfolioEntry[];
```

### Behaviour contract

| Case | Result |
|---|---|
| `factory/portfolio.md` absent | `[]` (fail-soft, blueprint §3) |
| File empty or no GFM table | `[]` |
| Valid table, full row | All fields populated |
| Placeholder cell (`"—"`, `"-"`, `""`) | Field is `undefined` |
| Row with fewer cells than header | Populated fields kept; missing fields `undefined`; never throws |
| Broken/nonexistent project path | Path string returned verbatim; no fs stat performed (REQ-01-010) |
| Inline raw content passed | Parsed without any I/O (used in inline fixture tests) |
| Multiple disjoint tables | Data rows from all tables are returned |

### Column mapping

Headers are matched by name (case-insensitive, trimmed), not by position. The mapping is:

| Header text | `PortfolioEntry` key |
|---|---|
| `Name` | `name` (required) |
| `Path` | `path` (required) |
| `Repo` | `repo` |
| `Origin idea` | `originIdea` |
| `Phase` | `phase` |
| `Users` | `users` |
| `Return metric` | `returnMetric` |
| `Verdict` | `verdict` |
| `Last sync` | `lastSync` |

Unknown header cells are silently ignored. Column reordering is fully supported.

### Placeholder normalization

Any cell whose trimmed value is `"—"` (em dash), `"-"` (hyphen), or `""` (empty) is mapped to
`undefined` for all optional fields. The two required fields (`name`, `path`) use the same check;
rows where either is a placeholder are dropped.

### Path resolution

When called with no argument, resolves `factory/portfolio.md` relative to `resolveFactoryRoot()` at
**call-time** (not at module import time). This ensures `PANDACORP_FACTORY_ROOT` env overrides set
by `withFactoryRoot` in tests are respected.

### Invariants (REQ-01-011)

- Read-only: only calls `fs.readFileSync` — no writes, no network, no Claude calls.
- Never throws — errors from fs are caught; malformed rows degrade, never abort the batch.
- Result is fully serializable (all fields are `string | undefined`).
- Idempotent: repeated calls return entries with the same names in the same order.

---

## WO-01-001: `pathExists` — read-only filesystem existence probe

**Module:** `lib/fs-utils.ts`
**Traces:** IF-01-pathExists; REQ-01-010; AC-01-010.1
**Dependencies:** WO-01-000 (fixtures)

### IF-01-pathExists

```ts
// lib/fs-utils.ts
export function pathExists(p: string): boolean;
```

**Purpose:** Synchronous existence probe. Returns `true` when `p` names a reachable file or
directory; `false` for any absent path and for any error (empty string, whitespace-only string,
null bytes in path, permission denied, etc.). Never throws — the "never throws" invariant is
unconditional.

**Callers:** `readStatus`, `readProjectDocs`, and the FRD-03 not-found badge. Each caller passes a
project path (from the portfolio table); if `pathExists` returns `false`, the project is marked
not-found and the rest of the view continues rendering (AC-01-010.1).

**Tolerance rules:**

| Input | Return value |
|---|---|
| Existing file or directory | `true` (strict `boolean`) |
| Absent path | `false` (strict `boolean`) |
| Empty string `""` | `false` — never throws |
| Whitespace-only string | `false` — never throws |
| Path containing null bytes | `false` — never throws |
| `fs.existsSync` throws (EPERM, EACCES, etc.) | `false` — error swallowed |

**Invariants:**
- Return type is always a strict `boolean` (`true` or `false`) — never `null`, `undefined`, or a
  truthy/falsy non-boolean (regression guard for the B1' `typeof NaN === "number"` pattern).
- Read-only: zero writes, no directory creation, no Claude calls.
- Synchronous: safe for Next.js Server Components without `await`.
- Idempotent: repeated calls on the same path always return the same result.

**Implementation:** `fs.existsSync(p)` wrapped in a try/catch, with an early return of `false`
for blank/empty inputs before the `existsSync` call.

---

## WO-01-007: `readEvents` — event stream reader (capped tail + state diffs)

**Module:** `lib/events.ts`
**Traces:** CMP-01-events, IF-01-readEvents; REQ-01-008; AC-01-008.1
**Dependencies:** WO-01-000 (fixtures)

### IF-01-readEvents

```ts
// lib/events.ts

export type Event = {
  event: string;      // required
  at: string;         // required; ISO 8601 timestamp
  agent?: string;
  session?: string;
  tool?: string;
  status?: "ok" | "fail";
  workOrder?: string; // mapped from `work_order` (snake_case) in the raw NDJSON
  task?: string;
  project?: string;   // absent = legacy/global (bucketed under __global__)
};

export type EventsSnapshot = {
  events: Event[];                                    // capped tail (default 200)
  lastEventAt: string | null;                         // max `at` across retained events
  byProject: Record<string, { lastEventAt: string }>; // per-project last-seen timestamp
};

/**
 * Read the event stream and compute the dashboard digest.
 *
 * @param opts.path - Path to the NDJSON file.
 *                    Defaults to `~/.claude/dashboard-events.ndjson`.
 * @param opts.cap  - Maximum number of events to retain (tail semantics). Default 200.
 *                    NaN / Infinity fall back to 200; negative numbers clamp to 0.
 * @returns A fully-typed, serializable `EventsSnapshot`. Never throws.
 */
export function readEvents(opts?: { path?: string; cap?: number }): EventsSnapshot;
```

### Behaviour

| Condition | Result |
|---|---|
| File absent / unreadable | `{ events: [], lastEventAt: null, byProject: {} }` — no throw |
| Empty NDJSON (0 bytes) | Same empty snapshot |
| Malformed JSON line | Line skipped; valid lines around it are kept |
| Valid JSON but not a plain object (string, number, null, array) | Line skipped |
| Object missing `event` or `at` (string) | Line skipped |
| `cap` = 200 (default) | Last 200 valid events retained |
| `cap` set below line count | Last `cap` events (tail semantics) |
| `cap` = NaN or Infinity | Falls back to 200 (regression anchor B1' — `typeof NaN === "number"`) |
| `cap` = negative | Clamped to 0 — returns empty events array; no throw |
| Event has no `project` field | Bucketed under `__global__` in `byProject`; never dropped |
| Multiple events for same project | `byProject[key].lastEventAt` = max `at` for that project |

### Key mapping

`work_order` (snake_case in raw NDJSON) is mapped to `workOrder` (camelCase) in the `Event` type.
This is the only field-name mapping; all other fields (`event`, `at`, `agent`, `session`, `tool`,
`status`, `task`, `project`) are passed through unchanged.

### Default path

When `opts.path` is omitted, `readEvents` reads from `~/.claude/dashboard-events.ndjson`
(the same path as `EVENTS_NDJSON` in `lib/config.ts`). The path is resolved at call-time using
`process.env.HOME` / `process.env.USERPROFILE` / `os.homedir()`, in that order.

### `byProject` contract

- Key = value of `event.project` field for events that have it.
- Key = `"__global__"` for events that carry no `project` field (legacy/global).
- Value = `{ lastEventAt: string }` — the ISO 8601 string of the latest `at` for that key.
- An empty snapshot has `byProject = {}` (no `__global__` key unless events were retained).

### `lastEventAt` contract

- `null` when no valid events are retained (empty file, all-malformed, missing file, cap = 0).
- ISO 8601 string of the maximum `at` across all retained events when events exist.
- ISO 8601 strings compare correctly with `>` (lexicographic order = chronological order).

### Invariants (REQ-01-011)

- Read-only: only calls `fs.readFileSync` — no writes, no network, no Claude calls.
- Never throws — all `fs` and `JSON.parse` errors are caught per-line or at the file level.
- Fully serializable: no `Date` objects, no class instances, no functions in the return type.
- Idempotent: repeated calls on the same file return equal snapshots.
- Synchronous: safe to call from Next.js Server Components without `await`.

### Test coverage

`lib/events.test.ts` — 50 tests across 9 groups (vitest, no mocks, fixture-based):
happy-path parsing, `lastEventAt` computation, `byProject` grouping + `__global__` bucket,
`work_order`→`workOrder` mapping, tail cap (default 200 + custom), missing/empty file,
malformed-line skip, read-only invariant, idempotency, NaN-cap regression.

---

## WO-13-001: Token schema validation + agent-color/state-vocab key maps

**Module:** `app/_design/tokens.ts`
**Traces:** REQ-13-001, REQ-13-002, REQ-13-004, REQ-13-005, REQ-13-007

### IF-13-tokens — Token schema contract

#### Types

```ts
interface OklchTokens {
  [key: string]: unknown;
  base: string;      // OKLCH string, e.g. "oklch(0.15 0.02 230)"
  accent: string;
  contrast: string;
}

interface ThemeVariant {
  surface: string;
  text: string;
}

interface ThemeTokens {
  [key: string]: unknown;
  light: ThemeVariant;
  dark: ThemeVariant;
  highContrast: ThemeVariant;
}

interface ElevationLevel {
  shadow: string;     // CSS box-shadow value
  spacing: string;    // e.g. "0.25rem"
}

interface MotionTokens {
  duration: Record<string, number>;  // ms values, all < 300
  easing: Record<string, string>;    // 2–3 entries, CSS cubic-bezier strings
}

interface TokenSchema {
  [key: string]: unknown;
  oklch: OklchTokens;
  themes: ThemeTokens;
  agents: Record<string, string>;    // role → OKLCH color string
  elevation: ElevationLevel[];       // exactly 3 entries
  radius: string;
  spacing: string;
  hairline: string;
  motion: MotionTokens;
}

interface TokenValidationResult {
  valid: boolean;
  errors: string[];   // actionable messages naming the failing path + constraint
}
```

#### Function: `validateTokenSchema`

```ts
function validateTokenSchema(tokens: unknown): TokenValidationResult
```

**Purpose:** validates the shape of `docs/design/design-tokens.json` against the blueprint §3
contract. Returns actionable errors — each string names the failing path and the constraint.

**Constraints enforced:**

| Constraint | Error pattern |
|---|---|
| `oklch.{base,accent,contrast}` present | `oklch.<key>: required OKLCH token is missing` |
| `themes.{light,dark,highContrast}` present | `themes.<variant>: required theme variant is missing` |
| All 10 canonical agent roles in `agents` | `agents.<role>: canonical agent role "<role>" is missing` |
| `elevation` is array of exactly 3 items | `elevation: must have exactly 3 levels, found N` |
| `radius`, `spacing`, `hairline` present | `<key>: required spacing-scale token is missing` |
| All `motion.duration.*` values are numbers (ms) | `motion.duration.<key>: must be a number (ms), got <type>` |
| All `motion.duration.*` values < 300ms | `motion.duration.<key>: duration Nms violates the <300ms constraint` |
| `motion.easing` has 2–3 entries | `motion.easing: must have 2–3 easing tokens, found N` |

**Return:** `{ valid: true, errors: [] }` on success; `{ valid: false, errors: string[] }` on failure.
Never returns partial success — `valid` is always `errors.length === 0`.

---

### IF-13-agent-colors — Canonical role → token key map

```ts
const AGENT_ROLES: readonly AgentRole[]  // source of truth — 10 entries

type AgentRole =
  | "researcher"
  | "backend-dev"
  | "frontend-dev"
  | "test-writer"
  | "reviewer"
  | "security-auditor"
  | "architect"
  | "product-manager"
  | "designer"
  | "guild"

const AGENT_COLOR: Record<AgentRole, string>
```

**`AGENT_COLOR` values** — CSS custom property keys resolved via `@theme` in `app/globals.css`:

| Role | Token key |
|---|---|
| `researcher` | `--color-agent-researcher` |
| `backend-dev` | `--color-agent-backend-dev` |
| `frontend-dev` | `--color-agent-frontend-dev` |
| `test-writer` | `--color-agent-test-writer` |
| `reviewer` | `--color-agent-reviewer` |
| `security-auditor` | `--color-agent-security-auditor` |
| `architect` | `--color-agent-architect` |
| `product-manager` | `--color-agent-product-manager` |
| `designer` | `--color-agent-designer` |
| `guild` | `--color-agent-guild` |

**Invariants:**
- All 10 roles covered; no role shares a token key.
- Single source of truth: `FRD-06` `IF-06-agent-color` and `FRD-12` DAG nodes import `AGENT_COLOR`
  from here — they must not define their own color mapping.

---

### IF-13-state-vocab — State badge vocabulary

```ts
const AGENT_STATES: readonly AgentState[]  // source of truth — 6 entries

type AgentState =
  | "working"
  | "idle"
  | "failed"
  | "completed"
  | "blocked"
  | "reviewing"

const STATE_BADGE: Record<AgentState, { icon: string; label: string }>
```

**`STATE_BADGE` entries** (Spanish labels, AC-13-007.1 — no state is color-only):

| State | Icon (Lucide id) | Label (Spanish) |
|---|---|---|
| `working` | `loader-circle` | Trabajando |
| `idle` | `circle-dashed` | En espera |
| `failed` | `circle-x` | Fallido |
| `completed` | `circle-check` | Completado |
| `blocked` | `ban` | Bloqueado |
| `reviewing` | `eye` | En revisión |

**Invariants:**
- All 6 states covered; every entry has a non-empty icon and a non-empty label.
- All labels are distinct.
- Consumers MUST NOT signal state by color alone; they MUST render the icon + label from this map
  (or via `CMP-13-state-badge` which does so).

---

## Consumption notes (downstream features)

- **FRD-06 Party** (`IF-06-agent-color`): import `AGENT_COLOR` and `AgentRole` from `app/_design/tokens`;
  do not define a local color map.
- **FRD-12 DAG**: import `AGENT_COLOR` from `app/_design/tokens` for node coloring.
- **CMP-13-state-badge** (`StateBadge`): import `STATE_BADGE`, `AGENT_STATES`, `AgentState` from
  `app/_design/tokens`; render icon + label, never color alone.
- **WO-13-002** (`globals.css` wiring): the CSS custom property names in `AGENT_COLOR` (e.g.
  `--color-agent-researcher`) must match the `@theme` variable names declared in `globals.css`.
  WO-13-002 owns the CSS side; WO-13-001 owns the key names.

---

## Not-yet-wired (blocked on design phase)

`docs/design/design-tokens.json` does not yet exist (blueprint §7 open dependency).
`validateTokenSchema` can be called today against any JSON that matches the `TokenSchema` shape.
Once the design phase freezes the token values, WO-13-002 will wire them into `globals.css`.

---

## WO-02-002: CopyButton — shared clipboard affordance

**Module:** `components/CopyButton.tsx`
**Traces:** CMP-02-copy-button; REQ-02-003, REQ-02-004; AC-02-003.x / AC-02-004.x
**Reused by:** FRD-01 (onboarding gate), FRD-02 (intake modal + card detail), FRD-03 (recovery/next-step commands)

### Signature

```tsx
"use client";

export interface CopyButtonProps {
  /** The text value to copy to the clipboard when the button is clicked. */
  value: string;
  /** Optional visible label rendered inside the button alongside the copy indicator. */
  label?: string;
}

export function CopyButton(props: CopyButtonProps): React.JSX.Element;
```

### Behaviour contract

| Property | Rule |
|---|---|
| **Mechanism** | `navigator.clipboard.writeText(value)` on click |
| **Success feedback** | Shows the Spanish text "copiado" transiently after a successful write |
| **Revert timeout** | Reverts to the initial state after ≤ 2 000 ms (`REVERT_DELAY_MS = 2_000`) |
| **Error path** | If `writeText` rejects, no "copiado" text is shown; component does not crash |
| **In-flight guard** | A second click while the first write is in flight is ignored (pendingRef guard) |
| **Multiple instances** | Each instance is independently stateful; clicking one does not affect others |
| **testid** | `data-testid="copy-button"` on the `<button>` element |
| **Accessibility** | `aria-label` in Spanish: `"Copiar al portapapeles"` at rest; `"Copiado al portapapeles"` while showing confirmation |
| **Element** | Renders a `<button type="button">` (not a `<div>` or `<span>`) |
| **Styling** | Neutral inline-style base; design-token integration is deferred to the design-system WO; consumers must not rely on exact CSS details |
| **Writes** | None — no disk write, no Claude call; read-only constraint respected |

### Usage examples

```tsx
// Minimal — command to copy, no label
<CopyButton value="/pandacorp:explore" />

// With a visible label (shown alongside the copy indicator)
<CopyButton value="/pandacorp:spec mi-idea" label="Crear proyecto" />

// Multiple instances on the same surface (FRD-01 onboarding gate)
<CopyButton value="/pandacorp:onboarding" label="Configurar fábrica" />
<CopyButton value="cd ~/Proyectos/mi-proyecto" label="Ir al proyecto" />
```

### Test coverage

`components/CopyButton.test.tsx` (jsdom, vitest) — 20 tests across 7 groups:
rendering + a11y, happy-path clipboard copy, transient "copiado" confirmation,
sequential / rapid-click idempotency, error path (rejected clipboard), edge-case values,
and reuse contract (multiple instances side-by-side).

### Implementation notes

- The `setTimeout` callback uses `react-dom`'s `flushSync` to flush the
  `setCopied(false)` state update synchronously when the timer fires. This is
  necessary because vitest fake timers execute callbacks synchronously (outside
  React's `act`), so without `flushSync` the DOM would still show "copiado"
  after `vi.advanceTimersByTime`.
- `vitest.setup.ts` polyfills `vi.runAllMicrotasksAsync` (not present in
  vitest 4.1.9) and declares it via `declare module "vitest"` augmentation.
  The polyfill wraps three `await Promise.resolve()` turns inside `act` to
  flush React's pending state after an async click handler resolves.
