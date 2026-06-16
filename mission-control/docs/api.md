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
> **complete for WO-11-001** (IF-11-modes `BUILD_MODES`/`DEFAULT_BUILD_MODE`, IF-11-mode-store `getRememberedMode`/`rememberMode`) +
> **complete for WO-12-003** (IF-12-rate `eventsPerMinute`, `app/_observability/selectors/rate.ts`) +
> **complete for WO-15-001** (IF-15-sync `readInstalledSha`/`readPluginHeadSha`/`readPluginDirty`, `lib/plugin-sync.ts`) +
> **complete for WO-12-004** (IF-12-timeline `toTimeline`, `app/_observability/selectors/timeline.ts`) +
> **complete for WO-16-001** (IF-16-scan `resolveProjectsPath`/`listProjectFolders`, `lib/orphans.ts`) +
> **complete for WO-04-001** (IF-04-docs `listProjectDocs`/`readDoc`, `lib/docs.ts` additions) +
> **complete for WO-04-002** (IF-04-docs `readActivityLog`/`readDecisions`, `lib/docs.ts` comms readers) +
> **complete for WO-04-003** (IF-04-next-step `workspaceCommands`/`CommandRow`, `lib/next-step.ts` extension) +
> **complete for WO-17-001** (IF-17-memory `readLessons`/`candidateLessons`/`promotionQueue`/`prunable`, `lib/memory.ts`) +
> **complete for WO-05-001** (IF-05-work-orders `listWorkOrders`/`aggregateProgress`, `lib/work-orders.ts`) +
> **complete for WO-02-006** (CMP-02-intake-modal, `components/IntakeModal.tsx`) +
> **complete for WO-13-005** (CMP-13-state-badge `StateBadge`, `components/StateBadge.tsx`) +
> **complete for WO-02-007** (CMP-02-card-detail `CardDetail`, `components/CardDetail.tsx`) +
> **complete for WO-13-002** (CMP-13-globals `app/globals.css` — theme vars, elevation, motion, reduced-motion, focus ring).

---

## WO-13-002: `app/globals.css` — token wiring (CMP-13-globals, IF-13-theme-vars)

**File:** `app/globals.css`
**Kind:** CSS (Tailwind v4 `@theme`, global styles)
**Traces:** CMP-13-globals, IF-13-theme-vars; REQ-13-001, REQ-13-002, REQ-13-004, REQ-13-005, REQ-13-006, REQ-13-008
**Depends on:** WO-13-001 (`app/_design/tokens.ts` — AGENT_COLOR keys match `--color-agent-<role>` vars here)
**Consumed by:** Every styled component across FRD-02..06, FRD-10, FRD-12; FRD-06 Party engine (reduced-motion check); FRD-12 DAG node colours

### Purpose

Maps the frozen `docs/design/design-tokens.json` into Tailwind v4 `@theme` CSS custom properties. This is the **single place** where raw token values appear; every other file uses `var(--*)` references. No hardcoded colours, no RGB/HSL/hex in theme blocks.

### Custom property inventory (`@theme`)

| CSS variable | Category | Value |
|---|---|---|
| `--color-base` | OKLCH base | `oklch(0.15 0.02 230)` |
| `--color-accent` | OKLCH accent (single rationed, AC-13-002.1) | `oklch(0.75 0.18 60)` |
| `--color-contrast` | OKLCH contrast | `oklch(0.97 0.01 230)` |
| `--color-surface` | Theme surface (overridden per mode) | dark default |
| `--color-text` | Theme text (overridden per mode) | dark default |
| `--color-agent-researcher` | Per-agent colour (IF-13-agent-colors) | `oklch(0.65 0.18 45)` |
| `--color-agent-backend-dev` | Per-agent colour | `oklch(0.55 0.2 260)` |
| `--color-agent-frontend-dev` | Per-agent colour | `oklch(0.65 0.22 200)` |
| `--color-agent-test-writer` | Per-agent colour | `oklch(0.7 0.2 130)` |
| `--color-agent-reviewer` | Per-agent colour | `oklch(0.65 0.2 300)` |
| `--color-agent-security-auditor` | Per-agent colour | `oklch(0.6 0.18 20)` |
| `--color-agent-architect` | Per-agent colour | `oklch(0.6 0.2 240)` |
| `--color-agent-product-manager` | Per-agent colour | `oklch(0.7 0.18 85)` |
| `--color-agent-designer` | Per-agent colour | `oklch(0.7 0.22 330)` |
| `--color-agent-guild` | Per-agent colour | `oklch(0.75 0.16 60)` |
| `--shadow-0` | Elevation level 0 — canvas (AC-13-004.1) | `none` |
| `--shadow-1` | Elevation level 1 — panel | `0 1px 4px oklch(0 0 0 / 0.15)` |
| `--shadow-2` | Elevation level 2 — card/popup | `0 4px 16px oklch(0 0 0 / 0.25)` |
| `--radius` | Base radius (8px = 0.5rem, AC-13-004.1) | `0.5rem` |
| `--spacing` | Base spacing (16px = 1rem, AC-13-004.1) | `1rem` |
| `--hairline` | Hairline border (AC-13-004.1) | `1px` |
| `--duration-fast` | Motion duration fast (AC-13-005.1: <300ms) | `150ms` |
| `--duration-base` | Motion duration base | `200ms` |
| `--duration-expressive` | Motion duration expressive | `280ms` |
| `--easing-standard` | Named easing 1/2 (AC-13-005.1: 2-3 tokens) | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--easing-decelerate` | Named easing 2/2 | `cubic-bezier(0, 0, 0.2, 1)` |
| `--focus-ring` | Tokenised focus ring (AC-13-008.1) | `2px solid var(--color-accent)` |
| `--color-backdrop` | Overlay backdrop helper | `oklch(0 0 0 / 0.6)` |

### Theme mode switching (AC-13-001.1)

| Selector | Mode | Surface | Text |
|---|---|---|---|
| `[data-theme="light"]` | Light | `oklch(0.97 0.005 230)` | `oklch(0.12 0.02 230)` |
| `[data-theme="dark"]` | Dark | `oklch(0.1 0.015 230)` | `oklch(0.95 0.01 230)` |
| `@media (prefers-color-scheme: dark)` on `:root:not([data-theme])` | System dark default | same as dark | same as dark |
| `@media (prefers-color-scheme: light)` on `:root:not([data-theme])` | System light default | same as light | same as light |
| `[data-theme="high-contrast"]` | High-contrast (no redesign, AC-13-001.1) | `oklch(0 0 0)` | `oklch(1 0 0)` |

Switching `[data-theme]` on the root element changes all resolved `--color-surface` / `--color-text` vars — zero other stylesheets needed.

### Focus ring (AC-13-008.1)

```css
:focus-visible {
  outline: var(--focus-ring);
  outline-offset: 2px;
  border-radius: var(--radius);
}
```

- `:focus-visible` (not `:focus`) — ring only for keyboard navigation, invisible on mouse click.
- `outline` follows `border-radius` natively in modern browsers; `var(--radius)` is set for explicit scope.
- Zero hardcoded colour — references `var(--color-accent)` indirectly via `--focus-ring`.

### Reduced-motion (AC-13-006.1)

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0ms !important;
    scroll-behavior: auto !important;
    --duration-fast: 0ms;
    --duration-base: 0ms;
    --duration-expressive: 0ms;
  }
}
```

- Global `*` wildcard — no component can escape the constraint (no opt-out).
- `!important` required to override any component-level animation declarations (canonical industry pattern for reduced-motion resets; `noImportantStyles` biome rule disabled for this file).
- `--duration-*` CSS vars are also zeroed: the Party engine (WO-06-011) reads them via `getComputedStyle` to decide whether to run its RAF loop. Setting the properties alone would not stop a JS animator that reads the var.

### Animation constraints (AC-13-005.1)

- Only `transform` and `opacity` are permitted in component animations — enforced by review, not by CSS.
- All durations are `<300ms`: fast=150, base=200, expressive=280.
- Exactly 2 easing tokens: `--easing-standard` (enter/exit), `--easing-decelerate` (settling). No per-component curves.

### Contracts for downstream consumers

| Contract | Rule |
|---|---|
| Colour | Always `var(--color-*)` — never hardcoded hex, rgb(), or hsl() in any component file |
| Agent colour | Always `var(--color-agent-<role>)` — never duplicate the OKLCH value; key from `AGENT_COLOR` in `tokens.ts` |
| Elevation | Use `--shadow-0`, `--shadow-1`, `--shadow-2` and `--radius` — do not redefine |
| Motion | Duration via `--duration-*`; easing via `--easing-*`; animate only `transform`/`opacity` |
| Focus | Do not override `:focus-visible` outline in components unless adding `border-radius` refinement |
| Reduced-motion | Do not add `prefers-reduced-motion` blocks in components — the global reset covers all |

### Biome config note

`biome.json` has been updated with:
- `css.parser.tailwindDirectives: true` — enables `@theme`, `@import "tailwindcss"` and other Tailwind v4 CSS directives in the Biome parser.
- `linter.rules.complexity.noImportantStyles: "off"` — `!important` is required in the `prefers-reduced-motion` block to guarantee the override wins regardless of component specificity.

### Test coverage

`app/globals.css.test.ts` — 52 tests across 9 groups (vitest, Node environment — CSS source parsing, no jsdom layout):

| Group | ACs covered |
|---|---|
| Precondition — file exists, non-empty, imports tailwindcss | File present, non-empty, `@import "tailwindcss"` present |
| AC-13-001.1 — `@theme` block: OKLCH vars | `--color-base`, `--color-accent`, `--color-contrast`; `oklch()` in theme; all 10 agent colour vars |
| AC-13-001.1 — theme modes | Light selector + surface/text vars; dark selector + override; high-contrast selector; `color-scheme: light dark` on `:root` |
| AC-13-004.1 — elevation 3 levels + scale | `--shadow-0/1/2`; `--radius: 0.5rem`; `--spacing`; `--hairline: 1px`; 0.25rem multiples present |
| AC-13-005.1 — motion tokens | `--duration-fast/base/expressive`; all durations `<300ms`; `>=2` easing vars; `2-3` easing vars; `cubic-bezier()` values |
| AC-13-006.1 — reduced-motion override | `prefers-reduced-motion: reduce` present; `animation-duration: 0ms !important`; `transition-duration: 0ms !important`; `*` wildcard in block; `--duration-*` vars zeroed |
| AC-13-008.1 — focus ring | `--focus-ring` declared; `:focus-visible` selector; outline references `var(--focus-ring)` or `var(--color-accent)`; `outline-offset`; `border-radius/--radius` present |
| REQ-13-003 — tabular-nums | `html { font-variant-numeric: tabular-nums }` present and in html block |
| Structural invariants | Balanced braces; no hex colours; no `rgb()`/`hsl()` in `@theme`; no NaN/Infinity in duration vars; no array-valued tokens; `>=15` CSS custom properties in `@theme` |
| Round-trip completeness | Every `FROZEN_TOKENS.agents` role in `@theme`; every `motion.duration` key has a CSS var; every `motion.easing` key has a CSS var; exactly 3 elevation CSS vars |

---

## WO-13-005: `components/StateBadge.tsx` — state badge (CMP-13-state-badge)

**Component:** `components/StateBadge.tsx`
**Kind:** Server-safe React component (no `"use client"` — no hooks, no browser APIs)
**Traces:** CMP-13-state-badge; REQ-13-007, REQ-13-008; AC-13-007.1, AC-13-008.1
**Depends on:** WO-13-001 (`STATE_BADGE`, `AGENT_STATES`, `AgentState` from `app/_design/tokens.ts`)
**Consumed by:** Party sprites/feed (FRD-06), DAG nodes (FRD-12), board/portfolio chips (FRD-02/FRD-03)

### IF-13-state-badge — `components/StateBadge.tsx`

```ts
// components/StateBadge.tsx

export interface StateBadgeProps {
  /**
   * The canonical agent state to render.
   * Unknown or empty values render a safe fallback ("Desconocido") — never crashes.
   * Type: AgentState = "working" | "idle" | "failed" | "completed" | "blocked" | "reviewing"
   */
  state: AgentState;
  /**
   * Optional size variant. Defaults to "md".
   * "sm" → 14×14px icon; "md" → 16×16px icon.
   */
  size?: "sm" | "md";
}

/**
 * StateBadge — renders an agent state as icon + shape + Spanish label.
 * NEVER color-only (AC-13-007.1, FRD-13).
 *
 * Guarantees:
 *   - data-testid="state-badge" always present.
 *   - data-icon = Lucide identifier string from STATE_BADGE[state].icon.
 *   - data-state = the state string (enables non-color CSS targeting by consumers).
 *   - aria-label = Spanish label string (AC-13-008.1; never empty).
 *   - Visible <span> label in the DOM — text signal, not color-only.
 *   - No hardcoded hex colors in style attributes (FRD-13 §3).
 *   - Unknown/empty state → safe fallback, never throws.
 *   - role="img" on the container so aria-label is semantically valid.
 */
export function StateBadge(props: StateBadgeProps): React.JSX.Element;
```

### Rendered DOM shape

