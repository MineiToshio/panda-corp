# FRD-11 — Per-project build modes · feature blueprint

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> Per-FRD blueprint (DR-049). References the platform architecture
> ([`../../product/architecture.md`](../../product/architecture.md)) rather than restating it.
> Visual reference: `prototype/index.html` (`BUILDMODES`, `buildModePanel`).

## 0. Scope & traceability note

The FRD's acceptance criteria are bare EARS bullets; this blueprint assigns the canonical IDs
(`REQ-11-MMM` → `AC-11-MMM.K`), 1:1 with the EARS bullets in source order.

FRD-11 provides the **build mode selector** mounted inside the FRD-04 **Commands** tab
(`CMP-04-tab-commands` slots `CMP-11-mode-selector`). It shows the four modes, the exact command to
copy per mode, and **remembers the chosen mode per project**.

The fourth AC ("the `/pandacorp:implement` skill SHALL accept those modes as an argument") is a
**factory-plugin** responsibility (the skill), **not** Mission Control code. MC only *shows* the
command. Flagged in §5.

## 1. Requirements (derived IDs)

| REQ | EARS (from `frd.md`) |
|---|---|
| REQ-11-001 | EACH project SHALL offer (in its Commands tab) a build mode selector with four options: Pro/economical, Balanced (default), Powerful, Deep — each with its agents/models/recommended-plan description. |
| REQ-11-002 | WHEN the owner chooses a mode, the exact command to copy (`/pandacorp:implement [mode]`) SHALL be shown with its description. |
| REQ-11-003 | The chosen mode SHALL be remembered per project. |
| REQ-11-004 | The `/pandacorp:implement` skill SHALL accept those modes as an argument (`pro` \| `powerful` \| `deep`; none = balanced). |

### Acceptance criteria (EARS, expanded)

- **AC-11-001.1** The selector SHALL render four mode options in order: Pro/economical, Balanced, Powerful, Deep.
- **AC-11-001.2** EACH option SHALL show its description (agents, models, recommended plan).
- **AC-11-001.3** The default selected mode SHALL be **Balanced** when no mode has been chosen for the project.
- **AC-11-002.1** WHEN a mode is selected, the exact copy command SHALL be shown: `/pandacorp:implement` for balanced, `/pandacorp:implement pro|powerful|deep` for the others, with a copy button.
- **AC-11-002.2** The selected mode's description SHALL be shown alongside the command.
- **AC-11-003.1** The chosen mode SHALL persist per project across refresh and tab close (client-local UI state, NOT a factory/project write).
- **AC-11-003.2** Re-opening the project's Commands tab SHALL restore its remembered mode.
- **AC-11-004.1** (Out of MC scope — factory plugin) The `/pandacorp:implement` skill accepts `pro|powerful|deep`; none = balanced. MC surfaces the matching command only.

## 2. Interfaces (`lib/**`)

FRD-11 needs **no new `lib/` reader** — the mode catalog is a static constant and persistence is
**client-local** (architecture §4.8, like the `visto_hasta` marker and theme). Per architecture §11,
FRD-11's primary `lib/` touchpoint is `status` (only to scope the per-project memory key); it does
**not** write to `status.yaml` (read-only invariant).

### IF-11-modes — `lib/constants.ts` (build mode catalog)
A static, typed catalog (no fs) centralizing the four modes (factory convention: no magic strings —
the catalog lives in `lib/constants.ts`).

```ts
export type BuildMode = "pro" | "balanced" | "powerful" | "deep";
export interface BuildModeInfo {
  id: BuildMode;
  label: string;       // i18n key
  description: string; // i18n key: agents, models, recommended plan
  command: string;     // "/pandacorp:implement" | "/pandacorp:implement powerful" | …
}
export const BUILD_MODES: readonly BuildModeInfo[]; // four entries, balanced default
export const DEFAULT_BUILD_MODE: BuildMode = "balanced";
```

### IF-11-mode-store — client-local persistence
A tiny client helper over `localStorage`, keyed by project slug (architecture §4.8 — a UI
preference, **not** a factory/project write):

```ts
// in a "use client" module
export function getRememberedMode(slug: string): BuildMode; // DEFAULT_BUILD_MODE when unset
export function rememberMode(slug: string, mode: BuildMode): void;
```

> No `status.yaml` write. This keeps the read-only invariant intact (architecture §7); the mode is a
> UI preference exactly like the dashboard `visto_hasta` marker.

## 3. Components (`CMP-11-*`) and app surface

App surface (architecture §11): rendered inside the FRD-04 workspace **Commands** tab — no new
route. `CMP-04-tab-commands` mounts `CMP-11-mode-selector`.

| Component | Kind | Responsibility | Implements |
|---|---|---|---|
| `CMP-11-mode-selector` | Client | The four-mode selector; shows description + copy command for the active mode; remembers the choice per project. | REQ-11-001, REQ-11-002, REQ-11-003 |
| `IF-11-modes` | lib | `BUILD_MODES` catalog in `lib/constants.ts`. | REQ-11-001 |
| `IF-11-mode-store` | client lib | Per-project mode persistence (`localStorage`). | REQ-11-003 |

It reuses the shared `CopyButton` for the command row.

## 4. Cross-cutting

- **Read-only invariant preserved**: persistence is client-local `localStorage` (architecture §4.8),
  never a write to `status.yaml` or any factory/project file (architecture §7).
- **No magic strings**: the catalog lives in `lib/constants.ts` (AGENTS.md).
- **Tokens & a11y** (FRD-13): the selector is a `role=radiogroup`/segmented control with keyboard
  support; active mode shown by more than color (label/checkmark); Spanish copy via i18n.

## 5. Traceability matrix & flags

| REQ | AC | Component(s) | Interface(s) |
|---|---|---|---|
| REQ-11-001 | AC-11-001.1/.2/.3 | CMP-11-mode-selector | IF-11-modes |
| REQ-11-002 | AC-11-002.1/.2 | CMP-11-mode-selector | IF-11-modes |
| REQ-11-003 | AC-11-003.1/.2 | CMP-11-mode-selector | IF-11-mode-store |
| REQ-11-004 | AC-11-004.1 | — (factory plugin, not MC) | — |

**Flag (out of MC scope):** REQ-11-004 (the `/pandacorp:implement` skill accepting `pro|powerful|deep`)
is a factory-plugin change, not Mission Control code. MC only surfaces the command string. No MC work
order implements it; it is recorded here for traceability and noted in the report.
