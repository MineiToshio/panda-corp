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