```html
<span
  role="img"
  data-testid="state-badge"
  data-icon="<lucide-identifier>"
  data-state="<state>"
  aria-label="<Spanish label>"
  style="display:inline-flex;align-items:center;gap:0.25rem;color:var(--color-state-text,currentColor)"
>
  <svg aria-hidden="true" role="presentation"><!-- shape primitive --></svg>
  <span><Spanish label></span>
</span>
```

### State → icon + label mapping (canonical source: `STATE_BADGE` in `app/_design/tokens.ts`)

| `state` | `data-icon` (Lucide id) | `aria-label` / visible label |
|---|---|---|
| `"working"` | `"loader-circle"` | `"Trabajando"` |
| `"idle"` | `"circle-dashed"` | `"En espera"` |
| `"failed"` | `"circle-x"` | `"Fallido"` |
| `"completed"` | `"circle-check"` | `"Completado"` |
| `"blocked"` | `"ban"` | `"Bloqueado"` |
| `"reviewing"` | `"eye"` | `"En revisión"` |
| unknown / empty | `"help-circle"` | `"Desconocido"` |

All 6 canonical icons are geometrically distinct — no two states share the same shape.
`"failed"` (circle-x) and `"completed"` (circle-check) are explicitly distinguishable by icon
and label (critical with the warm palette where red/orange/amber sit close together — AC-13-007.1
regression anchor from FRD-13).

### Icon rendering strategy

`lucide-react` is not installed. Icons are rendered as minimal inline SVGs whose geometry matches
the corresponding Lucide shape (visually equivalent, zero external dependency). The `data-icon`
attribute carries the canonical Lucide identifier string so downstream consumers and tests can
verify the shape signal without parsing SVG path content.

Each `<svg>` is decorative (`aria-hidden="true" role="presentation"`). The accessible name is
provided exclusively by `aria-label` on the outer `role="img"` container.

### Accessibility contract (AC-13-008.1)

| Attribute | Value | Requirement |
|---|---|---|
| `role="img"` on container | Always | Makes `aria-label` valid on `<span>` (biome a11y rule) |
| `aria-label` on container | Spanish label string (non-empty) | AC-13-008.1 |
| `aria-hidden="true"` on inner SVG | Always | Prevents duplicate announcement by AT |
| `role="presentation"` on inner SVG | Always | Suppresses SVG semantics from AT |
| Visible `<span>` label | Spanish label text | Text signal; color is reinforcement only |

### Defensive contract

| Input condition | Result |
|---|---|
| Valid canonical state (any of 6) | Correct icon + Spanish label rendered |
| Unknown string (e.g. `"unknown-state"`) | Fallback: `data-icon="help-circle"`, label `"Desconocido"` — no throw |
| Empty string `""` | Same fallback — no throw |
| `size="sm"` | 14×14px icon; label unchanged |
| `size="md"` or omitted | 16×16px icon (default); label unchanged |
| No hardcoded hex in inline `style` | Verified by test group 8 (`/#[0-9a-fA-F]{3,8}/` check) |

### Architecture invariants

- **No color-only signalling:** every state has a geometrically distinct icon AND a Spanish label. `var(--color-state-text)` is reinforcement only, not the primary signal.
- **No hardcoded colors:** inline `style` uses only CSS custom property references (FRD-13 §3, AGENTS.md rule 4).
- **No external icon dependency:** inline SVG geometry; `lucide-react` not required. `data-icon` preserves the Lucide identifier for future swap-in.
- **Server-safe:** no `"use client"`, no hooks, no browser APIs. Safe for Next.js Server Components.
- **Never throws:** all code paths — including unknown/empty state — return a valid `JSX.Element`.
- **Unique icons per state:** all 6 `STATE_BADGE[state].icon` values are geometrically distinct (enforced by test group 13).

### Test coverage

`components/StateBadge.test.tsx` — 64 tests across 13 groups (vitest + @testing-library/react, jsdom):

| Group | ACs covered |
|---|---|
| 1. Every state has a visible label (AC-13-007.1) | Label text present in DOM for all 6 states |
| 2. Every state exposes `data-icon` | Lucide identifier on `data-icon` for all 6 states |
| 3. `data-testid` presence | `"state-badge"` testid always present |
| 4. Spanish `aria-label` (AC-13-008.1) | `aria-label` = Spanish label for all 6; never empty |
| 5. failed vs completed distinguishable | Label diff, icon diff, rendered text, `data-icon` diff, `data-state` |
| 6. `data-state` on every canonical state | `data-state` = state string for all 6 |
| 7. Unknown state → safe fallback | No throw; testid present; `aria-label` non-empty; empty string safe |
| 8. No hardcoded hex colors | Regex check on inline `style` for working + failed |
| 9. Optional `size` prop | sm / md / omitted all render without throw |
| 10. `STATE_BADGE` vocabulary completeness | 6 entries, all non-empty icon + label (regression WO-13-001) |
| 11. working vs idle distinguishable | Label diff, icon diff, rendered labels |
| 12. blocked vs reviewing distinguishable | Label diff, icon diff |
| 13. All 6 icons unique (AC-13-007.1) | `Set(icons).size === 6`; `Set(labels).size === 6` |

---

## WO-02-007: `components/CardDetail.tsx` — idea card detail + docs navigator (CMP-02-card-detail)

**Component:** `components/CardDetail.tsx`
**Kind:** `"use client"` React component
**Traces:** CMP-02-card-detail; REQ-02-004, REQ-02-008; AC-02-004.1, AC-02-008.1
**Depends on:** WO-02-002 (`CopyButton`), WO-02-003 (`nextStep`), WO-01-006 (`readProjectDocs` / `ProjectDocsIndex`)
**Consumed by:** `app/board/page.tsx` (rendered when the owner clicks a card)
**Read-only:** no writes, no fs calls, no Claude calls. All data arrives as props.

### Props

```ts
import type { IdeaStatus } from "@/lib/ideas";
import type { Phase } from "@/lib/status";
import type { ProjectDocsIndex } from "@/lib/docs";

export interface CardDetailProps {
  /** Filename without .md — uniquely identifies the card. */
  slug: string;
  /** Frontmatter `title` field. */
  title: string;
  /** Frontmatter `status` field — validated IdeaStatus union. */
  status: IdeaStatus;
  /** Markdown body (summary + key points). Rendered via react-markdown. */
  body: string;
  /** Project phase from linked project's status.yaml (in-pipeline only). */
  phase?: Phase;
  /** DR-032: true when a skill finished a phase and is awaiting "ok, advance". */
  advancePending?: boolean;
  /** Result of readProjectDocs(card.project). Null/undefined when no project or docs. */
  docsIndex?: ProjectDocsIndex | null;
}
```

### Rendered structure (`data-testid`)

| `data-testid` | Element | When present |
|---|---|---|
| `card-detail` | `<section>` root | Always |
| `card-detail-summary` | `<div>` | Always — markdown body via react-markdown |
| `card-detail-docs-nav` | `<nav>` | Only when `docsIndex` has at least one navigable entry |
| `card-detail-docs-nav-item` | `<li>` | One per navigable entry (prd, architecture, frds[], adr, analytics, decision-log, comms.progress, comms.decisions, comms.bugs[]) |
| `card-detail-next-step` | `<section>` | Always — shows `nextStep()` result + `CopyButton` |
| `copy-button` | `<button>` | Always — from `CopyButton` component (WO-02-002) |

### Behaviour

- Calls `nextStep({ cardStatus: status, phase, advancePending })` on every render (pure, no side effects).
- Markdown body headings (`h1`–`h6`) are remapped to `<p><strong>` inside the summary to avoid heading-role conflicts with the component's own `<h2>` title.
- The docs navigator is shown **only** when `docsIndex` is non-null and `buildNavEntries(docsIndex)` returns at least one entry (AC-02-008.1 edge: null or empty index → no navigator, no crash).
- No hardcoded color values — all styles use CSS custom properties (`--color-*`, `--spacing`, `--radius`, `--hairline`).
- `aria-label` in Spanish on root (`"Detalle de idea: <title>"`), `<nav>` (`"Documentos del proyecto"`), and next-step section (`"Siguiente comando"`).

### `buildNavEntries(docsIndex)` — nav entry ordering

```
1. prd (if docsIndex.prd)
2. architecture (if docsIndex.architecture)
3. one entry per docsIndex.frds[] (slug as label)
4. adr (if docsIndex.hasAdr)
5. analytics (if docsIndex.hasAnalytics)
6. decision-log (if docsIndex.hasDecisionLog)
7. progress (if docsIndex.comms.progress)
8. decisions (if docsIndex.comms.decisions)
9. one entry per docsIndex.comms.bugs[] (filename as label)
```

---

## WO-02-006: `components/IntakeModal.tsx` — intake command overlay (CMP-02-intake-modal)

**Component:** `components/IntakeModal.tsx`
**Kind:** `"use client"` React component
**Traces:** CMP-02-intake-modal; REQ-02-003; AC-02-003.1, AC-02-003.2, AC-02-003.3
**Depends on:** WO-02-002 (`CopyButton`)
**Consumed by:** `app/board/page.tsx` (board page renders this alongside the board; the board stays mounted)
**Read-only:** no writes, no Claude calls.

### Props

```ts
export interface IntakeModalProps {
  /** Whether the modal is currently open and visible. */
  open: boolean;
  /** Callback invoked when the user requests to close the modal (backdrop click, ✕, Escape). */
  onClose: () => void;
}
```

### Behaviour contract

| Condition | Guarantee |
|---|---|
| `open=true` | Modal root is present in DOM with `data-testid="intake-modal"`, `role="dialog"`, `aria-modal="true"` |
| `open=false` | Modal root is NOT in the DOM (returns `null`) |
| Backdrop click (`data-testid="intake-backdrop"`) | `onClose()` called exactly once |
| ✕ button click (`data-testid="intake-close"`) | `onClose()` called exactly once; does not double-fire via backdrop |
| Escape key (`keydown` on `document`) | `onClose()` called when `open=true`; no-op when `open=false` |
| Board siblings | Never unmounted — modal is an overlay (`position:fixed`), not a replacement |
| Focus | Panel receives focus on open (`tabIndex={-1}` + `useEffect`); ✕ button is Tab-reachable |

### Rendered structure (testid map)

```
[position:fixed overlay]
  data-testid="intake-backdrop"   ← clickable backdrop (position:absolute, aria-hidden)
  role="dialog" aria-modal="true" data-testid="intake-modal"   ← panel (stopPropagation on click)
    data-testid="intake-close"                                  ← ✕ <button>
    <ul>
      data-testid="intake-command-explore"
        data-testid="intake-command-explore-icon"
        data-testid="intake-command-explore-title"
        data-testid="intake-command-explore-description"
        data-testid="copy-button"  (value="/pandacorp:explore")
      data-testid="intake-command-new-idea"
        …
      data-testid="intake-command-discover"
        …
      data-testid="intake-command-recommend"
        …
```

### Static command table

| `data-testid` slug | Command copied | Title (ES) | Description (ES) |
|---|---|---|---|
| `explore` | `/pandacorp:explore` | Explorar una idea | Abre una conversación guiada para clarificar y expandir una idea difusa antes de capturarla. |
| `new-idea` | `/pandacorp:new-idea` | Capturar idea | Cristaliza y guarda una idea en la base de ideas. |
| `discover` | `/pandacorp:discover` | Descubrir oportunidades | Busca en internet dolores monetizables y los sugiere como nuevas ideas. |
| `recommend` | `/pandacorp:recommend` | Recomendar idea | Analiza la base de ideas y recomienda la mejor candidata según el perfil del propietario. |

### Design rules

- All visual values via CSS custom properties (`--color-backdrop`, `--color-surface-panel`, `--color-border`, `--color-text`, `--color-text-muted`, `--color-accent`, `--radius`, `--radius-lg`, `--spacing`, `--shadow-overlay`, `--font-mono`). Zero hardcoded colours.
- Minimum touch target 44×44 px on the ✕ button (FRD-13).
- Spanish user-facing copy; Spanish `aria-label` on ✕ button.
- `backdrop-filter: blur(4px)` on the backdrop element (AC-02-003.1 "dark backdrop + blur").

---

## WO-17-001: `lib/memory.ts` — lesson reader (IF-17-memory)

**Module:** `lib/memory.ts`
**Traces:** IF-17-memory; REQ-17-002, REQ-17-007; AC-17-001.1..5
**Data source:** `factory/memory/LESSON-*.md` (skip `_lesson-template.md`, `README.md`, `_inbox.md`)
**Consumed by:** WO-17-002 (memory views), WO-17-003 (self-suggest), WO-17-004 (proposals page), WO-17-005 (memory health), WO-17-006 (promotions queue)
**Read-only:** never writes to disk (FRD-17 non-goal, architecture §1).

### IF-17-memory — `lib/memory.ts`

