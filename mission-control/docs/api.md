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
> **complete for WO-01-008** (CMP-01-onboarding-gate, `components/OnboardingGate.tsx`) +
> **complete for WO-13-001** (IF-13-tokens, IF-13-agent-colors, IF-13-state-vocab) +
> **complete for WO-02-002** (CMP-02-copy-button) +
> **complete for WO-02-001** (IF-02-deriveColumn, `lib/board.ts`) +
> **complete for WO-02-003** (IF-02-nextStep, `lib/next-step.ts`) +
> **complete for WO-02-004** (IF-02-discardIdea, `lib/discard.ts`) +
> **complete for WO-03-001** (IF-03-activeProjects, `lib/portfolio.ts` → `activeProjects()`) +
> **complete for WO-12-001** (IF-12-topn `topN`, IF-12-freshness `freshness`, `app/_observability/selectors/`) +
> **complete for WO-12-002** (IF-12-kpis `deriveKpis`, `app/_observability/selectors/kpis.ts`) +
> **complete for WO-11-001** (IF-11-modes `BUILD_MODES`/`DEFAULT_BUILD_MODE`, IF-11-mode-store `getRememberedMode`/`rememberMode`).

---

## WO-11-001: `BUILD_MODES` catalog + per-project mode persistence

**Modules:** `lib/constants.ts` (catalog) + `lib/build-mode-store.ts` (client-local store)
**Traces:** IF-11-modes, IF-11-mode-store; REQ-11-001, REQ-11-003; AC-11-001.1..003.2
**Dependencies:** none (static catalog; localStorage only)

### IF-11-modes — `lib/constants.ts`

```ts
// lib/constants.ts

/** Union of all valid build-mode identifiers. */
export type BuildMode = "pro" | "balanced" | "powerful" | "deep";

/** Full descriptor for a single build mode. */
export interface BuildModeInfo {
  /** Stable identifier; never changes between releases. */
  id: BuildMode;
  /** i18n key for the mode label shown in the selector. */
  label: string;
  /** i18n key for the mode description (agents, models, recommended plan). */
  description: string;
  /**
   * The exact command the owner copies into Claude.
   * Balanced: "/pandacorp:implement" (no argument).
   * Others:   "/pandacorp:implement <id>".
   */
  command: string;
}

/**
 * Ordered catalog of build modes (AC-11-001.1 — Pro, Balanced, Powerful, Deep).
 * Frozen at runtime (Object.freeze). readonly at the TypeScript level.
 */
export const BUILD_MODES: readonly BuildModeInfo[];

/** Default mode when no choice has been persisted (AC-11-001.3). Value: "balanced". */
export const DEFAULT_BUILD_MODE: BuildMode;
```

### Catalog entries (AC-11-001.1, AC-11-002.1)

| Index | `id` | `label` (i18n key) | `command` |
|---|---|---|---|
| 0 | `"pro"` | `"buildModes.pro.label"` | `"/pandacorp:implement pro"` |
| 1 | `"balanced"` | `"buildModes.balanced.label"` | `"/pandacorp:implement"` (no arg) |
| 2 | `"powerful"` | `"buildModes.powerful.label"` | `"/pandacorp:implement powerful"` |
| 3 | `"deep"` | `"buildModes.deep.label"` | `"/pandacorp:implement deep"` |

### IF-11-mode-store — `lib/build-mode-store.ts`

```ts
// lib/build-mode-store.ts  ("use client")

/**
 * Retrieve the remembered build mode for a project.
 * Returns DEFAULT_BUILD_MODE when unset, invalid, or on any localStorage error.
 * Never throws (FREEZE-ON-RED regression anchor).
 *
 * @param slug - The project slug. Empty string → DEFAULT_BUILD_MODE.
 */
export function getRememberedMode(slug: string): BuildMode;

/**
 * Persist the build mode choice for a project.
 * Writes only to localStorage under key "mc:build-mode:<slug>".
 * Never touches status.yaml or any file on disk (architecture §7, REQ-01-011).
 * Silent on localStorage errors (quota, private-browsing, etc.).
 *
 * @param slug - The project slug.
 * @param mode - A valid BuildMode literal.
 */
export function rememberMode(slug: string, mode: BuildMode): void;
```

### localStorage keying scheme

Key format: `mc:build-mode:<slug>`. One key per project slug. Values are plain `BuildMode` strings stored as-is (no JSON serialization).

### Fallback / validation rules (getRememberedMode)

