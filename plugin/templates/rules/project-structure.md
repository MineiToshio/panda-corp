---
description: Folder organization, component layering (core/modules), single-file vs multi-file folders, test placement, feature-first code, isolated data layer.
applies_when: always
globs: ["src/**"]
source: Pandacorp standard — structure
---

# Project structure

Put each thing in the **smallest scope that fits its current usage**; promote only when reuse actually appears. (Size limits → `clean-code`.)

Mechanical placement rules (loose `*.test.ts(x)` outside `_tests/`, data-layer isolation) are enforced by `verify.sh`'s structure guard — not repeated here; fix the gate's message, don't argue with it.

## Source root — `src/` is mandatory
- All app code under `src/` (`src/app/`, `src/components/`, `src/lib/`, `src/hooks/`); alias `@/* → ./src/*`.
- Repo root keeps config/tooling (`package.json`, `next.config.*`, `tsconfig.json`, `.env*`, CI) and non-code assets (`public/`, `content/`, `docs/`) — `src/` is for code, not data.
- Skip `src/` only when the technology genuinely doesn't allow it; keep the spirit (one clear source root, separate from config).

## Components — two layers
- `components/core/` — simple, highly reusable primitives (`Button`, `Input`, `Modal`, icons). React components only.
- `components/modules/` — composed reusables built from primitives (`Toolbar`, `DataTable`), not tied to one page.
- Used by a single route → that route's `_components/`, never the global folders.

## Component folders (single-file vs multi-file)
- One file → directly in the parent (`core/Button.tsx`); never a folder holding just one file.
- Multi-file → folder named after the component; main file has the **same name as the folder** — **never** `index.tsx`. Scoped siblings inside: `types.ts`, `utils.ts`, `*.styles.ts`, `use*.ts`, subcomponents, `_tests/`.
- The first scoped sibling — **including a test** — makes it multi-file; a folder that shrinks to one file is flattened back.
- A helper used outside the component is no longer scoped — move it up (page → app) per the promotion rule.

## Reuse before creating (promotion rule)
- Check in order: `components/core` → `components/modules` → the parent route's `_components/` → the route. Create only if none fits.
- When something starts being used in several places, move it to the smallest scope that now fits **in the same change**; don't pre-promote on speculation.

## Feature-first code
- Co-locate what a route owns in `_`-prefixed folders (kept out of the URL): `_components/ _hooks/ _actions/ _schemas/ _types/ _utils/`.
- Scope by segment first: files used only by a child segment go in the child. Global cross-feature code → `lib/`, `hooks/`, `types/`. Route groups `(group)/` organize sections or scope a `layout.tsx` without affecting the URL.
- `src/lib/` groups by purpose (one file per service or classification: `mapbox.ts`, `formatting.ts`); when a second file of a clear concern appears, promote both to a domain subfolder (`lib/auth/`) in the same change — never one at the root and one nested.

## Tests & data layer
- Unit/component tests → `_tests/` inside the component/feature folder; shared test infra → `src/test/`; E2E (Playwright) → top-level `e2e/`, split by domain.
- All DB/persistence access lives in the data layer (`queries/`, one file per model) — never call the ORM/DB from components, pages, layouts, server actions, route handlers or hooks.
