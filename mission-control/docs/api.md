# Mission Control — API Contract

> **Source-of-truth hierarchy:** `FRD > design-tokens > blueprint > work order > this file`.
> This document describes the **pure TypeScript interfaces** and **shared component contracts**
> produced by each work order. There are no HTTP endpoints in this scope — Mission Control is a
> local, read-only Next.js app that reads files from the factory filesystem. The "API" here is the
> **internal module and component contract** that downstream features consume.
>
> Status: **complete for WO-01-000** (test fixtures + harness) +
> **complete for WO-13-001** (IF-13-tokens, IF-13-agent-colors, IF-13-state-vocab) +
> **complete for WO-02-002** (CMP-02-copy-button).

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
export function readProfile(): ProfileResult;
// Tolerance: absent file → { present: false }; malformed frontmatter → present with partial fields.

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
export function readPortfolio(): PortfolioEntry[];
// Tolerance: absent/empty file → []; rows with missing cells degrade to undefined fields.

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
export function readEvents(opts?: { cap?: number }): EventsSnapshot;
// Default cap: 200. Tolerance: absent file → empty snapshot; malformed JSON line skipped.

// lib/docs.ts
type FrdModule = {
  slug: string; hasFdd: boolean; hasBlueprint: boolean;
  hasMocks: boolean; hasWorkOrders: boolean;
};
type ProjectDocsIndex = {
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
