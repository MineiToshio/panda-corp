---
id: WO-15-004
type: work-order
slug: sync-banner
title: WO-15-004 — `PluginSyncBanner` client component (poll + self-clear)
status: DRAFT
parent: FRD-15
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-17'
---
# WO-15-004 — `PluginSyncBanner` client component (poll + self-clear)

> Source-of-truth: [`blueprint.md`](../blueprint.md) (`CMP-15-banner`, `CMP-15-recall`) · [architecture §3, §7](../../../product/architecture.md).
> Visual reference: `prototype/index.html` `pluginBanner()` (lines 563–567).

## Goal
The read-only drift banner that polls `/api/plugin-sync`, renders ONLY on `drift === true`, shows the
reason + the copyable recovery command, and clears itself when sync is restored.

## Scope
- `components/plugin-sync-banner.tsx` (`"use client"`): fetch `/api/plugin-sync` on mount + on an
  interval; render nothing unless `drift`. On `drift`, render the amber `--warn` panel with the
  alert-triangle icon, the reason copy, the commit→run→restart recall, and the command row with a
  copy button (`CopyButton` from FRD-02).
- The command is `claude plugin update pandacorp@panda-corp`; when `reason` is `uncommitted`/`both`,
  prefix the recall with "1) commitea los cambios".

## Acceptance criteria
- **AC-15-004.1** (REQ-15-001/002) WHEN the probe returns `drift === true`, the banner renders with the
  reason-appropriate copy (uncommitted vs behind vs both).
- **AC-15-004.2** (REQ-15-004) WHEN the probe returns `drift === false` (or `unknown`), the banner
  renders nothing; a re-poll that flips to `false` removes a previously shown banner (self-clear).
- **AC-15-004.3** (REQ-15-003) The command `claude plugin update pandacorp@panda-corp` is shown via a
  copy button; clicking copies it to the clipboard.
- **AC-15-004.4** (REQ-15-005) The banner has NO action that executes anything — only copy + navigate;
  no fetch with a non-GET method.
- **AC-15-004.5** All user-facing copy and `aria-label`s are Spanish (DR-009); state is not conveyed by
  color alone (icon + text), per FRD-13.

## TDD
`components/plugin-sync-banner.test.tsx` with `@testing-library/react` + `jsdom`; mock `fetch` to
return each `PluginSyncState`. Assert render/no-render per drift, copy on click, self-clear on re-poll.

## Definition of done
- ACs RED → GREEN. Renders only on drift; self-clears; copy works; Spanish copy. `.pandacorp/verify.sh` green.

## Dependencies
- WO-15-003 (the route).
- FRD-02 `CopyButton` (cross-feature). If unavailable, use a minimal inline copy and note the upgrade.

## Status Note

**Built:** `PluginSyncBanner` (`"use client"`) at `components/plugin-sync-banner.tsx` — polls
`/api/plugin-sync` every 15 s (plus immediately on mount), renders nothing unless `drift === true`,
self-clears on the next poll that returns `drift === false` or `reason === "unknown"`.

**Interfaces / contracts exposed:**

```tsx
// components/plugin-sync-banner.tsx
export function PluginSyncBanner(): React.JSX.Element | null
// Props: none. Fully self-contained polling loop (useEffect + setInterval).
// Renders null when drift===false or state not yet loaded.
// data-testid: "plugin-sync-banner" (root), "plugin-sync-icon" (warning icon),
//              "plugin-sync-recall" (3-step recall), "plugin-sync-copy-cmd" (wrapper span
//              around CopyButton — use within() to reach "copy-button" inside).
```

**Integration seam (FRD-18 / dashboard):** Mount `<PluginSyncBanner />` at the top of the
dashboard layout (above the topbar or as the first child of the page root). No props needed.
The component is fully autonomous and self-clears.

**Key implementation decisions:**
- `CopyButton` (FRD-02) is reused; a `<span data-testid="plugin-sync-copy-cmd">` wrapper gives
  tests a stable anchor since `CopyButton` has its own hardcoded `"copy-button"` testid.
- Styles: zero hardcoded colors — all `var(--color-warn, oklch(...))` with OKLCH fallbacks inside
  `var()` (not bare), satisfying the "no hardcoded color" token rule.
- `recallForReason`: when `reason === "uncommitted" | "both"` → prefixes "1) commitea los cambios ·"
  and renumbers run/restart steps to 2/3. When `reason === "behind"` → steps are 1/2 (no commit step).

**Gotcha — infinite timer loop with `vi.runAllTimersAsync()`:** a `setInterval` polling loop
re-schedules itself on every tick, causing Vitest's `runAllTimersAsync` to abort with "10 000
timers" error. Fix: use `vi.advanceTimersByTimeAsync(0)` to flush the initial poll's microtask chain
(fetch → json → setState), and `vi.advanceTimersByTimeAsync(N)` for subsequent interval advances.
`vi.runOnlyPendingTimersAsync()` exists but alone does not drain Promise microtasks from async
functions. (agent-inferred — candidate for factory/memory)

**Test file:** `components/plugin-sync-banner.test.tsx` — 30 tests RED→GREEN covering all 5 ACs:
render-on-drift (3 reasons), no-render on in-sync/unknown, self-clear on re-poll, copy command
present and clickable, GET-only, Spanish copy, a11y icon, polling mount/interval/unmount,
fetch-error resilience.