```ts
// lib/memory.ts

export type PromotionState = "none" | "proposed" | "approved" | "rejected";
export type LessonStatus = "candidate" | "active" | "deprecated";
export type EvalGate = "corroborated" | "awaiting-2nd";

export type Lesson = {
  id: string;            // e.g. "LESSON-0001"
  type: string;          // "problem-solution" | "library-verdict" | "pattern" | "gotcha" | "anti-pattern"
  domain: string;        // e.g. "factory-engineering", "frontend"
  status: LessonStatus;
  promotion: PromotionState;
  source: string;        // project + capture point / doc ref; always string (coerced if YAML array)
  links: string[];       // e.g. ["DR-047"]; defaults to [] if absent or malformed
  projects: string[];    // distinct project names parsed from `source` (for corroboration check)
  body: string;          // Markdown body (Situation / Lesson / Apply next time)
  evalGate: EvalGate;    // "corroborated" if status==="active" OR projects.length >= 2; else "awaiting-2nd"
};

/**
 * Read all factory/memory/LESSON-*.md files into typed Lesson objects.
 *
 * Skip rules: _lesson-template.md, README.md, _inbox.md, files not starting with LESSON-.
 * Tolerance: malformed frontmatter → file skipped, never throws; adjacent files unaffected.
 * Missing directory → []. Empty file → skipped.
 * Optional-field defaults: links → [], promotion → "none".
 * gray-matter called with { excerpt: false } to prevent content-hash cache pollution.
 * Projects parsing: conservative — splits source on ", "; rejects path-like tokens;
 *   deduplicates; ambiguous → at most 1 project (never fabricates corroboration).
 * Never writes to disk (read-only invariant, FRD-17).
 */
export function readLessons(): Lesson[];

/** All lessons with status === "candidate" (REQ-17-002 candidate stream). */
export function candidateLessons(): Lesson[];

/** All lessons with promotion === "proposed" (REQ-17-006 durable promotions queue). */
export function promotionQueue(): Lesson[];

/** All lessons with status === "deprecated" (REQ-17-002 prune stream). */
export function prunable(): Lesson[];
```

### Derivation rules

| Field | Rule |
|---|---|
| `projects` | Split `source` on `", "` (comma-space). For each segment take the leading alphanumeric slug (up to first space or `(`). Reject tokens containing `/` or ending in `.md`. Deduplicate. Result is `[]` for doc-ref sources or ambiguous inputs. |
| `evalGate` | `"corroborated"` if `status === "active"` OR `projects.length >= 2`; `"awaiting-2nd"` otherwise. |
| `promotion` | Frontmatter value if it is one of `"none" | "proposed" | "approved" | "rejected"`; defaults to `"none"` otherwise (including absent). |
| `links` | Frontmatter string array; `[]` if absent or not an array; non-string items filtered out. |

### Edge-case behavior

| Scenario | Behavior |
|---|---|
| `factory/memory/` does not exist | Returns `[]`, no throw |
| Empty file | Skipped |
| Malformed YAML frontmatter | File skipped, no throw; neighbor files unaffected (no cache pollution) |
| `source` parsed as YAML array | Joined with `", "`, exposed as `string` |
| `promotion` unknown value | Defaults to `"none"` |
| `status` missing or unknown | File skipped (required field) |
| `id`, `type`, or `domain` missing | File skipped (required fields) |
| `links` is not an array | `[]` |
| LESSON id matches prototype key (`"constructor"`, `"toString"`) | Returned as plain object in flat array; no prototype pollution |

---

## WO-04-001: `lib/docs.ts` — feature-centric document tree + raw read (IF-04-docs)

**Module:** `lib/docs.ts` (additions to the existing WO-01-006 module)
**Traces:** IF-04-docs; REQ-04-006; AC-04-006.1 (document tree), AC-04-006.2 (raw markdown read), AC-04-006.3 (graceful empty state)
**Dependencies:** `lib/fs-utils.ts` (`pathExists`, WO-01-001, shipped)
**Consumed by:** WO-04-006 (`CMP-04-tab-documents`, Documents tab UI), FRD-05 (`lib/work-orders.ts`), FRD-08 (`lib/manual.ts`)

### IF-04-docs — `lib/docs.ts` (new exports)

```ts
// lib/docs.ts — new exports added by WO-04-001
// (readProjectDocs from WO-01-006 is unchanged)

/**
 * A single document node in the feature-centric tree.
 *
 * Groups (architecture §4.5):
 *   "Product"              — docs/product/prd.md, docs/product/architecture.md
 *   "Feature: frd-NN-slug" — docs/frds/frd-NN-<slug>/{frd.md, fdd.md?, blueprint.md?}
 *   "Global"               — docs/adr/*.md, docs/decision-log.md
 */
export interface DocNode {
  /** Stable key, unique per project. Equals relPath without file extension. */
  id: string;
  /** Display name (filename), e.g. "prd.md". */
  label: string;
  /** "Product" | "Feature: frd-NN-<slug>" | "Global" */
  group: string;
  /** Path relative to the project root; forward-slash separator (never absolute). */
  relPath: string;
}

/**
 * Discover the feature-centric document tree for a project.
 *
 * Returns a flat DocNode[] covering Product + Feature + Global layers (architecture §4.5).
 * Order: Product (prd, architecture), then Feature entries (each FRD: frd, fdd?, blueprint?),
 * then Global (adr/*.md, decision-log.md).
 *
 * Fail-soft: absent/unreadable layers → []. Empty or non-existent projectPath → [].
 * Read-only: only existence probes + directory listing (no file content reads here).
 * Never throws.
 *
 * @param projectPath - Absolute path to the project root.
 * @returns Genuine JS Array of DocNode; empty when no surfaced docs exist (AC-04-006.3).
 */
export function listProjectDocs(projectPath: string): DocNode[];

/**
 * Return the raw markdown content of a surfaced document.
 *
 * Security contract: relPath is validated against the set returned by listProjectDocs.
 * Any path NOT in that set (traversal attempts, absolute paths, .pandacorp/ comms,
 * work-orders/, non-surfaced files) → null. No arbitrary file reads.
 *
 * @param projectPath - Absolute path to the project root.
 * @param relPath     - Relative path as in DocNode.relPath (forward slashes).
 * @returns Raw markdown string, or null when:
 *   - relPath not in discovered set (security rejection)
 *   - projectPath does not exist (AC-04-006.3)
 *   - File cannot be read (fs error)
 *   - Either argument is empty/blank
 *   Never throws.
 */
export function readDoc(projectPath: string, relPath: string): string | null;
```

### Document tree groups (architecture §4.5)

| Group | Files surfaced | DocNode.relPath pattern |
|---|---|---|
| `"Product"` | `docs/product/prd.md` | `docs/product/prd.md` |
| `"Product"` | `docs/product/architecture.md` | `docs/product/architecture.md` |
| `"Feature: frd-NN-<slug>"` | `docs/frds/<slug>/frd.md` | `docs/frds/<slug>/frd.md` |
| `"Feature: frd-NN-<slug>"` | `docs/frds/<slug>/fdd.md` (optional) | `docs/frds/<slug>/fdd.md` |
| `"Feature: frd-NN-<slug>"` | `docs/frds/<slug>/blueprint.md` (optional) | `docs/frds/<slug>/blueprint.md` |
| `"Global"` | `docs/adr/*.md` (each file) | `docs/adr/<filename>.md` |
| `"Global"` | `docs/decision-log.md` | `docs/decision-log.md` |

**Not surfaced** (outside the allowed set): `.pandacorp/` files, `docs/frds/<slug>/work-orders/`, `docs/frds/<slug>/mocks/`, `docs/analytics/`, `docs/product/research.md`, any other path.

### DocNode.id derivation

`id = relPath.replace(/\.[^/.]+$/, "")` — relPath stripped of its file extension. Examples:
- `docs/product/prd.md` → `"docs/product/prd"`
- `docs/frds/frd-04-project-workspace/blueprint.md` → `"docs/frds/frd-04-project-workspace/blueprint"`
- `docs/adr/ADR-0001-stack.md` → `"docs/adr/ADR-0001-stack"`

Stable across calls for the same file (used as React key in `CMP-04-tab-documents`).

### Security contract — `readDoc`

| Input condition | Result |
|---|---|
| `relPath` in discovered set, file readable | Raw markdown content string |
| `relPath` is a `.pandacorp/` path (not surfaced) | `null` — rejected by set membership check |
| `relPath` uses `../` traversal | `null` — not in discovered set; never reaches fs |
| `relPath` is an absolute path (starts with `/`) | `null` — not in discovered set |
| `relPath` is a work-orders `.md` path | `null` — work-orders are FRD-05 scope, not surfaced |
| `relPath` is a directory (e.g. `docs/frds/frd-01-x`) | `null` — directories not in discovered set |
| `relPath` is empty string `""` | `null` — input guard |
| `projectPath` does not exist | `null` — `listProjectDocs` returns `[]`; set is empty |
| Both arguments empty | `null` — does not throw |

### Defensive contract — `listProjectDocs`