| Stored value | Result |
|---|---|
| Key absent (`null`) | `DEFAULT_BUILD_MODE` |
| Empty string | `DEFAULT_BUILD_MODE` (regression I2) |
| JSON array (`[…]`) | `DEFAULT_BUILD_MODE` (regression I3) |
| JSON object (`{…}`) | `DEFAULT_BUILD_MODE` (regression I3) |
| Valid `BuildMode` string | The stored mode |
| Any other string | `DEFAULT_BUILD_MODE` (regression B1') |
| localStorage throws | `DEFAULT_BUILD_MODE` (FREEZE-ON-RED) |

### Architecture invariants

- **Read-only**: `rememberMode` writes ONLY to `localStorage`. No `fs.writeFileSync`, no `status.yaml` touch (architecture §7, REQ-01-011).
- **No magic strings**: `BUILD_MODES` in `lib/constants.ts` is the single source of truth for commands and mode ids.
- **`BUILD_MODES` is deep-frozen**: `Object.freeze()` on both the outer array and every entry object at runtime; `readonly` at the TypeScript type level. Any `.push()` throws; any `BUILD_MODES[n].id = "…"` throws in strict mode (ESM files are always strict).
- **Client-only**: `lib/build-mode-store.ts` carries `"use client"` — it is never imported server-side.
- **Never throws**: both functions are unconditionally throw-safe.

### Consumption (downstream WO)

- **`CMP-11-mode-selector`** (WO-11-002): renders the four-mode selector; calls `getRememberedMode(slug)` for the initial state and `rememberMode(slug, mode)` on selection change.
- The `command` field from `BUILD_MODES` is passed to `<CopyButton>` (WO-02-002).

### Test coverage

`lib/build-modes.test.ts` — 41 tests across 4 groups (vitest, jsdom — localStorage available):

| Group | Coverage |
|---|---|
| BUILD_MODES catalog | 4 entries in order, label/description/command non-empty, command format per AC-11-002.1, frozen/immutable, no duplicate ids or commands |
| DEFAULT_BUILD_MODE | Is `"balanced"`, exists in BUILD_MODES, is a valid BuildMode literal |
| getRememberedMode / rememberMode | Default when empty; round-trip all 4 modes; per-slug isolation; overwrite; regression B1'/I2/I3/FREEZE-ON-RED; property tests; edge slugs (empty, 200-char, hyphens) |
| Type-safety / structural | No `"balanced"` in balanced command; all commands start with `/pandacorp:implement`; all keys present on every entry |

---

## WO-03-001: `activeProjects` — portfolio compose helper

**Module:** `lib/portfolio.ts` — exported function `activeProjects()`
**Traces:** CMP-03-active-projects, IF-03-activeProjects; REQ-03-001..003, REQ-03-006; AC-03-001.1..003.1, AC-03-006.x
**Dependencies:** WO-01-004 (`readPortfolio`), WO-01-005 (`readStatus`, `StatusResult`, `Phase`), WO-01-001 (`pathExists`)

### IF-03-activeProjects

```ts
// lib/portfolio.ts

export type ProjectListItem = {
  name: string;
  /** Raw path cell from the portfolio row (verbatim; may be relative or nonexistent). */
  path: string;
  repo?: string;
  /** Full StatusResult from readStatus(resolvedPath). */
  status: StatusResult;
  /** True when the resolved path exists on disk. False for not-found rows (badge-ready). */
  exists: boolean;
  /**
   * Phase for display: authoritative from status.yaml; fallback to portfolio advisory cell
   * (with "shipped" → "operation", "building" → "implementation" mapping).
   * Undefined only when neither source can supply a valid phase.
   */
  stage?: Phase;
  /**
   * Strict boolean from status.status.running.
   * Undefined when status absent or running field missing/malformed.
   * Never NaN or null-coerced (regression B1').
   */
  running?: boolean;
  /**
   * Populated ONLY for operation (shipped) phase from the portfolio row's Users /
   * Return metric / Verdict columns. Undefined for non-operation entries, or when
   * all snapshot cells are placeholders.
   */
  snapshot?: {
    users?: string;
    returnMetric?: string;
    verdict?: string;
  };
};

/**
 * Compose helper: read the portfolio, enrich each entry with its status and
 * existence flag, return only active-phase entries.
 *
 * Active set: architecture | implementation | release | operation.
 *
 * @param content - Optional raw portfolio markdown content (inline fixture tests).
 *   When omitted, reads from config.PORTFOLIO (at call-time, env-aware).
 * @returns ProjectListItem[] filtered to active phases. Never throws.
 */
export function activeProjects(content?: string): ProjectListItem[];
```

### Phase resolution algorithm

1. **Authoritative:** read `status.yaml` via `readStatus(resolvedPath)`. If `statusResult.present && statusResult.status.phase` is a valid `Phase` literal → use it.
2. **Advisory fallback:** if status is absent, malformed, or phase is undefined → read the portfolio table's `phase` cell, normalize via the map below.
3. **Advisory → Phase map:**

| Portfolio cell | Resolved Phase |
|---|---|
| `architecture` | `architecture` |
| `implementation` | `implementation` |
| `building` | `implementation` |
| `release` | `release` |
| `operation` | `operation` |
| `shipped` | `operation` |
| anything else | — (row excluded) |

4. **Active filter:** keep only entries whose resolved phase is in `{ architecture, implementation, release, operation }`.

### Path resolution

- **Absolute paths** (start with `/`) → used verbatim for `readStatus` and `pathExists`.
- **Relative paths** → resolved against `resolveFactoryRoot()` at call-time (env-aware, respects `PANDACORP_FACTORY_ROOT` in tests).
- The raw `path` string from the portfolio row is **always preserved verbatim** in the `ProjectListItem.path` field (REQ-01-010 through-compose).

### Snapshot population rule (AC-03-003.1)

`snapshot` is set only when `stage === "operation"`. The object is populated from the portfolio row's `users`, `returnMetric`, and `verdict` fields (already normalized by `readPortfolio` — placeholders are `undefined`). If all three are `undefined`, `snapshot` is `undefined` (omit silently, not an empty object).

### Field invariants

| Field | Invariant |
|---|---|
| `name` | Non-empty string; always present |
| `path` | Non-empty string; verbatim raw cell; always present |
| `status` | Full `StatusResult` object; never null; always present |
| `exists` | Strict `boolean`; never null/undefined |
| `stage` | Valid `Phase` literal or `undefined`; never an array (regression I3) |
| `running` | Strict `boolean` or `undefined`; never NaN/null/number (regression B1') |
| `snapshot` | Only on `operation` entries; `undefined` otherwise |

### Tolerance rules (blueprint §3)

| Condition | Result |
|---|---|
| No portfolio file / empty | `[]` (via readPortfolio fail-soft) |
| Status absent | Phase from advisory cell fallback; `running: undefined` |
| Status malformed (present: true, malformed: true) | Same advisory fallback; `running: undefined` |
| Path not found on disk | `exists: false`; row still listed when phase is active (badge-ready) |
| All snapshot cells are placeholders | `snapshot: undefined` |
| Non-active advisory phase | Row excluded; no throw |
| Never throws | For any combination of absent/malformed inputs |

### Invariants (REQ-01-011)

- **Read-only:** no writes, no Claude calls; only `readPortfolio`, `readStatus`, `pathExists`.
- **Never throws:** all error cases yield empty/partial/undefined, never a thrown exception.
- **Fully serializable:** all fields are `string | boolean | undefined | StatusResult | snapshot`; no class instances, no `Date`, no functions.
- **Idempotent:** repeated calls on the same inputs return entries with the same names in the same order.
- **Synchronous:** safe for Next.js Server Components without `await`.

### Consumption (downstream features)

- **`app/portfolio/page.tsx` + `components/ProjectRail.tsx`** (WO-03-002): calls `activeProjects()` server-side, passes `ProjectListItem[]` to the rail for rendering.
- **`components/ProjectRow.tsx`** (WO-03-002): receives one `ProjectListItem`; reads `exists`, `stage`, `running` for the building/stopped indicator and ⚠️ badge.
- **`components/BusinessSnapshot.tsx`** (WO-03-003): receives `item.snapshot` for shipped-project chips.
- **`components/RecoveryHint.tsx`** (WO-03-005): receives `item.repo` and `item.path` for the copyable recovery command.

### Regression anchors

| Anchor | Description | Guard |
|---|---|---|
| **B1' (2026-06-16)** | `typeof NaN === "number"` can bypass type guards. `readStatus` rejects NaN upstream; `activeProjects` uses strict equality (`=== true` / `=== false`) for `running`. | `running` is always `boolean | undefined`, never a number. |
| **I2 (2026-06-16)** | Empty/vacuous-truth from malformed status must not invent defaults. | Phase from malformed status is `undefined`; fallback to advisory cell, never fabricated. |
| **I3 (2026-06-16)** | Array-typed phase values from YAML bypass `typeof`. | `readStatus` rejects them upstream; `stage` in `ProjectListItem` is always a `Phase` literal or `undefined`. |

### Test coverage

`lib/active-projects.test.ts` — 46 tests across 9 groups (vitest, no mocks, fixture-based):

| Group | Coverage |
|---|---|
| AC-03-001.1 active phase inclusion | Includes architecture/implementation/release/operation; excludes product/design |
| AC-03-006.x missing path | `exists: false` when path not found; row still listed; repo preserved |
| AC-03-002.1 stage and running | Correct stage per phase; `running` strict boolean; all-items invariant |
| AC-03-003.1 snapshot | Populated for operation only; absent/placeholder → undefined |
| Malformed status fallback | No throw on malformed YAML; excluded when advisory phase is non-active; included when advisory phase is shipped |
| Read-only + fail-soft | Empty portfolio → `[]`; nonexistent factory root → `[]`; never throws |
| ProjectListItem field invariants | name/path non-empty strings; status object; exists boolean on every item |
| Idempotency | Two calls → same names in same order |
| Inline content overload | Parses raw markdown content; filters non-active phases |

---

## WO-02-004: `discardIdea` — the single write in the codebase

**Module:** `lib/discard.ts`
**Traces:** CMP-02-discard, IF-02-discardIdea; REQ-02-007; AC-02-007.1
**Dependencies:** WO-01-000 (fixtures), `lib/config.ts` (shipped), `gray-matter@^4`

### IF-02-discardIdea

```ts
// lib/discard.ts

export type DiscardResult = { ok: true } | { ok: false; reason: "not-found" | "parse-error" };

/**
 * Rewrite `status: discarded` in the frontmatter of the idea card identified by `slug`,
 * preserving the body and ALL other frontmatter fields verbatim.
 *
 * This is the ONLY `fs.write` in the entire Mission Control codebase (architecture §1/§7).
 * It touches exactly one field of one file. Invoked only through the Server Action
 * `app/board/actions.ts` (human-triggered, REQ-02-007).
 *
 * @param slug      - The idea slug (filename without `.md`). Empty string and path-traversal
 *                    slugs return { ok: false, reason: "not-found" }.
 * @param ideasDir  - Optional explicit directory path (used by tests). Defaults to
 *                    `config.IDEAS_DIR` (derived from `PANDACORP_FACTORY_ROOT` at call-time).
 * @returns { ok: true } on success (including idempotent re-discard of already-discarded card).
 *          { ok: false, reason: "not-found" } when the file is absent or slug escapes the dir.
 *          { ok: false, reason: "parse-error" } when the file cannot be parsed; untouched.
 */
export function discardIdea(slug: string, ideasDir?: string): DiscardResult;
```

### Behaviour contract

| Case | Result | File written? |
|---|---|---|
| Slug exists, file parseable, status not yet discarded | `{ ok: true }`, status set to `"discarded"` | Yes — exactly the target file |
| Slug exists, file parseable, status already `"discarded"` | `{ ok: true }` (idempotent) | Yes — same result written again |
| Slug is empty string `""` | `{ ok: false, reason: "not-found" }` | No |
| Slug does not match any `.md` file | `{ ok: false, reason: "not-found" }` | No |
| Slug contains path-traversal (`../../`) | `{ ok: false, reason: "not-found" }` | No — path escape blocked |
| Path resolves to a directory (not a file) | `{ ok: false, reason: "not-found" }` | No |
| File exists but frontmatter is malformed (gray-matter throws) | `{ ok: false, reason: "parse-error" }` | No — file left byte-for-byte untouched |

### Field preservation guarantees

After a successful `discardIdea` call, reading the card with `gray-matter` yields:

| Field | Guarantee |
|---|---|
| `status` | `"discarded"` |
| `title` | Identical to pre-call value |
| `project_type`, `return_type` | Identical to pre-call value |
| `score` (numeric, including `0`) | Identical — never `NaN`, never dropped |
| Object-valued fields (e.g. `meta`) | Deep-equal to pre-call value (regression I2) |
| Array-valued fields (e.g. `tags`) | Deep-equal to pre-call value (regression I3) |
| Body text (`.content`) | Byte-for-byte identical |
| Key set (no added/removed keys) | Exactly the same keys as before |

### Security invariants

- **Path confinement:** `path.resolve(ideasDir)` is used to normalize both the ideas dir and the
  target file path. Any slug that resolves outside `ideasDir` is rejected as `"not-found"` before
  any filesystem access. This prevents directory-traversal attacks (e.g. `../../etc/passwd`).
- **No write on error:** If `statSync`, `readFileSync`, or `gray-matter` parsing fails, the function
  returns immediately without calling `writeFileSync`. The file is never partially written.
- **Single target:** `writeFileSync` is called at most once per invocation, on the exact
  `<ideasDir>/<slug>.md` path. No sibling files are touched.

### Gray-matter cache bypass

`gray-matter@4` maintains an internal content cache. When the same raw file content is parsed
twice in the same process (common in test suites), the second call returns a cached partial result
instead of throwing on malformed YAML. `discardIdea` passes `{ excerpt: false }` to bypass this
cache, ensuring every call re-evaluates the content from scratch and malformed files always return
`"parse-error"` regardless of prior calls.

### Trailing-newline preservation

`gray-matter.stringify` always appends a trailing `\n` to the body in its output. If the original
body (`parsed.content`) did not end with `\n`, `discardIdea` strips the extra trailing `\n` from
the serialized output before writing, so that re-parsing the written file produces a `content`
property byte-for-byte identical to the original.

### Write isolation invariant (architecture §1/§7)

- `discardIdea` is the **sole** `fs.writeFileSync` call in the entire Mission Control codebase.
- Every other module (`lib/ideas.ts`, `lib/board.ts`, `lib/next-step.ts`, all readers) is
  read-only. This is enforced by architecture §7 and verified by the write-isolation test group
  in `lib/discard.test.ts` (mtime snapshot before/after the call).

### Consumption

- **`app/board/actions.ts`** (CMP-02-discard-action, WO-02-009): the Server Action that is the
  only caller of `discardIdea`. Receives the slug from the `DiscardButton` client component.
  Never called during render.
- **`components/DiscardButton.tsx`** (CMP-02-discard-action): client component that triggers the
  Server Action on user click. Implements optimistic UI (update + revert on failure).

### Test coverage

`lib/discard.test.ts` — 46 tests across 8 groups (vitest, no mocks, temp-dir isolated):
- Happy path: discovered/recommended/in-pipeline/shipped cards → `{ ok: true }`, all fields preserved
- Idempotency: already-discarded card → `{ ok: true }`, double-discard → same result
- Not-found errors: missing slug, empty slug, path-traversal → `{ ok: false, reason: "not-found" }`
- Parse errors: malformed frontmatter → `{ ok: false, reason: "parse-error" }`, file untouched
- Write isolation: only the target file mtime changes; sibling files unchanged; file count unchanged
- Frontmatter edge cases: score `0`, arrays (I3), objects (I2), YAML-like body, empty body, absent score field, slug with `.md` extension
- Mutation-killing: only `status` field changes; all other fields and body byte-equal before/after
- Parametric round-trip: 12 synthetic cards spanning integer, float, zero, negative, boolean, string, empty string, 1-element array, 3-element array, nested object, null — all preserved verbatim

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

## WO-02-003: `nextStep` — lifecycle-position → command map

**Module:** `lib/next-step.ts`
**Traces:** CMP-02-next-step, IF-02-nextStep; REQ-02-004; AC-02-004.1
**Dependencies:** WO-01-003 (`IdeaStatus` from `lib/ideas.ts`), WO-01-005 (`Phase` from `lib/status.ts`)

### IF-02-nextStep

```ts
// lib/next-step.ts

import type { IdeaStatus } from "./ideas";
import type { Phase } from "./status";

export type NextStep = {
  /** The /pandacorp:* command string the owner should copy and run. */
  command: string;
  /**
   * Absolute path of the folder to open before running the command.
   * Present only for in-pipeline cards where there is a project folder.
   * Undefined for pre-pipeline cards (discovered/recommended) and terminal states.
   */
  openPath?: string;
  /** Human-readable label describing the action (Spanish, UI-facing). */
  label: string;
};

export type NextStepInput = {
  cardStatus?: IdeaStatus;
  phase?: Phase;
  advancePending?: boolean;
};

/**
 * Map a card's lifecycle position to the next /pandacorp:* command to run.
 *
 * Pure: no I/O, no writes, no side effects. Never throws.
 *
 * @param input - Partial lifecycle position. All fields are optional; absent
 *   fields produce a safe, deterministic fallback (never a wrong phase command).
 * @returns A fully-typed NextStep with non-empty command and label.
 */
export function nextStep(input: NextStepInput): NextStep;
```

### Mapping table (AC-02-004.1, canonical source: CLAUDE.md operation table)

| `cardStatus` | `phase` | `advancePending` | `command` |
|---|---|---|---|
| `discovered` | — | — | `/pandacorp:spec <idea>` |
| `recommended` | — | — | `/pandacorp:spec <idea>` |
| `in-pipeline` | `product` | `false` / `undefined` | `/pandacorp:design` |
| `in-pipeline` | `design` | `false` / `undefined` | `/pandacorp:blueprint` |
| `in-pipeline` | `architecture` | `false` / `undefined` | `/pandacorp:implement` |
| `in-pipeline` | `implementation` | `false` / `undefined` | `/pandacorp:release` |
| `in-pipeline` | `release` | `false` / `undefined` | `/pandacorp:release` |
| `in-pipeline` | `operation` | `false` / `undefined` | `/pandacorp:iterate` |
| `in-pipeline` | `product` | `true` | `/pandacorp:design` (label carries advance hint) |
| `in-pipeline` | any | `true` | same command; `label` adds `" — escribe «ok, advance» para continuar"` |
| `in-pipeline` | `undefined` | — | `/pandacorp:spec <idea>` (safe fallback, see regressions) |
| `shipped` | — | — | `/pandacorp:review-launch` |
| `discarded` | — | — | `/pandacorp:recommend` |
| `undefined` / unknown | — | — | `/pandacorp:spec <idea>` (default pre-pipeline fallback) |

### DR-032 — `advancePending` flag

When `advancePending: true`, the `label` gains the suffix
`" — escribe «ok, advance» para continuar"` so the owner knows they need to give the
go-ahead acknowledgement, not just run the normal next command. The `command` itself does
not change — only the `label` differs, which is sufficient to satisfy the DR-032 contract
(the test verifies `commandDiffers || labelDiffers`).

### Regression anchors

| Regression | Description | Behaviour |
|---|---|---|
| **B1' (2026-06-16)** | NaN bypasses `typeof` guards upstream; `readStatus` rejects it, sending `phase: undefined` to `nextStep`. | `phase: undefined` on `in-pipeline` → safe fallback `/pandacorp:spec <idea>`, never a phase-specific command. |
| **I3 (2026-06-16)** | Array-shaped phase values bypass `typeof`; `readStatus` rejects them as `undefined`. | Same `undefined` phase path applies. |

### Invariants

- **Pure:** no I/O, no writes, no network, no Claude calls, no side effects.
- **Never throws** — all input combinations produce a valid `NextStep` object.
- **No pipeline command for terminal states** — `shipped` and `discarded` never produce
  `/pandacorp:spec <idea>`, `/pandacorp:design`, `/pandacorp:blueprint`,
  `/pandacorp:implement`, or `/pandacorp:release`.
- **`implementation` and `release` share the same command** (`/pandacorp:release`) per spec.
- **`discovered` and `recommended` share the same command** (`/pandacorp:spec <idea>`).
- **`openPath` is either a `string` or `undefined`** — never `null`, never a number.
- **Deterministic:** same inputs always produce the same output (no randomness, no date math).
- **Input objects are never mutated.**
- **All commands are distinct per phase** except the two documented aliases above.

### Consumption (downstream features)

- **`components/CardDetail.tsx`** (CMP-02-card-detail, WO-02-007): calls `nextStep({ cardStatus: card.status, phase: status?.phase, advancePending: status?.advancePending })` and passes `result.command` to `<CopyButton value={result.command} />` with `result.label` as the button label.
- **FRD-03 portfolio** and **FRD-04 workspace**: may call `nextStep` for recovery commands (outbound dependency listed in WO-02-003 README).

### Test coverage

`lib/next-step.test.ts` — 57 tests across 8 groups (vitest, pure — no fs, no mocks):
`discovered`/`recommended` → spec, `in-pipeline` + each of 6 phases, DR-032 `advancePending` flag
(pending vs non-pending label divergence), terminal statuses, edge cases + missing inputs,
complete mutation-killing mapping table (10 rows), pure-function invariants, regression B1' + I3.

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

## WO-01-006: `readProjectDocs` — feature-centric docs tree discovery

**Module:** `lib/docs.ts`
**Traces:** CMP-01-docs, IF-01-readProjectDocs; REQ-01-007; AC-01-007.1
**Dependencies:** WO-01-000 (fixtures), WO-01-001 (pathExists)

### IF-01-readProjectDocs

```ts
// lib/docs.ts

export type FrdModule = {
  /** Directory name under docs/frds/ (e.g. "frd-01-data-reading") — no path separators. */
  slug: string;
  hasFdd: boolean;       // fdd.md present in the FRD directory
  hasBlueprint: boolean; // blueprint.md present in the FRD directory
  hasMocks: boolean;     // mocks/ subdirectory present
  hasWorkOrders: boolean; // work-orders/ subdirectory present
};

export type ProjectDocsIndex = {
  prd?: string;          // absolute path to docs/product/prd.md (when exists)
  architecture?: string; // absolute path to docs/product/architecture.md (when exists)
  frds: FrdModule[];     // one entry per docs/frds/frd-NN-<slug>/ directory; always a genuine Array
  hasAdr: boolean;       // docs/adr/ directory exists
  hasAnalytics: boolean; // docs/analytics/ directory exists
  hasDecisionLog: boolean; // docs/decision-log.md file exists
  comms: {
    progress?: string;   // absolute path to .pandacorp/comms/progress.md (when exists)
    decisions?: string;  // absolute path to .pandacorp/inbox/decisions.md (when exists)
    bugs: string[];      // absolute paths of .md files in .pandacorp/inbox/bugs/; always an Array
  };
};

/**
 * Discover the feature-centric docs tree for a project.
 * Discovery only — does NOT read file contents.
 * @param projectPath - Absolute path to the project root.
 * @returns ProjectDocsIndex. Never throws.
 */
export function readProjectDocs(projectPath: string): ProjectDocsIndex;
```

### Behaviour

| Layer | Probed path | Result field |
|---|---|---|
| Product PRD | `docs/product/prd.md` | `prd` (absolute path or undefined) |
| Product architecture | `docs/product/architecture.md` | `architecture` (absolute path or undefined) |
| FRD modules | `docs/frds/frd-NN-*/` (dirs matching `/^frd-\d/`) | `frds` (one FrdModule each) |
| ADR | `docs/adr/` | `hasAdr: boolean` |
| Analytics | `docs/analytics/` | `hasAnalytics: boolean` |
| Decision log | `docs/decision-log.md` | `hasDecisionLog: boolean` |
| Comms progress | `.pandacorp/comms/progress.md` | `comms.progress` (path or undefined) |
| Comms decisions | `.pandacorp/inbox/decisions.md` | `comms.decisions` (path or undefined) |
| Bugs | `.pandacorp/inbox/bugs/*.md` | `comms.bugs` (array of absolute paths) |

### FRD module detection

Each subdirectory of `docs/frds/` whose name matches `/^frd-\d/` is enumerated.
Non-matching names (`shared/`, `README/`, etc.) are silently ignored.
An empty FRD directory produces an `FrdModule` with all flags `false` (no vacuous-truth — regression I2).

### Tolerance rules (blueprint §3 fail-soft)

| Condition | Result |
|---|---|
| `projectPath` blank / empty | Empty index, no throw |
| `projectPath` does not exist | Empty index, no throw (REQ-01-010) |
| `docs/product/` absent | `prd` and `architecture` are `undefined` |
| `docs/frds/` absent | `frds: []` |
| FRD dir exists but is empty | FrdModule with all flags `false` (regression I2) |
| `docs/adr/`, `docs/analytics/` absent | `false` |
| `docs/decision-log.md` absent | `hasDecisionLog: false` |
| `.pandacorp/` absent | `comms: { bugs: [] }` |
| `bugs/` present but no `.md` files | `comms.bugs: []` (regression B1': no NaN arithmetic) |
| Non-`.md` files in `bugs/` | Filtered out |

### Regression anchors

- **B1' (2026-06-16):** counts derived from `Array.length` only — never from arithmetic that could yield NaN.
- **I2 (2026-06-16):** empty FRD dirs produce all-false flags (no vacuous-truth).
- **I3 (2026-06-16):** `frds` and `comms.bugs` are genuine JS Arrays; `slug` is a plain string.

### Invariants (REQ-01-011)

- Read-only: `fs.existsSync` / `fs.readdirSync` / `fs.statSync` only — no writes, no Claude.
- Never throws: all fs errors caught; absent layers yield empty/false/undefined.
- Fully serializable: all fields are `string | string[] | boolean | undefined`.
- Idempotent and synchronous (safe for Next.js Server Components).

### Test coverage

`lib/docs.test.ts` — 65 tests across 9 groups (vitest, no mocks, fixture-based + temp dirs):
product-layer paths, FRD modules enumeration (happy path + pattern filtering + empty dir),
global docs booleans, `.pandacorp/` comms layer, fail-soft bare/empty project, non-existent path,
regression B1'/I2/I3 anchors, shape invariants, idempotency.

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
  [key: string]: unknown;
  duration: Record<string, number>;  // ms values, all < 300; must be a non-array plain object with ≥1 entry
  easing: Record<string, string>;    // named token map (not an array); 2–3 entries, CSS cubic-bezier strings
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
| `motion.duration` is a non-array plain object with ≥1 entry | `motion.duration: must be a plain object (token map), not an array or primitive` / `motion.duration: must declare at least one duration token` |
| All `motion.duration.*` values are **finite** numbers (ms) — NaN/±Infinity rejected | `motion.duration.<key>: must be a finite number (ms), got NaN/Infinity` |
| All `motion.duration.*` values < 300ms | `motion.duration.<key>: duration Nms violates the <300ms constraint` |
| `motion.easing` is a non-array plain object | `motion.easing: must be a plain object (named token map), not an array or primitive` |
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

---

## WO-01-008: OnboardingGate — full-screen configuration gate

**Module:** `components/OnboardingGate.tsx`
**Traces:** CMP-01-onboarding-gate; REQ-01-001; AC-01-001.1
**Dependencies:** WO-01-002 (`readProfile`, `ProfileResult`), WO-02-002 (`CopyButton`)

### Purpose

Shown as the **entire view** when `readProfile()` returns `{ present: false }` — i.e. when
`factory/profile.md` is absent. Nothing else renders behind it. Once the profile exists, the gate
disappears on page reload.

### Signature

```tsx
// components/OnboardingGate.tsx
// Server Component — no hooks, no browser APIs.

export function OnboardingGate(): React.JSX.Element;
```

### Layout guard

The gate is activated by a guard in `app/layout.tsx` (Server Component) that calls `readProfile()`
at render time:

```tsx
// app/layout.tsx (sketch — not a standalone export)
const result = readProfile();
if (!result.present) {
  return <OnboardingGate />;
}
return <>{children}</>;
```

The guard decision is a pure boolean function of `ProfileResult`:

```ts
function shouldRenderGate(result: ProfileResult): boolean {
  return !result.present;
}
```

| `ProfileResult` | Guard decision | View rendered |
|---|---|---|
| `{ present: false }` | `true` | `<OnboardingGate />` only |
| `{ present: true, profile: { body: "" } }` | `false` | `children` only |
| `{ present: true, profile: { ... } }` | `false` | `children` only |

### Component contract

| Property | Value |
|---|---|
| **testid (root)** | `data-testid="onboarding-gate"` on the `<main>` element |
| **testid (heading)** | `data-testid="onboarding-gate-heading"` on the `<h1>` |
| **testid (description)** | `data-testid="onboarding-gate-description"` on the explanatory `<p>` |
| **testid (command)** | `data-testid="onboarding-gate-command"` on the `<code>` element |
| **testid (copy button)** | `data-testid="copy-button"` (inherited from `CopyButton`) |
| **Command text** | `/pandacorp:onboarding` (exact string, no trailing space) |
| **Description must reference** | `factory/profile.md` (the file that is missing) |
| **Hint text** | References reloading / returning after the profile is created |
| **Language** | Spanish copy throughout (DR-009) |
| **aria-label** | Spanish, on the `<main>` landmark (not "onboarding", not "setup") |
| **Heading level** | `<h1>` or `<h2>` — never a `<div>` |
| **Landmark** | `<main>` or `role="region"` |
| **Colors** | Zero hardcoded hex/rgb/hsl literals — CSS custom properties only |
| **Server Component** | Safe — no `useState`, no `useEffect`, no browser APIs |
| **Writes** | None — no disk write, no Claude call |

### CSS custom properties used (design-token-ready)

| Property | Purpose |
|---|---|
| `--color-surface` | Page background |
| `--color-surface-panel` | Card/panel background |
| `--color-text` | Primary text |
| `--color-text-muted` | Secondary/hint text |
| `--color-border` | Card border |
| `--color-accent` | Command code highlight |
| `--color-surface-code` | Code block background |
| `--spacing` | Base spacing unit (0.25rem default) |
| `--radius` | Border radius |
| `--shadow-panel` | Card elevation shadow |

All properties fall back to semantic system values (`Canvas`, `currentColor`, etc.) so the gate
renders correctly before the design-system WO freezes the actual token values.

### Test coverage

`components/OnboardingGate.test.tsx` (jsdom, vitest) — 15 tests across 5 groups:
rendering, copy affordance, accessibility, content contracts, layout guard helper.

`components/OnboardingGate.gaps.test.tsx` (jsdom, vitest) — supplemental gap coverage:
- GAP-1: children not rendered behind the gate
- GAP-2: description references `factory/profile.md` specifically
- GAP-3: aria-label on the gate landmark in Spanish (DR-009)
- GAP-4: hint text about reloading after configuration
- GAP-5: zero hardcoded color values in inline styles
- GAP-6: guard typed against the real `ProfileResult` discriminated union from `lib/profile.ts`

`app/layout.guard.test.tsx` (jsdom, vitest) — 8 mutation-killing tests:
Invokes the real `RootLayout` from `app/layout.tsx` against a temp `PANDACORP_FACTORY_ROOT`.
- Profile absent → `<OnboardingGate />` rendered, children absent.
- Profile present (valid, empty, malformed) → children rendered, gate absent.
- `<html lang="es">` invariant (DR-009).
- Read-only invariant: absent profile is not created on layout render (REQ-01-011).
Kills: inverted-guard mutant, always-gate mutant, always-children mutant.

---

## WO-12-002: `deriveKpis` — ≤5 critical KPI selector (incl. failed work orders)

**Module:** `app/_observability/selectors/kpis.ts`
**Traces:** IF-12-kpis; REQ-12-001, REQ-12-007; AC-12-001.1, AC-12-007.1
**Dependencies:** WO-01-007 (`Event` type from `lib/events.ts`), WO-03-001 (`ProjectListItem` from `lib/portfolio.ts`)

### IF-12-kpis

```ts
// app/_observability/selectors/kpis.ts

export type Kpi = {
  /** Machine identifier — one of the 5 canonical keys (see below). */
  key: string;
  /** Human-readable label in Spanish (UI-facing). */
  label: string;
  /** Derived numeric count. Always a finite non-negative integer. */
  value: number;
  /**
   * Optional human-readable context string.
   * Present (and non-empty) for "failed-work-orders" when failedCount > 0;
   * contains the comma-separated list of unique work-order IDs from fail events,
   * or a fallback count phrase when no workOrder field is present.
   * Undefined (or omitted) when there are no failures.
   */
  detail?: string;
};

/**
 * Derive exactly 5 critical KPIs from the capped event tail and the active-projects list.
 *
 * Pure: no I/O, no env reads, no Claude calls, no side effects. Never throws.
 *
 * @param events   - Already-parsed, capped Event[] from lib/events (no re-reading the file
 *                   — blueprint §3, REQ-12-007: no extra instrumentation).
 * @param projects - Projects list; only the `stage` field is consumed.
 *                   Compatible with ProjectListItem[] from lib/portfolio.ts activeProjects().
 * @returns An array of exactly 5 Kpi objects in specification order.
 */
export function deriveKpis(events: Event[], projects: { stage?: string }[]): Kpi[];
```

### Canonical KPIs (always returned, always in this order)

| Index | `key` | `label` | Derivation |
|---|---|---|---|
| 0 | `active-projects` | `Proyectos activos` | Count of projects whose `stage` is in `{architecture, implementation, release, operation}` |
| 1 | `agents-working` | `Agentes trabajando` | Count of distinct `agent` string values from `AgentWorking` events |
| 2 | `xp-today` | `XP del día` | Count of `XpAwarded` events in the tail |
| 3 | `builds-queued` | `Builds en cola` | Count of `BuildQueued` events in the tail |
| 4 | `failed-work-orders` | `Work orders fallidos` | Count of events with `status === "fail"` (exact string equality) |

### Detail field contract for `failed-work-orders`

| Condition | `detail` value |
|---|---|
| `failedCount === 0` | `undefined` (field omitted) |
| `failedCount > 0` and at least one fail event has a `workOrder` field | Comma-separated list of unique work-order IDs in insertion order (e.g. `"WO-01-001, WO-02-001"`) |
| `failedCount > 0` and no fail event has a `workOrder` field | Fallback string: `"N evento(s) con error"` where N is `failedCount` |

### Active phases for `active-projects`

`architecture`, `implementation`, `release`, `operation`.

Note: this is a **scalar count** (not a ranking), so it is NOT capped at 5 (REQ-12-004 applies
to rankings/groupings, not to this aggregated scalar). A factory with 10 active projects yields
`value: 10`, not `value: 5`.

### Honest metrics (AC-12-007.1)

All 5 KPI values are derived **exclusively** from the `events` and `projects` inputs. No extra
instrumentation, no filesystem reads, no environment probes. The same event list always produces
the same result (pure function).

### Invariants

| Invariant | Value |
|---|---|
| Output length | Always exactly 5 |
| All `value` fields | Finite non-negative integers (never NaN, never Infinity, never negative) |
| All required fields | `key`, `label`, `value` present on every Kpi |
| Canonical keys | Each of the 5 canonical keys appears exactly once |
| `active-projects` bound | `value` ≤ `projects.length` |
| `failed-work-orders` bound | `value` ≤ `events.length` |
| `agents-working` bound | `value` ≤ distinct `agent` count in events |
| Mutation isolation | Returned array is a fresh value; calling again does not mutate previous result |
| Pure | No I/O, no `process.env`, no Claude calls |
| Never throws | For any combination of empty, sparse, or large inputs |

### Regression anchors

| Anchor | Description | Guard |
|---|---|---|
| **B1' (2026-06-16)** | `typeof NaN === "number"` — counts must use `Number.isFinite` | All counts use `+= 1` or `Set.size` (always finite integers); `safeCount()` guard rejects any non-finite value at the last mile |
| **I2 (2026-06-16)** | Empty inputs must return zeroed values, not `undefined` | `events = []` → all counts are 0; `projects = []` → `active-projects = 0` |
| **I3 (2026-06-16)** | `status === "fail"` is exact string equality | Only the literal string `"fail"` increments `failedCount`; `undefined`, `"ok"`, or array values are excluded |
| **FREEZE-ON-RED** | Events missing optional fields must not throw | Every field access guards with `typeof ev.field === "string"` before use |
| **WO-01-005 I3** | `agent` must be a string before counting | `typeof ev.agent === "string"` guard before `activeAgents.add(ev.agent)` |

### Consumption (downstream features)

- **`CMP-12-kpi-header`** (WO-12-005): Server Component that calls `deriveKpis(events, projects)` server-side and renders the 5 KPI tiles in the global header (AC-12-001.1).
- **FRD-06 Party** / **FRD-18 dashboard**: may consume `deriveKpis` to surface the same KPIs in the Party panel and the dashboard overview.

### Test coverage

`app/_observability/selectors/kpis.test.ts` — 56 tests across 6 groups (vitest, pure — no fs, no mocks):

| Group | Coverage |
|---|---|
| AC-12-001.1 output shape | Length always 5; all canonical keys present exactly once; all fields typed correctly |
| AC-12-001.1 `active-projects` KPI | Active phases counted; non-active phases excluded; `exists: false` does not block count; scalar count not capped at 5 |
| AC-12-001.1 `agents-working` KPI | Distinct agents from `AgentWorking` events; same agent deduped; no-agent events excluded; non-AgentWorking events excluded |
| AC-12-001.1 `failed-work-orders` KPI | `fail` events counted; `ok` / `undefined` excluded (regression I3); `detail` populated with WO IDs; `detail` undefined on 0 failures |
| AC-12-007.1 honest metrics | Deterministic / pure; derived solely from event list; handles 200-event cap synchronously; env-independence confirmed |
| Error paths / regression anchors | B1' (no NaN values), I2 (empty → all-zero), FREEZE-ON-RED (sparse events no throw), mutation isolation |
| Property-based invariant table | 12 parametric cases covering all KPIs, output length, value bounds, and mix of active/non-active stages |
| Specific behavior assertions | Concrete value assertions (not just truthy); key uniqueness; label non-empty |

---

## WO-12-001: `topN` + `freshness` — observability selectors

**Module:** `app/_observability/selectors/topn.ts` + `app/_observability/selectors/freshness.ts`
**Traces:** IF-12-topn -> REQ-12-004 -> AC-12-004.1; IF-12-freshness -> REQ-12-002 -> AC-12-002.1
**Dependencies:** `lib/events.ts` (`Event` type - no I/O; selectors are pure over the already-parsed tail)

These are the first two pure selectors of FRD-12's honest data layer. They are consumed by every
downstream ranking/grouping (topN) and by the Live/No-signal badge (freshness). No HTTP, no I/O,
no Claude calls - they operate over the `Event[]` slice already produced by `readEvents`.

---

### IF-12-topn - `topN` bounded-ranking helper

**File:** `app/_observability/selectors/topn.ts`

#### Signature

```ts
/** The default cap enforcing the top-5 invariant (REQ-12-004, AC-12-004.1). */
export const DEFAULT_TOPN = 5;

/**
 * Return the first `n` items of `items`, enforcing the top-5 cap by default.
 * Does NOT sort - the caller pre-ranks the input. topN only caps.
 *
 * @param items - Pre-ranked list. Any element type T.
 * @param n     - Maximum items. Defaults to 5.
 *   undefined -> 5 | NaN -> 5 (B1') | +Infinity -> all | negative -> 0 | 0 -> []
 * @returns Independent shallow slice. Never throws.
 */
export function topN<T>(items: T[], n?: number): T[];
```

#### Behaviour contract

| Input | Result |
|---|---|
| `n` omitted | First 5 items (DEFAULT_TOPN) |
| `n = 3` | First 3 items |
| `n = 0` | `[]` (boundary) |
| `n > items.length` | All items (no padding) |
| `n = NaN` | Falls back to DEFAULT_TOPN = 5 (B1' anchor) |
| `n = +Infinity` | All items (no throw) |
| `n < 0` | `[]` (clamp) |
| `items = []` | `[]` for any `n` |

#### Key invariants

- **Order preservation:** `topN(items, n)[k] === items[k]` for all `k < min(n, items.length)`
- **Idempotency:** `topN(topN(items, n), n)` equals `topN(items, n)`
- **Independence:** mutating result does not mutate source; vice-versa
- **Generic:** works for `T = number | string | object | T[]` - no `typeof` guards on items
- **Pure, never throws** for any input combination

#### Regression anchors

| Anchor | Guard |
|---|---|
| **B1' (WO-13-001):** `slice(0, NaN) === []` silently hides all items | `Number.isNaN(n)` before any arithmetic; NaN -> DEFAULT_TOPN |
| **I3 (WO-13-001):** arrays-as-T must not confuse generic slice | Generic `T` - no `typeof` on items themselves |
| **FREEZE-ON-RED:** must never throw | No throw in any code path; edge cases produce `[]` |

#### Test coverage

`app/_observability/selectors/topn.test.ts` - 117 tests across 9 groups (vitest, pure):
default cap (5 cases), explicit n override (7), empty input (4), output independence (3),
generic T (4), order preservation parametric (25 = 5 lengths x 5 caps),
idempotency parametric (6), length invariant (4), NaN/non-finite regression (4),
never-throws matrix (6).

---

### IF-12-freshness - `freshness` live/stale selector

**File:** `app/_observability/selectors/freshness.ts`

#### Signature

```ts
import type { Event } from "../../../lib/events";

/**
 * Window within which an event is "live" (not "Sin senial").
 * Named constant, NOT a magic number (blueprint section 3). Tests import it.
 * Value: 5 minutes = 300 000 ms.
 */
export const FRESHNESS_THRESHOLD_MS = 300_000;

/**
 * Compute data freshness from the capped event tail.
 *
 * @param events - Already-parsed Event[] from lib/events (no I/O).
 *                 Events with unparseable `at` are silently skipped (B1' anchor).
 * @param now    - Reference instant (injected - no internal Date.now()).
 * @returns { lastAt: string | null; live: boolean }
 *   lastAt: max valid `at` ISO string, or null when none exist.
 *   live: true when gap < FRESHNESS_THRESHOLD_MS; false otherwise ("Sin senial").
 */
export function freshness(events: Event[], now: Date): { lastAt: string | null; live: boolean };
```

#### Behaviour contract (EARS)

| Condition | `lastAt` | `live` |
|---|---|---|
| `events = []` | `null` | `false` - "Sin senial" |
| One event with valid `at` | that event's `at` | gap to `now` < threshold |
| Multiple events (any order) | maximum valid `at` | gap to `now` < threshold |
| All events have invalid `at` | `null` | `false` |
| Mix valid + invalid `at` | maximum valid `at` | gap to `now` < threshold |
| Gap < `FRESHNESS_THRESHOLD_MS` | - | `true` (live) |
| Gap = `FRESHNESS_THRESHOLD_MS` | - | `false` (boundary: stale) |
| Gap > `FRESHNESS_THRESHOLD_MS` | - | `false` (stale) |

#### `live` boundary rule

```
gap  = now.getTime() - Date.parse(lastAt)
live = gap < FRESHNESS_THRESHOLD_MS    // strictly less-than; at == -> false
```

#### `FRESHNESS_THRESHOLD_MS` contract

| Property | Value |
|---|---|
| Exported named constant | `export const FRESHNESS_THRESHOLD_MS` |
| Type | `number`, finite, positive |
| Minimum | >= 30 000 (30 s) |
| Current | 300 000 (5 min) |

Tests import this constant and assert against it - never embed the raw integer - so
changing the threshold propagates automatically without test rewrites.

#### Key invariants

- **Order-independent:** `lastAt` is the max `at` regardless of array position
- **Skip-not-corrupt:** invalid `at` silently skipped; `lastAt` is never NaN
- **Return shape:** always `{ lastAt: string | null, live: boolean }` - exact two keys
- **`live` strict boolean:** `typeof live === "boolean"` - never truthy/falsy
- **Pure + idempotent:** no `Date.now()`, no side-effects; same inputs -> same output
- **Never throws** for any input combination

#### Regression anchors

| Anchor | Guard |
|---|---|
| **B1' (WO-13-001):** `Date.parse("bad") === NaN`; `NaN <= threshold` is `false`, silently treating a valid recent event as stale | `Number.isFinite(Date.parse(ev.at))` before including any event; `lastAt` only set from passing events |
| **I2 (WO-13-001):** `freshness([])` must return `{ lastAt: null, live: false }`, not throw | `lastAt` initialised to `null`; early return on `null` after the loop |
| **FREEZE-ON-RED:** per-item errors must not abort the batch | Each event processed independently; bad `at` -> `continue`, not `throw` |

#### Downstream consumption

| Consumer | Usage |
|---|---|
| **`CMP-12-freshness` / `FreshnessBadge`** (WO-12-005) | Calls `freshness(events, new Date())` server-side; renders `lastAt` as the timestamp label and `live` as the Live/No-signal indicator. Consumed by FRD-06 Party panel. |
| **`CMP-12-kpi-header` / `KpiHeader`** (WO-12-002+) | Passes `live` to the header status indicator. |

#### Test coverage

`app/_observability/selectors/freshness.test.ts` - 117 tests across 10 groups (vitest, pure):
empty -> Sin senial (4), lastAt is max `at` (6), live=true within threshold (4),
live=false beyond threshold (5), boundary sweep parametric (8 points),
`FRESHNESS_THRESHOLD_MS` as named constant (3), return shape invariant (4 scenarios),
B1' regression invalid `at` (4), max-at across permutations (6), idempotency (1),
never-throws matrix (4).
