<!--
  TEMPLATE for docs/design/components.md — the living component inventory (DR-057). Seeded by
  /pandacorp:design (Step 7) from the frozen design system (or Claude Design's _ds_manifest.json);
  EVERY work order that adds a shared component appends its row. Check it BEFORE creating any UI
  component (reuse -> adapt/extend -> only then create). A near-duplicate is a defect, not a feature.
-->

# Component inventory — Replace with the product title

> The single list of shared components (and app-wide framing patterns) the build reuses. **Check
> before you create** (DR-057): reuse an existing row → adapt/extend it (add a prop/variant) → only
> then create new, and append a row here. A second banner/card/modal that re-implements an existing
> primitive is rejected at review. The framing patterns keep the app ONE coherent application (DR-062).

## Primitives — `components/core/`

| Component | Purpose | Path | Key props / variants |
|---|---|---|---|

## Modules — `components/modules/`

| Component | Purpose | Path | Key props / variants |
|---|---|---|---|

## Framing patterns (app-wide — one of each, used everywhere)

The page-title block, section header, tab style, chip/panel/empty-state language that every surface
reuses (a surface inventing its own variant is a cohesion defect, DR-062).

| Pattern | Purpose | Path | Notes |
|---|---|---|---|

## AppShell nav contract (DR-075)

<!-- Recorded by /pandacorp:design Step 8a-b (or /pandacorp:adopt step 6.3) FROM THE PROTOTYPE, never
     from the app's own routes. /pandacorp:architecture step 6 PARSES THIS SECTION to seed
     `e2e/shell.ts` (the Shell-Presence Gate) — keep the field labels and the list format exactly.
     If the app has no persistent chrome, write `none` as the landmark and leave the lists empty. -->

- **Shell landmark selector:** `[data-app-shell]` (the selector the built shell must expose; `none` = no shell)
- **Top-level destinations** (from the prototype's persistent nav, one `{label, path}` per line):
  - `{ label: "…", path: "/…" }`
  - `{ label: "…", path: "/…" }`
- **Shell-exempt routes** (legitimately render WITHOUT the shell): none | `/login`, …
- **Mobile drawer/toggle:** none | `<selector + behaviour, if the design uses one>`