| Input condition | Result |
|---|---|
| Valid project with prd.md + 1 FRD + ADR + decision-log | DocNode[] with correct groups |
| Project root does not exist | `[]` (no throw; AC-04-006.3) |
| Project root is empty | `[]` |
| `docs/product/` absent | No Product nodes (no throw) |
| `docs/frds/` absent | No Feature nodes (no throw) |
| `docs/frds/` is a regular file (not dir) | No Feature nodes (no throw; no ENOTDIR crash) |
| FRD dir has only `frd.md` (no blueprint, no fdd) | Only `frd.md` node surfaced (regression I2: no vacuous blueprint node) |
| FRD dir name does NOT match `/^frd-\d/` | Excluded (not treated as a feature group) |
| `docs/adr/` exists but contains no `.md` files | No Global/adr nodes (regression B1': no NaN count) |
| Empty string passed as projectPath | `[]` (no throw) |
| Called twice on same project | Same DocNode[] with identical ids (stable id invariant) |
| Result JSON.stringified and parsed | Equal to original (serializability; no class instances) |

### Architecture invariants

- **Read-only:** `listProjectDocs` uses `pathExists`, `fs.statSync`, `fs.readdirSync` only. `readDoc` additionally calls `fs.readFileSync` — on validated paths only. No writes.
- **No arbitrary traversal (security):** `readDoc` calls `listProjectDocs` to obtain the allowed set, then does a `Set.has()` check before any `fs.readFileSync`. A relPath not in the set never reaches the filesystem.
- **Never throws:** both functions catch all errors and degrade to `[]`/`null`.
- **Genuine JS Array:** `listProjectDocs` returns an Array (not array-like) — `Array.isArray()` is true (regression I3).
- **Forward-slash relPaths only:** all `relPath` values use `/` separators regardless of OS. No backslashes.
- **Deterministic / idempotent:** given the same filesystem state, always returns the same nodes in the same order, with the same ids.
- **Serializability:** `DocNode[]` is a plain serializable value (no class instances, no functions, no Date). Safe for Next.js Server→Client prop passing.

### Regression anchors

| Anchor | Risk | Guard |
|---|---|---|
| **B1' (2026-06-16)** | NaN from arithmetic on directory scan results | `listProjectDocs` uses array `push` — result length is always a genuine integer, never NaN. |
| **I2 (2026-06-16)** | Vacuous-truthy nodes for absent optional files | Only files that pass `pathExists(filePath) && statIsFile(filePath)` are surfaced. An FRD dir with only `frd.md` does not produce a `blueprint.md` node. |
| **I3 (2026-06-16)** | Array-shaped objects fool `Array.isArray` | Result built with `push` into a `DocNode[] = []` literal — always a genuine Array. |
| **WO-01-001 (2026-06-16)** | `existsSync` throws on malformed paths (null bytes) | `pathExists` wraps `existsSync` in try/catch; `listProjectDocs` uses `pathExists` exclusively. |

### Consumption (downstream WOs)

- **WO-04-006** (`CMP-04-tab-documents`): calls `listProjectDocs(projectPath)` server-side to render the nav tree. Calls `readDoc(projectPath, selectedRelPath)` for the active document body, passed to `react-markdown`.
- **FRD-05** (`lib/work-orders.ts`): may use `listProjectDocs` to enumerate FRD slugs (the FRD discovery pattern is the same; WO-05-001 may extend or re-use this).
- **FRD-08** (`lib/manual.ts`): may use `listProjectDocs` for the Manual's document index.

### Test coverage

`lib/docs.wo04001.test.ts` — 63 tests across 14 groups (vitest, Node environment, no mocks — real fixture tree + temp dirs):

| Group | ACs covered |
|---|---|
| AC-04-006.1 — Product group (proj-a) | prd.md node, architecture.md node, relPath prefix, id non-empty, absent file → no node |
| AC-04-006.1 — Feature group (proj-a has frd-01-x) | frd.md node, blueprint.md node, relPath prefix, no fdd.md when absent, fdd.md when present, non-frd dirs excluded, multiple FRDs each with own group |
| AC-04-006.1 — Global group (proj-a) | adr/*.md nodes, decision-log.md node, relPath values, absent dirs → no nodes |
| AC-04-006.1 — DocNode shape invariants | Non-empty id/label/group/relPath; unique ids; forward-slash relPaths; no absolute relPaths; no `../` starts; group in allowed set; genuine JS Array (I3) |
| AC-04-006.1 — Stable IDs (idempotency) | Calling twice → same id per relPath |
| AC-04-006.3 — Graceful empty state | Non-existent root → `[]` no throw; empty root → `[]`; empty docs/ → `[]`; empty string → `[]` no throw |
| Regression B1' | Empty frds/ → length 0 finite; empty adr/ → length finite |
| Regression I2 | FRD dir with only frd.md → no blueprint.md node; no fdd.md node; empty adr/ → no vacuous nodes |
| AC-04-006.2 — readDoc happy path | prd.md content matches file; frd.md/blueprint.md/ADR/decision-log content returned non-null; first node readable (default selection) |
| Security / no-traversal | .pandacorp/ path → null; `../` path → null; absolute path → null; empty relPath → null; invented path → null no throw; directory relPath → null; status.yaml → null; work-orders .md → null; empty projectPath → null no throw |
| REQ-01-010 — non-existent projectPath | Does not throw; returns null |
| Read-only invariant (readDoc) | mtime unchanged after read; no file/dir created on ghost path |
| Read-only invariant (listProjectDocs) | Directory tree snapshot identical before/after two calls |
| Round-trip | All surfaced nodes readable via readDoc; 5-node temp project all readable |
| Serializability | JSON.stringify + parse → equal to original |

---

## WO-04-002: `lib/docs.ts` — activity log + decisions readers (IF-04-docs comms)

**Module:** `lib/docs.ts` (additions to the existing WO-01-006 / WO-04-001 module)
**Traces:** IF-04-docs; REQ-04-003, REQ-04-004; AC-04-003.2 (activity log), AC-04-003.3 (decision points)
**Dependencies:** `lib/fs-utils.ts` (`pathExists`, WO-01-001, shipped)
**Consumed by:** WO-04-005 (`CMP-04-tab-summary`, Summary tab UI)

### IF-04-docs — `lib/docs.ts` (WO-04-002 new exports)

```ts
// lib/docs.ts — new exports added by WO-04-002
// (readProjectDocs, listProjectDocs, readDoc from WO-01-006/WO-04-001 are unchanged)

/**
 * The parsed activity log from `.pandacorp/comms/progress.md`.
 *
 * `entries` is a genuine JS Array of non-empty strings, each representing a
 * bullet line from the file (the leading "- " prefix is stripped).
 * Absent or empty file → `{ entries: [] }`. Never throws.
 */
export interface ActivityLog {
  /** Each bullet-line item from progress.md, trimmed, leading "- " stripped. */
  entries: string[];
}

/**
 * A single decision block parsed from `.pandacorp/inbox/decisions.md`.
 *
 * `title`          — the text after "OPEN:" or "CLOSED:" in the H2 heading (trimmed).
 * `recommendation` — text after a `- **Recommendation:**` line in the block, or
 *                    `undefined` when no such line is present.
 * `resolved`       — `true` for CLOSED/RESOLVED blocks; `false` for OPEN blocks.
 */
export interface DecisionPoint {
  title: string;
  recommendation?: string;
  resolved: boolean;
}

/**
 * Parse `.pandacorp/comms/progress.md` into an ActivityLog.
 *
 * Collects all lines that start with "- " (markdown bullet), strips the prefix,
 * and returns them as `entries`. Non-bullet lines (headings, blank lines) are ignored.
 *
 * Fail-soft tolerance (architecture §3):
 *   - Absent file → `{ entries: [] }` (no throw; AC-04-003.2 empty state).
 *   - Non-existent projectPath → `{ entries: [] }` (no throw).
 *   - Empty or whitespace-only file → `{ entries: [] }`.
 *   - entries.length is always a genuine finite integer (regression B1').
 *   - entries is always a genuine JS Array (regression I3).
 *   - Never writes to disk.
 *
 * @param projectPath - Absolute path to the project root.
 * @returns ActivityLog with entries as a genuine JS Array. Never throws.
 */
export function readActivityLog(projectPath: string): ActivityLog;

/**
 * Parse `.pandacorp/inbox/decisions.md` into an array of DecisionPoint objects.
 *
 * Recognises `## OPEN: <title>` and `## CLOSED: <title>` (or `## RESOLVED: <title>`)
 * H2 headings as decision block delimiters. Within each block, an optional
 * `- **Recommendation:** <text>` line populates `recommendation`.
 *
 * Fail-soft tolerance (architecture §3):
 *   - Absent file → `[]` (no throw; AC-04-003.3 empty state).
 *   - Non-existent projectPath → `[]` (no throw).
 *   - Empty or whitespace-only file → `[]`.
 *   - result.length is always a genuine finite integer (regression B1').
 *   - Result is always a genuine JS Array (regression I3).
 *   - Never writes to disk.
 *
 * @param projectPath - Absolute path to the project root.
 * @returns DecisionPoint[] — genuine JS Array. Never throws.
 */
export function readDecisions(projectPath: string): DecisionPoint[];
```

### Parsing rules

**`readActivityLog`**

| Line pattern | Behavior |
|---|---|
| Starts with `"- "` (after trimStart) | Stripped text (minus leading `"- "`) added to `entries` if non-blank |
| Heading (`#`, `##`, …) | Ignored — headings are not entries |
| Blank / whitespace-only line | Ignored — regression I2: no phantom entries |
| Any other line | Ignored |

**`readDecisions`**

| Line pattern | Behavior |
|---|---|
| `## OPEN: <text>` | Opens a new block: `resolved=false`, `title=<text>` |
| `## CLOSED: <text>` or `## RESOLVED: <text>` | Opens a new block: `resolved=true`, `title=<text>` |
| `- **Recommendation:** <text>` (inside a block) | Sets `recommendation` for the current block |
| Any other line | Ignored |
| End of file | Flushes the last block |

### Resolved semantics

`resolved = true` when the heading keyword is `CLOSED` or `RESOLVED` (case-insensitive).
`resolved = false` when the keyword is `OPEN` (case-insensitive).
The pending count is derived by callers as `result.filter(dp => !dp.resolved).length` (REQ-04-004). The `pending_decisions` field in `.pandacorp/status.yaml` is cross-checked against this count by FRD-01 (out of scope here).

### Defensive contract

| Input condition | readActivityLog result | readDecisions result |
|---|---|---|
| Valid project with populated files | `{ entries: [... ] }` non-empty | `DecisionPoint[]` non-empty |
| File absent | `{ entries: [] }` | `[]` |
| File empty | `{ entries: [] }` | `[]` |
| File has only headings / whitespace | `{ entries: [] }` (regression I2) | `[]` |
| Non-existent projectPath | `{ entries: [] }` | `[]` |
| Empty string projectPath | `{ entries: [] }` | `[]` |
| All OPEN blocks | all `resolved=false` | pending count = total |
| All CLOSED blocks | n/a | pending count = 0 |
| Mixed OPEN + CLOSED | n/a | pending = filter(!resolved).length |
| Neither throws | Never throws | Never throws |

### Architecture invariants

- **Read-only:** uses `pathExists`, `fs.readFileSync` only — no writes, no Claude calls (REQ-01-011).
- **Fail-soft:** every error path returns the empty value, never throws.
- **Genuine JS Array:** both return values satisfy `Array.isArray()` (regression I3).
- **Finite counts:** `.entries.length` and `.length` are always finite integers, never NaN (regression B1').
- **Serializability:** `ActivityLog` and `DecisionPoint[]` are plain serializable values — safe for Next.js Server→Client prop passing.
- **Idempotent:** calling either function twice on the same filesystem state returns equal values.
- **No cross-contamination:** `readActivityLog` never touches `decisions.md`; `readDecisions` never touches `progress.md`.

### Regression anchors

| Anchor | Risk | Guard |
|---|---|---|
| **B1' (2026-06-16)** | NaN from length arithmetic | Array built with `push`; length always a genuine integer |
| **I2 (2026-06-16)** | Blank entries / phantom decision blocks | Blank bullet text skipped; blocks only created on heading match |
| **I3 (2026-06-16)** | Array-like objects fool `Array.isArray` | Both return values initialised as `[]` literals and grown with `push` |
| **WO-01-001 (2026-06-16)** | ENOENT crash on absent path | `pathExists` wraps `existsSync` in try/catch; checked before any `readFileSync` |

### Consumption (downstream WOs)

- **WO-04-005** (`CMP-04-tab-summary`): calls `readActivityLog(projectPath)` to render the activity-log section; calls `readDecisions(projectPath)` to render decision blocks with highlight + count badge (AC-04-003.2, AC-04-003.3).

### Test coverage

`lib/docs.wo04002.test.ts` — 74 tests across 13 groups (vitest, Node environment, no mocks):

| Group | ACs covered |
|---|---|
| readActivityLog happy path (progress.md exists) | No throw; `entries` key; Array.isArray; non-empty; non-empty strings; WO-01-000/001 fixture lines; finite length; no null/undefined entries |
| readActivityLog absent file → graceful empty state | No throw on missing dir; `{ entries: [] }` on missing file; entries=[] when dir exists but no file; no throw on non-existent path; no throw on empty string |
| readActivityLog content parsing edge cases | Empty file → `[]`; headings-only → no blank entries; single bullet; 3 bullets; Spanish verbatim; whitespace-only regression I2 |
| readActivityLog read-only invariant | mtime of progress.md unchanged; no dir/file created on ghost path |
| readActivityLog idempotency | Two calls return same entries; two calls on ghost path return empty |
| readDecisions happy path (decisions.md exists) | No throw; Array.isArray; non-empty; 2 OPEN blocks→length 2; non-empty titles; specific fixture titles (Playwright, event cap); resolved=false for OPEN; pending count=2; boolean resolved; finite length; title is string not array |
| readDecisions resolved vs. pending semantics | CLOSED→resolved=true; OPEN→resolved=false; 1 OPEN+1 CLOSED split; all CLOSED→pending=0 |
| readDecisions optional recommendation | No recommendation→undefined not empty string; recommendation present→non-empty string; recommendation not array (I3) |
| readDecisions absent file → graceful empty state | No throw; `[]` on missing file; `[]` when dir exists but no file; no throw on non-existent path; `[]` on non-existent; no throw on empty string; `[]` on empty string |
| readDecisions content edge cases | Empty file→`[]`; only heading no blocks→`[]`; 3 OPEN blocks→3 entries resolved=false; Spanish titles verbatim; whitespace-only→`[]` no throw (I2) |
| readDecisions DecisionPoint shape invariants | title+resolved present; recommendation undefined or string never null; JSON round-trip; genuine Array (I3) |
| readDecisions read-only invariant | mtime unchanged; no dir/file created on ghost path |
| readDecisions idempotency | Same count on two calls; same titles sorted; ghost path→`[]` twice |
| readActivityLog × readDecisions orthogonality | Both run together no throw + non-trivial; both empty on no .pandacorp; readActivityLog doesn't touch decisions.md mtime; readDecisions doesn't touch progress.md mtime |
| Regression B1' | Finite lengths for both readers; 0 not NaN when absent |

---

## WO-04-003: `workspaceCommands` — phase → Commands-tab row map (IF-04-next-step)

**Module:** `lib/next-step.ts` (extends the WO-02-003 base)
**Traces:** IF-04-next-step; REQ-04-005; AC-04-005.1
**Dependencies:** WO-02-003 (`PHASE_COMMANDS` — FRD-02 base map, `lib/next-step.ts`), WO-01-005 (`Phase` from `lib/status.ts`)
**Consumed by:** WO-04-007 (`CMP-04-tab-commands`, Commands tab UI)
**Read-only:** pure function; no fs, no writes, no network, no side effects.

### IF-04-next-step — `lib/next-step.ts` (new exports)

```ts
// lib/next-step.ts — new exports added by WO-04-003
// (nextStep, NextStep, NextStepInput from WO-02-003 are unchanged)

/**
 * A single row in the Commands tab: the command string and a Spanish description
 * of when to use it.
 *
 * Returned by workspaceCommands and consumed by CMP-04-tab-commands (WO-04-007).
 * Both fields are non-empty strings; `when` is always distinct from `command`.
 */
export interface CommandRow {
  /** The /pandacorp:* command string the owner should copy and run. */
  command: string;
  /** Spanish description of when to use this command (UI-facing). */
  when: string;
}

/**
 * Map a project phase to the stage-relevant command rows shown in the Commands
 * tab (REQ-04-005, AC-04-005.1).
 *
 * Pure: no I/O, no writes, no network, no side effects. Never throws.
 * Deterministic: same phase → same output, always.
 *
 * @param phase - The project phase from `.pandacorp/status.yaml`.
 *   Runtime callers may pass `undefined` (regression B1', I3) — handled safely.
 * @returns A non-empty `CommandRow[]` with at least one row. Never empty.
 *   Never returns `null` or `undefined`.
 */
export function workspaceCommands(phase: Phase): CommandRow[];
```

### Phase → CommandRow[] mapping table (canonical)

| `phase` | Result rows (in order) | Row count |
|---|---|---|
| `"implementation"` | `/pandacorp:implement`, `/pandacorp:release`, `/pandacorp:iterate` | 3 |
| `"release"` | `/pandacorp:implement`, `/pandacorp:release`, `/pandacorp:iterate` | 3 |
| `"operation"` | `/pandacorp:iterate`, `/pandacorp:new-version` | 2 |
| `"product"` | delegates to FRD-02: `/pandacorp:design` | 1 |
| `"design"` | delegates to FRD-02: `/pandacorp:blueprint` | 1 |
| `"architecture"` | delegates to FRD-02: `/pandacorp:implement` | 1 |
| `undefined` / unknown | safe fallback: `/pandacorp:spec <idea>` | 1 |

Notes on the mapping:
- `implementation` and `release` share the same 3-row set (both are mid-build phases where the owner can resume, launch, or iterate).
- `iterate` is always the **last** row in building phases and the **first** row in operation (shipped project's primary action).
- The early-phase delegation (product/design/architecture) reuses `PHASE_COMMANDS` from the FRD-02 base — no duplication of the mapping.
- The unknown/undefined fallback returns `/pandacorp:spec <idea>` — a safe pre-pipeline command that is never a building-phase command (never misleading for an unrecognised phase).

### Building-phase rows detail

| Row index | `command` | `when` (Spanish) |
|---|---|---|
| 0 | `/pandacorp:implement` | `"Continúa o reanuda la construcción del proyecto"` |
| 1 | `/pandacorp:release` | `"Cuando todos los work orders estén listos para lanzar"` |
| 2 | `/pandacorp:iterate` | `"Agrega un FRD, ajusta o corrige algo en el proyecto"` |

### Operation-phase rows detail

| Row index | `command` | `when` (Spanish) |
|---|---|---|
| 0 | `/pandacorp:iterate` | `"Itera sobre el proyecto: agrega, ajusta o corrige"` |
| 1 | `/pandacorp:new-version` | `"Comienza un nuevo hito o versión mayor del proyecto"` |

### Defensive contract

| Input condition | Result |
|---|---|
| `phase === "implementation"` | 3-row array: implement → release → iterate |
| `phase === "release"` | 3-row array identical to `"implementation"` |
| `phase === "operation"` | 2-row array: iterate → new-version |
| `phase === "product"` | 1-row array: `/pandacorp:design` (FRD-02 delegation) |
| `phase === "design"` | 1-row array: `/pandacorp:blueprint` (FRD-02 delegation) |
| `phase === "architecture"` | 1-row array: `/pandacorp:implement` (FRD-02 delegation) |
| `phase === undefined` (B1' regression) | 1-row array: fallback `/pandacorp:spec <idea>` — does not throw |
| `phase` is an unrecognised string (I3 regression) | 1-row array: fallback `/pandacorp:spec <idea>` — no building command |
| Any valid phase called twice | Identical output (deterministic) |
| Called in any order across all phases | No shared state mutated (idempotent) |

### Architecture invariants

- **Pure:** no `import fs`, no writes, no network, no global state mutation. No side effects of any kind.
- **Never throws:** all branches — including undefined/unknown phase — produce a valid `CommandRow[]`.
- **Never empty:** every code path returns at least one row (`length >= 1`). An empty array is a contract violation (regression B2/WO-12-004 detection).
- **Deterministic:** given the same phase, always returns rows with the same `command` and `when` strings.
- **FRD-02 delegation — no duplication:** early phases delegate to the existing `PHASE_COMMANDS` record from the FRD-02 base — the phase→command mapping lives in one place.
- **`when` !== `command`:** the description field is always distinct from the command string (not a copy of it).
- **Genuinely typed:** no `any`, no `@ts-ignore`. Strict TypeScript. `CommandRow[]` is a genuine `Array` (`Array.isArray()` is true — regression I3).
- **No cross-contamination:** operation phase never includes implement/release; early phases never include building-phase commands.

### Regression anchors

| Anchor | Risk | Guard |
|---|---|---|
| **B1' (2026-06-16)** | NaN phase rejected upstream by `readStatus`; arrives as `undefined` | `undefined` falls through all phase equality checks; hits the catch-all fallback branch; returns 1-row fallback array — never throws |
| **I3 (2026-06-16)** | Array-shaped phase rejected upstream; arrives as `undefined` | Same fallback path |
| **B2 / WO-12-004 (2026-06-16)** | A function returning `[]` is undetectable by `toBeTruthy` | Every code path pushes at least 1 row; the fallback branch is the innermost safety net |

### Consumption (downstream WOs)

- **WO-04-007** (`CMP-04-tab-commands`): calls `workspaceCommands(phase)` server-side to render the command row list. Each row's `command` passes to `<CopyButton>` (WO-02-002); each `when` renders as the row description. The Commands tab also slots `CMP-11-mode-selector` (FRD-11) for the build-mode picker — that is a separate concern owned by FRD-11.

### Test coverage

`lib/next-step.wo04003.test.ts` — 69 tests across 7 groups (vitest, pure — no fs, no mocks):

| Group | ACs / invariants covered |
|---|---|
| implementation phase (AC-04-005.1) | Does not throw; 3 rows; row[0]=implement; row[1]=release; row[2]=iterate; all rows non-empty; genuine Array (I3); `when` fields non-empty and describe correct scenario |
| release phase (AC-04-005.1) | Does not throw; 3 rows; same row commands as implementation; parity assertion (mutation hardening) |
| operation phase (AC-04-005.1) | Does not throw; 2 rows; row[0]=iterate; row[1]=new-version; all rows non-empty; no pre-build or building commands appear |
| early-phase delegation to FRD-02 | Does not throw (product/design/architecture); 1 row each; non-empty row; no building-phase commands for product/design; specific delegation: product→design, design→blueprint, architecture→implement |
| Pure function invariants | Deterministic (same phase → same commands); all valid phases non-null/non-undefined/genuine Array; at least 1 row for every phase (regression B2); idempotent across repeated calls; `when !== command` for all building/operation phases |
| Complete mapping table (mutation hardening) | One assertion per (phase, row-index, field) cell; count guards; order guards |
| Regression B1' + I3 (undefined / unknown phase) | Does not throw; Array result; at least 1 row; each row valid; deterministic; unrecognised string → no building commands returned |

---

## WO-16-001: `lib/orphans.ts` — projects path resolution + bounded folder listing

**Module:** `lib/orphans.ts`
**Traces:** IF-16-scan; REQ-16-005 (read-only invariant), REQ-16-006 (bounded scan); AC-16-001.1..6
**Dependencies:** `lib/profile.ts` (WO-01-002, shipped — `readProfile`, `Profile.projectsPath`)
**Consumed by:** WO-16-002 (`classifyCandidate`, `getOrphans`), WO-16-003 (route handler `app/api/orphans/`)

### IF-16-scan — `lib/orphans.ts`

```ts
// lib/orphans.ts

/**
 * Resolve the owner's projects folder from the factory root.
 *
 * Algorithm (FRD-16 / architecture §4.2):
 *   1. Read factory/profile.md from factoryRoot.
 *   2. If profile.projectsPath is a non-empty, non-whitespace string → return it verbatim.
 *   3. Otherwise → return path.dirname(factoryRoot) (the parent directory).
 *
 * Never throws (fail-soft). All fs/parse errors fall back to step 3.
 *
 * @param factoryRoot - Absolute path to the factory repo root (the folder that
 *   contains mission-control/). The profile is read from
 *   <factoryRoot>/factory/profile.md.
 * @returns Absolute path string. Never empty. Never throws.
 */
export function resolveProjectsPath(factoryRoot: string): string;

/**
 * List immediate git-repo children of projectsPath, with exclusions applied.
 *
 * A child is included when ALL of the following hold:
 *   1. It is a directory (not a regular file).
 *   2. It contains a .git entry (directory or file — git worktrees use a .git file).
 *   3. Its absolute path is NOT the factory root (factoryRoot).
 *   4. Its name is NOT "mission-control" (the built-in dashboard, blueprint §5).
 *
 * The scan is bounded to depth 1 of projectsPath (REQ-16-006).
 * No recursive walk; no git subprocess; no writes (REQ-16-005).
 *
 * @param projectsPath - Absolute path to the projects folder to scan.
 *   Empty or whitespace-only → returns [] without throwing.
 * @param factoryRoot  - Optional absolute path to the factory repo root. When provided,
 *   any child whose absolute path equals factoryRoot is excluded (AC-16-001.5).
 *   When omitted, only the "mission-control" name exclusion applies.
 * @returns Array of absolute paths to immediate git-repo children. Never throws.
 */
export function listProjectFolders(projectsPath: string, factoryRoot?: string): string[];
```

### Defensive contract — `resolveProjectsPath`

| Input condition | Result |
|---|---|
| `profile.md` has a valid string `projects_path` | Returns the path verbatim (AC-16-001.1) |
| `profile.md` absent (fresh factory) | Returns `path.dirname(factoryRoot)` (AC-16-001.2) |
| `profile.md` has no `projects_path` field | Returns `path.dirname(factoryRoot)` |
| `projects_path` is empty string `""` | Returns `path.dirname(factoryRoot)` |
| `projects_path` is whitespace-only `"   "` | Returns `path.dirname(factoryRoot)` (regression WO-13-001) |
| `projects_path` is a number in YAML (`42`) | Returns `path.dirname(factoryRoot)` (regression B1': numeric value does not pass string guard — `readProfile` already types `projectsPath` as `string | undefined`) |
| `profile.md` has malformed YAML frontmatter | Returns `path.dirname(factoryRoot)` (fail-soft, no throw) |
| `factoryRoot` does not exist | Returns `path.dirname(factoryRoot)` (no throw) |
| `projects_path` has a trailing slash | Returns it verbatim — owner controls their path (AC-16-001.1) |

### Defensive contract — `listProjectFolders`

| Input condition | Result |
|---|---|
| `projectsPath` does not exist | `[]` (no throw; AC-16-001.6) |
| `projectsPath` is empty string | `[]` (no throw) |
| `projectsPath` is whitespace-only | `[]` (no throw; regression WO-13-001) |
| `projectsPath` points to a regular file | `[]` (no throw; regression I3) |
| `projectsPath` has no children | `[]` (regression I2: empty collection) |
| All children lack `.git` | `[]` |
| Child has a `.git` directory (normal clone) | Included (AC-16-001.4) |
| Child has a `.git` file (git worktree) | Included (AC-16-001.4) |
| Child is a regular file (not a directory) | Excluded (regression I3: file-vs-dir guard) |
| Child is a plain directory with no `.git` | Excluded |
| Child is the factory root | Excluded (AC-16-001.5) |
| Child is named `"mission-control"` | Excluded regardless of `.git` (AC-16-001.5, blueprint §5) |
| Folder two levels deep has `.git` (nested) | NOT returned — bounded scan only (AC-16-001.3, REQ-16-006) |
| `projectsPath` is modified after the call | Directory listing unchanged (REQ-16-005, no writes) |
| `.git` directory is modified after the call | `.git` dir contents unchanged (existence check only, no git subprocess) |
| Result paths | Always absolute, deduplicated, pointing to existing directories |

### Architecture invariants

- **Read-only:** zero writes. `fs.readdirSync`, `fs.statSync`, and `fs.accessSync` are the only fs calls. No `git` subprocess, no `execFileSync`, no `fs.writeFileSync`.
- **Bounded scan (REQ-16-006):** exactly one `fs.readdirSync` on `projectsPath`; no recursion; depth fixed at 1.
- **Existence check only (blueprint §5 note):** `.git` presence detected via `fs.accessSync` — no `git` command is spawned, keeping the scan fast and side-effect-free.
- **Exclusions are constant (blueprint §5):** the factory root (runtime path) and `"mission-control"` (constant string) are the only exclusions. They are enforced per-child, not as a post-filter, so no allocation waste on large projects folders.
- **Never throws:** all three observable error paths (unreadable `projectsPath`, unreadable child, missing `.git`) are caught and degraded to skip/empty.
- **Deterministic:** given the same filesystem state, always returns the same output (`readdirSync` order may vary by OS; the downstream `getOrphans` sorts if needed).

### Regression anchors

| Anchor | Risk | Guard |
|---|---|---|
| **B1' (2026-06-16)** | `typeof NaN === "number"` passes type guards; numeric `projects_path` in YAML silently becomes a number. | `readProfile` already guards this: `projectsPath` is only set when `typeof data.projects_path === "string"`. `resolveProjectsPath` adds a redundant `typeof === "string"` check for belt-and-suspenders. |
| **I2 (2026-06-16)** | Empty folder / empty-collection vacuous truth. | `readdirSync` on an empty dir returns `[]`; the `for…of` loop yields nothing; result is `[]` without any guard needed. |
| **I3 (2026-06-16)** | A top-level entry that is a *file* (not a dir) must be excluded even if somehow named `.git`. | Explicit `childStat.isDirectory()` guard before the `.git` check. |
| **WO-13-001 (2026-06-16)** | Whitespace-only string passes `!== ""` guards. | `.trim() !== ""` in both functions. |

### Consumption (downstream WOs)

- **WO-16-002** (`classifyCandidate`, `getOrphans`, `lib/orphans.ts` additions): calls `resolveProjectsPath(resolveFactoryRoot())` to get the projects folder, then `listProjectFolders(projectsPath, resolveFactoryRoot())` to get the bounded candidate set. `classifyCandidate` cross-references `lib/portfolio.ts` (registered paths) and `.pandacorp/status.yaml` presence.
- **WO-16-003** (`app/api/orphans/route.ts`): calls `getOrphans()` and returns the result as JSON. Node runtime, `force-dynamic`.
- **WO-16-004** (`components/orphans-banner.tsx`): polls the route handler; renders dismissible banners per candidate.

### Test coverage

`lib/orphans.test.ts` — 33 tests across 6 groups (vitest, Node environment — real temp dirs; no mocks; no git subprocess):

| Group | ACs covered |
|---|---|
| AC-16-001.1 — `resolveProjectsPath` returns `projects_path` when set | Valid path verbatim, no normalization, trailing slash preserved |
| AC-16-001.2 — fallback to `path.dirname(factoryRoot)` | Absent profile, missing field, empty string, whitespace-only (WO-13-001), malformed YAML, numeric value (B1'), non-existent factoryRoot |
| AC-16-001.3 (REQ-16-006) — bounded scan (immediate children only) | Nested `.git` not returned, empty dir → `[]` (I2), all-plain → `[]`, 5 repos returned |
| AC-16-001.4 — `.git` as directory or file | Normal clone, worktree, plain folder, top-level regular file (I3), mixed children |
| AC-16-001.5 — factory root and `mission-control/` excluded | Factory root excluded, `mission-control/` excluded, only `mission-control/` → `[]`, factory in a different dir → all repos returned |
| AC-16-001.6 (REQ-16-005) — unreadable path → `[]` (no throw); read-only | Non-existent path, empty string, whitespace-only, file not directory; dir unchanged before/after, `.git` unchanged, no mkdir side-effect, no duplicates in result |

---

## WO-15-001: `lib/plugin-sync.ts` — installed SHA, plugin HEAD SHA, dirty readers

**Module:** `lib/plugin-sync.ts`
**Traces:** IF-15-sync; REQ-15-001 (uncommitted changes), REQ-15-002 (installed SHA behind), REQ-15-005 (read-only invariant); AC-15-001.1..5
**Dependencies:** `lib/config.ts` (FRD-01, shipped — `PANDACORP_FACTORY_ROOT`, `resolveFactoryRoot`)
**Consumed by:** WO-15-002 (`getPluginSyncState` verdict), WO-15-003 (route handler)

### IF-15-sync — `lib/plugin-sync.ts`

```ts
// lib/plugin-sync.ts

/**
 * Parse <claudeHome>/plugins/installed_plugins.json and return the gitCommitSha
 * of the pandacorp@panda-corp entry.
 *
 * Critical invariant (architecture §4.7): reads ONLY gitCommitSha, NEVER the
 * semver `version` field. The version can match while the SHA is behind.
 *
 * @param claudeHome - Absolute path to the user's ~/.claude directory.
 * @returns The gitCommitSha string, or null on any failure (AC-15-001.2).
 *          Never throws.
 */
export function readInstalledSha(claudeHome: string): string | null;

/**
 * Return the 40-char hex SHA of the most recent git commit touching plugin/
 * in the factory repo, via `git log -1 --format=%H -- plugin/`.
 *
 * Uses execFileSync arg-array form (no shell) — read-only git verb (REQ-15-005).
 *
 * @param factoryRoot - Absolute path to the factory git repo root.
 * @returns 40-char hex SHA, or null when: not a git repo, git unavailable,
 *          plugin/ was never touched, or any other error. Never throws (AC-15-001.4).
 */
export function readPluginHeadSha(factoryRoot: string): string | null;

/**
 * Return true when `git status --porcelain -- plugin/` has any output (staged,
 * unstaged, or untracked files under plugin/).
 *
 * Uses execFileSync arg-array form (no shell) — read-only git verb (REQ-15-005).
 *
 * @param factoryRoot - Absolute path to the factory git repo root.
 * @returns true if plugin/ has uncommitted changes; false when clean, when not
 *          a git repo, or on any error. Never throws (AC-15-001.5).
 */
export function readPluginDirty(factoryRoot: string): boolean;
```

### Installed-plugins JSON shape (inspected 2026-06-16, Claude install version 2)

```json
{
  "version": 2,
  "plugins": {
    "pandacorp@panda-corp": [
      {
        "scope": "user",
        "installPath": "...",
        "version": "7.1.0",
        "installedAt": "...",
        "lastUpdated": "...",
        "gitCommitSha": "a95037f84c041bf3e24a0f8a9c907fab97de1554"
      }
    ]
  }
}
```

`readInstalledSha` locates `plugins["pandacorp@panda-corp"][0].gitCommitSha`, trims surrounding whitespace, and returns it only when the trimmed value is a non-empty string. The `version` field (`"7.1.0"`) is never read or returned. Trimming is required so equality comparisons in WO-15-002 never produce false-drift alarms when the JSON value has accidental whitespace (SHA hygiene invariant).

### Defensive contract — `readInstalledSha`

| Input condition | Result |
|---|---|
| Valid file, `pandacorp@panda-corp` entry with `gitCommitSha` | Returns the SHA string |
| File absent | `null` |
| Malformed JSON | `null` |
| No `pandacorp@panda-corp` key | `null` |
| Entry array is empty | `null` (regression I2: empty-collection vacuous truth) |
| `gitCommitSha` field absent | `null` |
| `gitCommitSha` is empty string | `null` |
| `gitCommitSha` is a number (e.g. `0`) | `null` (regression B1': numeric type does not pass string guard) |
| Entry is not an array but a plain object | `null` or SHA (no throw; regression I3: array-shaped guard) |
| `gitCommitSha` has surrounding whitespace | Trimmed SHA returned (SHA hygiene: prevents false-drift in WO-15-002 equality check) |
| `gitCommitSha` is only whitespace | `null` (whitespace-only is not a valid SHA) |
| `claudeHome` does not exist on disk | `null` |

### Defensive contract — `readPluginHeadSha`

| Input condition | Result |
|---|---|
| Valid git repo, plugin/ has commits | 40-char hex SHA string |
| Valid git repo, plugin/ never touched | `null` (git log returns empty output) |
| Not a git repo | `null` |
| `factoryRoot` does not exist | `null` |
| git not available | `null` |

### Defensive contract — `readPluginDirty`

| Input condition | Result |
|---|---|
| plugin/ has modified tracked files | `true` |
| plugin/ has staged changes | `true` |
| plugin/ has untracked new files | `true` |
| plugin/ is fully clean | `false` |
| Changes only outside plugin/ | `false` (scoped to `-- plugin/`) |
| Not a git repo | `false` (not throw — unknown does NOT raise alarm, REQ-15-005) |
| `factoryRoot` does not exist | `false` |

### Architecture invariants

- **Read-only:** zero writes. `execFileSync` is called with read-only git verbs only (`git log -1`, `git status --porcelain`). No `git checkout`, `git add`, `git commit`, or any write verb.
- **No shell injection:** both `execFileSync` calls use the arg-array form — the binary and arguments are passed as a `string[]`, never concatenated into a shell string.
- **Never throws:** all three functions catch every error and degrade to `null`/`false`.
- **No semver comparison:** the invariant "compare `gitCommitSha`, never `version`" is enforced by the code — `version` is not read from the entry object.
- **No `simple-git` dependency:** two `execFileSync` calls are sufficient; adding a dependency for two read-only commands would violate the trimmed stack (architecture §2).
- **Deterministic:** given the same inputs (same file, same git state), always returns the same output.

### Regression anchors (from `lib/plugin-sync.test.ts` header)

| Anchor | Risk | Guard |
|---|---|---|
| **B1' (2026-06-16)** | `gitCommitSha: 0` — numeric value passes `typeof !== "undefined"` but not `typeof !== "string"` | `extractSha` checks `typeof sha !== "string"` before returning |
| **I2 (2026-06-16)** | `"pandacorp@panda-corp": []` — empty array, `[0]` access returns `undefined` | Explicit `entry.length === 0` guard before array access |
| **I3 (2026-06-16)** | Entry is a plain object rather than an array | `!Array.isArray(entry)` branch handles it; returns SHA or `null`, never throws |

### Consumption (downstream work orders)

- **WO-15-002** (`getPluginSyncState`): calls all three readers, composes the `PluginSyncState` verdict (`drift`, `reason`, `detail`). Passes `homeDir()` as `claudeHome` and `resolveFactoryRoot()` as `factoryRoot`.
- **WO-15-003** (`app/api/plugin-sync/route.ts`): calls `getPluginSyncState()` and returns the verdict as JSON. Node runtime, `force-dynamic`.
- **WO-15-004** (`components/plugin-sync-banner.tsx`): polls the route handler, renders only when `drift === true`.

### Test coverage

`lib/plugin-sync.test.ts` — 32 tests across 7 groups (vitest, Node environment, no mocks — real temp git repos and temp dirs):

| Group | ACs covered |
|---|---|
| AC-15-001.1 — valid fixture returns `gitCommitSha` | 40-char SHA, first-element pick, abbreviated SHA |
| AC-15-001.2 — null on missing/malformed/absent | Missing file, malformed JSON, no key, nonexistent claudeHome, empty array (I2), absent field, empty string, numeric SHA (B1'), object entry (I3) |
| SHA hygiene — whitespace-free compare-safe value | Whitespace-padded SHA → trimmed (no false-drift); whitespace-only → null |
| AC-15-001.3 — never returns semver version | SHA returned when both present; null returned when only version present |
| AC-15-001.4 — `readPluginHeadSha` from real temp git repo | 40-char SHA, deterministic, non-repo → null, nonexistent → null, no-plugin-commit → null, second commit updates SHA |
| AC-15-001.5 — `readPluginDirty` uncommitted changes | Modified file → true, untracked → true, clean → false, non-repo → false, nonexistent → false, outside plugin → false, staged → true |
| REQ-15-005 — read-only invariant | claudeHome not modified, git working tree not modified by `readPluginHeadSha`, git working tree not modified by `readPluginDirty` |

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

---

## WO-12-003: `eventsPerMinute` — per-minute rate selector (per-agent)

**Module:** `app/_observability/selectors/rate.ts`
**Traces:** IF-12-rate → REQ-12-007 → AC-12-007.1
**Dependencies:** `lib/events.ts` (`Event` type — no I/O; operates on the already-parsed capped tail)

Single source of the events-per-minute rate metric. Consumed by FRD-06 `ActivityPulse`
(WO-06-009) and FRD-18 dashboard. No duplication — all rate derivations go through this one
function (REQ-12-007 "no extra instrumentation").

### IF-12-rate — `eventsPerMinute`

```ts
// app/_observability/selectors/rate.ts

import type { Event } from "../../../lib/events";

/**
 * A per-minute bucket of event counts.
 *
 * `minute`  — ISO minute key "YYYY-MM-DDTHH:MM" (UTC, no seconds).
 * `total`   — total count of all events in this minute.
 * `byAgent` — per-agent count; only string-valued `agent` fields are tracked.
 *             An event with no `agent` (or a non-string `agent`) increments
 *             `total` but is NOT reflected in `byAgent`.
 */
export type Bucket = {
  minute: string;
  total: number;
  byAgent: Record<string, number>;
};

/**
 * Derive per-minute event counts from the capped event tail.
 *
 * @param events - The already-parsed, capped `Event[]` from `lib/events`.
 *                 No re-reading, no I/O (blueprint §3, REQ-12-007).
 * @param window - Number of minutes to cover (e.g. 30). Must be a positive
 *                 integer. NaN/±Infinity → [] without throwing (B1' anchor).
 *                 Negative → [] (clamped). 0 → [].
 * @param now    - Reference instant. Injected for determinism in tests.
 *                 Defaults to `new Date()` at call-time.
 * @returns      `Bucket[]` with exactly `window` entries (oldest first),
 *               or `[]` when `window` is 0 or invalid. Never throws.
 */
export function eventsPerMinute(events: Event[], window: number, now?: Date): Bucket[];
```

### Window semantics

The window covers the `window` most-recently **completed** full UTC minutes before `now`.

Example: `now = 2026-06-16T12:30:45Z`, `window = 5`
→ Buckets: `[12:25, 12:26, 12:27, 12:28, 12:29]` (oldest first, newest = `12:29`).

The minute currently in progress (`12:30`) is excluded — only complete minutes are bucketed.
Each bucket key `"YYYY-MM-DDTHH:MM"` covers the half-open interval `[MM:00, MM+1:00)`.
Events at exact minute boundaries (e.g. `12:28:00Z`) belong to bucket `"12:28"`.

### Bucket invariants

| Field | Invariant |
|---|---|
| `minute` | ISO minute key `"YYYY-MM-DDTHH:MM"`, always UTC, always 16 chars |
| `total` | Non-negative finite integer; never NaN (B1') |
| `byAgent` | Plain object; keys are non-empty strings; values are positive integers (≥1) |
| `sum(byAgent values)` | ≤ `total` for every bucket; equals `total` when all events have an `agent` |

### Behaviour contract

| Input | Result |
|---|---|
| `window = 0` | `[]` |
| `window = NaN` | `[]` (B1' anchor — no throw) |
| `window = +Infinity` | `[]` (treated as invalid) |
| `window = -5` | `[]` (clamped) |
| `window = 5`, `events = []` | 5 zeroed buckets (`total=0`, `byAgent={}`) |
| Event `at` outside the window | Silently excluded from all buckets |
| Event with invalid `at` string | Silently skipped (FREEZE-ON-RED anchor) |
| Event with no `agent` field | Counted in `total`, absent from `byAgent` |
| Event with non-string `agent` (e.g. array) | Same as no agent (I3 anchor) |
| Same events, same `now` | Identical result (deterministic / pure) |

### Stalled-pulse signal

When no events fall within the window, all buckets have `total = 0` and `byAgent = {}`.
FRD-06 `ActivityPulse` reads this as the "stalled" signal.

### Regression anchors

| Anchor | Risk | Guard |
|---|---|---|
| **B1' (WO-13-001)** | `typeof NaN === "number"` — `window=NaN` silently produces wrong bucket count | `Number.isFinite(window)` check before any bucket construction |
| **B1a (WO-12-003)** | `__proto__` as a plain-object key is silently swallowed; write is dropped, count is lost | `byAgent` uses `Object.create(null)` — null-prototype — so `__proto__` is an own enumerable property |
| **B1b (WO-12-003)** | `byAgent["constructor"] ?? 0` reads the inherited `Object` constructor (truthy function), so `Function + 1` produces a corrupted string `"function Object()…1"` instead of a number | `Object.hasOwn(byAgent, key)` used to read existing counts; `Object.create(null)` eliminates all inherited members; copy via `Object.assign(Object.create(null), src)` preserves null prototype |
| **I2 (WO-13-001)** | Empty event array with `window > 0` should produce zeroed buckets, not throw | All `window` buckets pre-allocated with `total=0, byAgent={}`; empty array → zeroed, not `undefined` |
| **I3 (WO-13-001)** | Non-string `agent` (e.g. an array `["implementer"]`) coerces to `"implementer,"` as an object key | `typeof ev.agent === "string"` guard before touching `byAgent` |
| **FREEZE-ON-RED (WO-02-004)** | Events missing `at` or with invalid `at` must not abort the batch | `Number.isFinite(Date.parse(ev.at))` guard; invalid → `continue`, not `throw` |
| **WO-12-001 ordering** | Lexicographic ISO string comparison is unsafe for non-UTC offsets | `Math.floor(Date.parse(at) / 60_000)` used for bucket assignment — numeric, not lexicographic |

### Consumer contract (FRD-06 + FRD-18)

Mutation isolation: each call returns fresh `Bucket` objects (deep-copied `byAgent`). Mutations
by one consumer (e.g. ActivityPulse) do not corrupt a second consumer (e.g. FRD-18 dashboard).

### Architecture invariants

- **Pure:** no I/O, no `process.env` reads, no `Date.now()`, no side effects.
- **Never throws** for any combination of inputs.
- **Deterministic:** identical `events` + `now` → identical `Bucket[]`.
- **Fully serializable:** `Bucket` fields are `string | number | Record<string, number>` — no class instances, no `Date`, no functions.
- **Idempotent:** calling twice with the same arguments returns deeply equal results.

### Test coverage

`app/_observability/selectors/rate.test.ts` — 78 tests across 8 groups (vitest, pure — no fixtures, no I/O):

| Group | Coverage |
|---|---|
| AC-12-007.1 output structure | 11 tests: exact bucket count per window, format, uniqueness, ascending order, finite totals |
| AC-12-007.1 event bucketing | 9 tests: single/multi minute placement, window exclusion, boundary, sum invariant, stalled-pulse |
| AC-12-007.1 per-agent breakdown | 8 tests: single/multi agent, no-agent total-only, empty byAgent, sum ≤ total, cross-minute isolation, 5-agent + 10-agent cases |
| Determinism / pure function | 5 tests: idempotency, `now`-shift, 200-event volume, env-independence, mutation isolation |
| Error paths / regression anchors | 8 tests: I2 (empty→zeroed), B1' (NaN window), I3 (non-string agent), FREEZE-ON-RED (sparse events, invalid `at`), WO-12-001 ordering |
| Prototype-pollution regression (B1a/B1b) | 9 tests: `__proto__` count not lost + no prototype pollution; `constructor`/`toString`/`valueOf`/`hasOwnProperty` counts are finite numbers not strings; combined dangerous-keys sum; consumer-safety guard |
| Property-based invariants (parametric) | 11 tests: sum ≤ length, sum(byAgent) ≤ total, exact bucket count × 5 windows, unique keys, non-negative integers, byAgent counts ≥ 1, ascending order, never-throws × 4 edge windows |
| Specific behavior assertions | 7 tests: multi-agent/minute concrete map, window=1 with/without events, 10-agent byAgent size, newest bucket ≤ now, status=fail still counted, cross-window exclusion |
| FRD-06/FRD-18 consumer contract | 3 tests: all-zero stalled signal, two-consumer identical result, mutation isolation |

---

## WO-12-004: `toTimeline` — WO → task → action tree selector

**Module:** `app/_observability/selectors/timeline.ts`
**Traces:** IF-12-timeline → REQ-12-003, REQ-12-007 → AC-12-003.1, AC-12-007.1
**Dependencies:** `lib/events.ts` (`Event` type — no I/O; operates on the already-parsed capped tail)

Pure selector that folds the event tail into a flat, parent-linked tree: work order → task → action.
The tree is consumed by `CMP-12-timeline` (TimelineView RSC) and the RPG↔timeline toggle
(`CMP-12-toggle`). No HTTP, no I/O, no Claude calls.

### IF-12-timeline — `toTimeline`

```ts
// app/_observability/selectors/timeline.ts

import type { Event } from "../../../lib/events";

/**
 * A single row in the flattened timeline tree.
 *
 * - Level 0 (kind="wo"):     one row per distinct workOrder id; parentId=null.
 * - Level 1 (kind="task"):   one row per distinct (workOrder, task) pair; parentId=wo.id.
 * - Level 2 (kind="action"): one row per individual event; parentId=task.id or wo.id.
 * - Orphan (no workOrder):   top-level action rows; parentId=null.
 */
export type TimelineRow = {
  /** Stable unique id within a single toTimeline call output. */
  id: string;
  /** Tree level: "wo" | "task" | "action". */
  kind: "wo" | "task" | "action";
  /** workOrder id (wo), task id (task), or event name (action). */
  label: string;
  /** ISO 8601 string of the earliest event timestamp within this node's subtree. */
  start: string;
  /**
   * ISO 8601 string of the latest terminal (ok/fail) event within the subtree.
   * null when the node has no terminal events (in-progress / "running").
   */
  end: string | null;
  /**
   * Date.parse(end) - Date.parse(start) in milliseconds.
   * null when end is null. Always a finite non-negative number or null (never NaN).
   */
  duration: number | null;
  /** Parent row id; null for WO rows and orphan actions. */
  parentId: string | null;
  /** "running" when end is null; "fail" when any terminal child is "fail"; "ok" when all ok. */
  status: "ok" | "fail" | "running";
};

/**
 * Fold the capped event tail into a flat list of TimelineRow objects.
 *
 * @param events - The already-parsed, capped `Event[]` from `lib/events`.
 * @returns Flat TimelineRow[] navigable by parentId. Never throws. Never returns null.
 */
export function toTimeline(events: Event[]): TimelineRow[];
```

### Tree structure

The output is a **flat array** (not a recursive tree). Callers navigate it via `parentId`:

```
WO row (kind="wo", parentId=null)
  Task row (kind="task", parentId=wo.id)
    Action row (kind="action", parentId=task.id)  <- one per event
  Task row ...
Action row (kind="action", parentId=wo.id)        <- events with workOrder but no task
Orphan row (kind="action", parentId=null)          <- events with no workOrder
```

### Duration semantics (AC-12-007.1)

A node is **closed** (end non-null) only when its subtree contains at least one event with
`status === "ok"` or `status === "fail"`. Events with no `status` field (absent or undefined)
are in-progress markers and never close a node.

| Field | Rule |
|---|---|
| `start` | Earliest `Date.parse(at)` across all events in the subtree (chronological min) |
| `end` | Latest `Date.parse(at)` among terminal (`ok`/`fail`) events in the subtree; `null` if none |
| `duration` | `Date.parse(end) - Date.parse(start)` in ms; `null` when end is null; always `>= 0`; never NaN |

### WO status propagation (B1 fix — 2026-06-16)

WO status is derived from **all children** — both materialized child task rows **and** direct-action
children (events with `workOrder` set but no `task`). A WO with a closed task plus a later running
direct-action is `"running"`, not `"ok"`. (Pre-fix the task-only branch incorrectly reported the WO
as finished; see regression anchor B1 below.)

| Children state | WO status | WO end |
|---|---|---|
| Any child (task or direct-action) is "running" | `"running"` | `null` |
| No running children, any child "fail" (task or direct-action) | `"fail"` | max terminal ts across all closed children |
| All children "ok" (tasks and direct-actions) | `"ok"` | max terminal ts across all children |
| No task children, direct-action children only | Derived from direct-action terminal stats | — |
| No task children, no direct-action children | `"running"` (no terminal events) | `null` |

### Tolerance rules

| Condition | Behaviour |
|---|---|
| `events = []` | Returns `[]` — never throws (I2) |
| Malformed event (missing `event` or `at`) | Silently skipped (FREEZE-ON-RED) |
| null/undefined in events array | Silently skipped |
| Unparseable `at` string | Skipped — `Number.isFinite(Date.parse(at))` guard (B1') |
| `workOrder` present, `task` absent | Action attached directly to WO row |
| No `workOrder`, no `task` | Orphan action row, `parentId=null` |
| Empty-string `workOrder` or `task` | Treated as absent |
| Mixed in-progress + closed tasks | WO is "running" (any running child wins) |
| WO has closed task(s) + open direct-action child | WO is "running" (direct-action open child wins, B1 fix) |
| WO has task child(ren) + failing direct-action child | WO is "fail" (merged verdict from both) |
| WO has task child(ren) + all-ok direct-action child(ren) | WO end = max of task ends and direct-action terminal ts |

### Invariants

- **Pure:** no I/O, no `process.env`, no `Date.now()`, no side effects.
- **Never throws** for any combination of inputs.
- **Unique ids** within one call; **valid parentId** resolves to an existing id in the same output.
- **Chronological:** `Date.parse(end) >= Date.parse(start)` when end is non-null.
- **`duration === null` iff `end === null`** (strict biconditional).
- **`status === "running"` iff `end === null`** (strict biconditional).
- **Fully serializable:** all fields are `string | number | null`.
- **Idempotent:** same inputs → deeply equal output.

### Regression anchors

| Anchor | Risk | Guard |
|---|---|---|
| **B1 (2026-06-16 — BLOCKING, fixed)** | `deriveWoRow` ignored direct-action terminal stats when `childTaskRows.length > 0`. WO with closed task + later running direct-action reported as "finished". | Added `woAcc.hasDirectActions` flag set for each direct-action event; `deriveWoRow` merges woAcc stats with task stats when `hasDirectActions === true`. Covered by `timeline.acceptance.test.ts` (B1 regression suite) + `timeline.adversarial.test.ts` (chronological invariant). |
| **M1 (2026-06-16 — minor)** | `Math.max(0, delta)` negative-duration clamp was untested; mutant survived all 95 original tests. | `timeline.acceptance.test.ts` (M1 regression suite) pins `duration >= 0` under out-of-order terminal scenarios. |
| **B1' (WO-13-001)** | `Date.parse("bad") === NaN` — duration arithmetic yields NaN | `Number.isFinite(atMs)` before accumulation; `Number.isFinite(delta)` before returning duration |
| **I2 (WO-13-001)** | `toTimeline([])` must return `[]` not throw | Sentinel Infinity/-Infinity in accumulators; empty input → empty output |
| **I3 (WO-13-001)** | `status === "fail"` must be exact string | `ev.status === "ok" || ev.status === "fail"` only; any other value → non-terminal |
| **FREEZE-ON-RED (WO-02-004)** | Per-event errors must not abort the fold | null/undefined guard per item; malformed events `continue` |
| **ISO offset lesson** | Non-UTC offsets compare wrong lexicographically | All min/max use `Date.parse()` numerics; raw strings kept for display only |

### Test coverage

Three test files (vitest, pure — no I/O, no mocks): **147 tests total**.

**`app/_observability/selectors/timeline.test.ts`** — 95 tests across 12 groups:

| Group | Coverage |
|---|---|
| Empty input | 3 tests: `[]` → `[]`, no throw, returns array |
| WO→task→action nesting | 6 tests: rows created, parentId links, one-row-per-distinct-node |
| Multi-WO fixture | 5 tests: 2 WOs, child task counts, cross-WO parentId isolation |
| Durations from timestamps | 6 tests: 5-min span, 2-min task, single-event=0, WO span, fail terminal, out-of-order |
| In-progress (open) durations | 6 tests: non-terminal events → end=null, duration=null, status="running" |
| Orphan events | 6 tests: no-workOrder orphans, workOrder-only actions attach to WO |
| FREEZE-ON-RED: malformed skipped | 5 tests: missing `at`/`event`, null entries, all-malformed → `[]` |
| B1' regression: no NaN duration | 3 tests: valid ts → finite; bad `at` → no NaN; same ts → 0 |
| I3 regression: exact status literals | 4 tests: union membership; end=null ↔ "running" biconditional |
| Row shape invariants (parametric) | 8 tests x 4 fixtures: all fields correct types |
| Structural invariants | 4 tests: parentId resolves, unique ids, start<=end, duration>=0 |
| WO status propagation | 3 tests: all-ok/"fail"/any-running → correct WO status |
| Never throws (exhaustive) | 8 edge cases including 200-event stress |
| Idempotency | 1 test: two calls with same input → deeply equal |

**`app/_observability/selectors/timeline.acceptance.test.ts`** — 37 tests (B1 + M1 regressions from DR-015 review):

| Group | Coverage |
|---|---|
| B1 regression: WO closed task + open direct-action → "running" | 6 tests: status/end/duration/start/direct-child/parentIds |
| B1 regression: WO open task + closed direct-action → "running" | 1 test |
| B1 regression: WO closed task + failing direct-action → "fail" | 3 tests: status/end/duration |
| B1 regression: WO only direct-action children (existing path pinned) | 2 tests |
| M1 regression: duration >= 0 clamp | 3 tests: out-of-order terminal, WO-level, single-event=0 |
| AC-12-007.1: WO duration covers direct-action timespan | 3 tests: end extended, duration extended, early start |
| AC-12-003.1: direct-action parentId under WO with task siblings | 2 tests |
| AC-12-003.1: WO "ok" requires ALL children ok | 2 tests |
| AC-12-003.1: idempotency under B1 scenario | 1 test |
| AC-12-003.1: never throws under B1 scenario (parametric) | 3 × 4 = 12 cases |
| AC-12-003.1: task-row status independent of direct-action siblings | 2 tests |

**`app/_observability/selectors/timeline.adversarial.test.ts`** — 15 tests (DR-015 reviewer edge cases):

| Group | Coverage |
|---|---|
| A. Mixed children: closed task + open direct action (B1 scenario) | 2 tests: start/chronological invariant |
| B. Same task label across two WOs (key isolation) | 2 tests |
| C. ISO offset: non-UTC compared numerically | 2 tests |
| D. fail + ok coexist → "fail" propagation | 2 tests |
| E. Out-of-order arrival | 2 tests |
| F. Abusive field types (I3/B1' abuse) | 3 tests |
| G. Direct-action parentId + no dangling links | 2 tests |

---

## WO-05-001: `lib/work-orders.ts` — discover + parse work orders (IF-05-work-orders)

**Module:** `lib/work-orders.ts`
**Traces:** IF-05-work-orders; REQ-05-002, REQ-05-005; AC-05-002.1, AC-05-005.1, AC-05-006.1
**Data source:** `docs/frds/frd-*/work-orders/wo-*.md` (per feature; per DR-049 feature-centric layout)
**Consumed by:** WO-05-002 (`aggregateProgress` pure function, same module), WO-05-003 (`CMP-05-board`), WO-05-004 (`CMP-05-frd-filter`), WO-05-006 (`CMP-05-progress`, `CMP-05-empty`)
**Read-only:** no `fs.write*` calls; derives state from on-disk markers written by `/pandacorp:implement`.

### IF-05-work-orders — `lib/work-orders.ts`

```ts
// lib/work-orders.ts

export type WorkOrderState = "todo" | "in_progress" | "review" | "done" | "fail";

export interface WorkOrder {
  /** e.g. "WO-05-003" — unique per project */
  id: string;
  title: string;
  /** The source feature slug, e.g. "frd-05-work-orders" */
  frd: string;
  state: WorkOrderState;
  /** Relative path (forward slashes) from project root to the wo markdown file */
  relPath: string;
  /** Short description for the Summary tab (optional) */
  summary?: string;
}

export interface WorkOrderProgress {
  done: number;
  total: number;
  /** Percentage rounded to 1 decimal place; 0 when total === 0. */
  pct: number;
}

/**
 * Discover work orders across ALL features:
 * docs/frds/frd-NN-SLUG/work-orders/wo-*.md
 *
 * For each file, returns id, title, frd (parent feature slug), state,
 * relPath and optional summary.
 *
 * Partial-tolerant: an unparseable work order defaults to state "todo".
 * Absent work-orders/ directory → 0 items for that FRD (not an error).
 * Never throws. Read-only (no fs.write* calls).
 *
 * @param projectPath - Absolute path to the project root.
 * @returns Array of WorkOrder. Empty array when none found.
 */
export function listWorkOrders(projectPath: string): WorkOrder[];

/**
 * Aggregate progress across a list of work orders.
 *
 * Pure function: no fs calls. Safe to call with an empty array (returns pct=0).
 *
 * @param orders - The full list of work orders for a project.
 * @returns {done, total, pct} where pct is rounded to 1 decimal place.
 */
export function aggregateProgress(orders: WorkOrder[]): WorkOrderProgress;
```

### State derivation — on-disk marker to `WorkOrderState`

The producer (`/pandacorp:implement`) writes a status marker into each work order file. The reader normalises the marker (case-insensitive) to the five `WorkOrderState` values:

| On-disk marker pattern | Derived `WorkOrderState` |
|---|---|
| `## Status: todo` | `"todo"` |
| `## Status: in_progress` | `"in_progress"` |
| `## Status: review` | `"review"` |
| `## Status: done` or `## Status: DONE` | `"done"` |
| `## Status: fail` | `"fail"` |
| `## Status: BLOCKED` or `## Status: blocked` | `"fail"` (BLOCKED is an alias for fail) |
| `**Status:** done` (bold inline form) | `"done"` |
| `Status: **DONE**` (value in bold) | `"done"` |
| No status marker found | `"todo"` (partial-tolerance default) |
| Unknown value (e.g. `XYZZY`) | `"todo"` (partial-tolerance default) |

The regex is case-insensitive and matches both markdown heading (`## Status: …`) and inline bold (`**Status:** …`) forms to handle the various formats the producer can emit. Only the capture group value is normalised; the surrounding markdown decoration is stripped.

### Field derivation rules

| Field | Rule |
|---|---|
| `id` | First `WO-NN-NNN` token in the H1 title; fallback: filename prefix uppercased (e.g. `wo-05-001-…` → `"WO-05-001"`). |
| `title` | First H1 line (`# …`) stripped of leading `# `; fallback: filename stem without `.md`. |
| `frd` | Exact directory name of the parent FRD folder (e.g. `"frd-05-work-orders"`). Never a substring or derived slug. |
| `state` | Normalised from the on-disk status marker (see table above). Defaults to `"todo"` if unparseable. |
| `relPath` | `path.relative(projectPath, absPath)` with forward-slash separators (never absolute; never starts with `../`). |
| `summary` | Text under the first `## Summary` heading, collected until the next heading. `undefined` when absent or empty. |

### Discovery algorithm

1. Read `docs/frds/` in `projectPath`. If absent/unreadable → return `[]`.
2. For each entry matching `/^frd-\d/` that is a directory: scan `<entry>/work-orders/`.
3. For each file matching `/^wo-.+\.md$/i` that is a regular file: parse it with `parseWorkOrderFile`.
4. Partial-tolerance: any parse error → `state` defaults to `"todo"`; the file still appears in results.
5. Directories not matching `/^frd-\d/` (e.g. `not-a-frd-dir`) are excluded entirely.

### Defensive contract — `listWorkOrders`

| Input condition | Result |
|---|---|
| Valid project, multiple FRDs with work orders | `WorkOrder[]` with all WOs from all FRDs |
| `docs/frds/` absent | `[]` (no throw; AC-05-006.1) |
| FRD dir has no `work-orders/` sub-dir | 0 items from that FRD (no throw) |
| `work-orders/` has no `wo-*.md` files | 0 items (regression I2: no phantom items) |
| `work-orders/` has only non-matching files (README.md, .txt) | 0 items |
| Dir not matching `/^frd-\d/` (e.g. `not-a-frd-dir`) | Excluded (WO-16-001 regression) |
| `wo-*.md` has no Status field | `state="todo"`, item still returned (partial-tolerance) |
| `wo-*.md` is empty | `state="todo"`, item still returned, title falls back to filename stem |
| `wo-*.md` has unknown status value | `state="todo"` (partial-tolerance) |
| `projectPath` does not exist | `[]` (no throw; never-throws invariant) |
| `projectPath` is empty string `""` | `[]` (no throw) |
| Called twice on same project | Identical results (idempotency) |
| Result `JSON.stringify` + `JSON.parse` | Equal to original (serializability) |
| `frd` field | Exact parent dir name, never a substring or phantom slug (WO-17-001 regression) |
| String fields (`id`, `frd`, `title`, `relPath`) | No leading/trailing whitespace (WO-15-001 SHA-hygiene regression) |
| `relPath` | Always relative, forward-slash, never absolute, never starts with `../` |
| `result.length` | Always a finite integer, never NaN (regression B1') |
| `Array.isArray(result)` | Always `true` (regression I3) |
| No files written/modified | `mtime` unchanged; no new files or dirs created (AC-05-005.1 read-only) |

### Defensive contract — `aggregateProgress`

| Input condition | Result |
|---|---|
| Non-empty list with some `done` | `{ done: N, total: M, pct: … }` |
| All work orders `done` | `pct = 100.0` |
| No work orders `done` | `done = 0`, `pct = 0` |
| Empty list (`[]`) | `{ done: 0, total: 0, pct: 0 }` — no division by zero |
| `pct` | Rounded to 1 decimal place (`Math.round(x * 1000) / 10`) |

### Architecture invariants

- **Read-only:** `listWorkOrders` uses `fs.readdirSync`, `fs.statSync`, `fs.readFileSync` only — no writes, no Claude calls (architecture §1, REQ-01-011).
- **Never throws:** both functions catch every error and degrade to `[]` / safe defaults.
- **Genuine JS Array:** `listWorkOrders` returns an Array (`Array.isArray()` true — regression I3).
- **Forward-slash relPaths only:** all `relPath` values use `/` regardless of OS.
- **Partial-tolerance:** a single malformed WO does not drop other WOs from the same FRD.
- **Deterministic / idempotent:** same filesystem state → same output, always.
- **Serializability:** `WorkOrder[]` is a plain serializable value — safe for Next.js Server→Client prop passing.
- **No `any`, no `@ts-ignore`:** strict TypeScript throughout.

### Regression anchors

| Anchor | Risk | Guard |
|---|---|---|
| **B1' (2026-06-16)** | NaN slips through numeric guards | `result.length` is from array `push` — always a finite integer |
| **I2 (2026-06-16)** | Empty `work-orders/` satisfies guards vacuously | File pattern `/^wo-.+\.md$/i` must match; empty dir → 0 items, not 1 phantom |
| **I3 (2026-06-16)** | Array-shaped objects fool `typeof` | Return value is a genuine `WorkOrder[] = []` literal grown with `push` |
| **WO-17-001 phantom-slug (2026-06-16)** | Ambiguous text in `frd` produces phantom slugs | `frd` is set to the exact directory name entry from `fs.readdirSync` — no substring trimming |
| **WO-16-001 non-frd dirs (2026-06-16)** | Non-matching dirs included | Only dirs matching `/^frd-\d/` are scanned |
| **WO-15-001 SHA-hygiene (2026-06-16)** | Whitespace in string fields causes false inequality | All string fields are `.trim()`-ed before return |

### Consumption (downstream WOs)

- **WO-05-002** (`aggregateProgress`): pure function in the same module; called by `CMP-05-progress` (WO-05-006).
- **WO-05-003** (`CMP-05-board`): calls `listWorkOrders(projectPath)` server-side; distributes WOs to the four-column kanban.
- **WO-05-004** (`CMP-05-frd-filter`): receives `WorkOrder[]` from the board; groups/filters by `frd` field.
- **WO-05-006** (`CMP-05-progress`, `CMP-05-empty`): calls `aggregateProgress`; renders `done/total/%`; detects empty state (`total === 0`).

### Test coverage

`lib/work-orders.test.ts` — 56 tests across 10 groups (vitest, Node environment, no mocks — real fs reads against fixture tree + temp dirs):

| Group | ACs / invariants covered |
|---|---|
| AC-05-002.1 — EACH WO carries parent FRD slug | Non-empty `frd`; correct slug per FRD; all distinct slugs present; no phantom slugs (WO-17-001) |
| State derivation — all 5 `WorkOrderState` values | `todo`, `in_progress`, `review`, `done`, `fail`; uppercase DONE/BLOCKED/IN_PROGRESS; bold `**Status:**` form; round-trip via temp file |
| AC-05-005.1 — partial-tolerant: unparseable → `"todo"` | No Status field → `todo`; garbage file no throw; empty file → `todo`; unknown value → `todo`; malformed doesn't drop valid WOs |
| Absent `work-orders/` → [] for that FRD | FRD with no `work-orders/` dir → 0 items; no `docs/frds/` → `[]`; `work-orders/` empty → 0 items; only non-matching filenames → 0 |
| Discovery breadth — all FRD dirs scanned, non-FRD excluded | 3 FRD slugs all present; `not-a-frd-dir` excluded; 2 FRDs with 2 files each → 4 items; temp project 3 WOs → length 3 |
| WorkOrder shape invariants | Non-empty id/title/frd/state/relPath; unique ids; forward-slash relPaths; not absolute; no `../` start; genuine Array (I3); finite length (B1'); summary undefined or non-empty string; summary populated for WO with `## Summary`; no whitespace in string fields (WO-15-001) |
| AC-05-005.1 — read-only: never writes | `mtime` unchanged after 2 calls; non-existent path creates no file/dir; dir tree snapshot identical before/after |
| Never-throws invariant | Non-existent path → no throw + `[]`; empty string → no throw + `[]`; empty `work-orders/` dirs → no throw + `[]`; empty file → no throw |
| Idempotency | Two calls → deeply equal results |
| Serializability | `JSON.stringify` + `JSON.parse` → equal to original |
| relPath correctness | Every relPath exists on disk; matches `docs/frds/<frd>/work-orders/wo-*.md` pattern; `relPath.split("/")[2]` === `frd` field |
| AC-05-006.1 — no work orders → `[]` | No `docs/frds/` → `[]`; all FRDs lack `work-orders/` → `[]` |
