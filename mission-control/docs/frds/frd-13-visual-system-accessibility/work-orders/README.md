# FRD-13 — Visual system & accessibility — work orders

Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`. **The frozen
`docs/design/design-tokens.json` + `DESIGN.md` are above this blueprint** — they own the *values*;
these WOs wire and enforce them. FRD-13 is mostly declarative (tokens + CSS + conventions) with two
small interactive pieces (theme toggle, state badge). Land 13-001..003 **early** so every other
feature's UI WOs build against real tokens.

> **Compliance reorg (2026-06-18) — paths.** After the migration to `docs/rules/`: `ThemeToggle` and
> `StateBadge` now live at `components/core/<Name>/<Name>.tsx` (tests in `_tests/`); the a11y primitives
> stay under `components/a11y/` with tests folderized into `components/a11y/_tests/` (e.g.
> `_tests/wo-13-003.test.tsx`); design tokens moved to `app/_design/tokens/tokens.ts`. **Older WO prose
> may cite pre-reorg paths (e.g. `components/a11y/wo-13-003.test.tsx`) — the canonical location is the
> current on-disk path; locate files by name and follow these conventions for new files.** `verify.sh`
> enforces a structure-guard (no loose tests), `max-lines` (≤500) and a circular-dependency gate.

> Precondition: the design phase must freeze `docs/design/design-tokens.json` + `DESIGN.md` (today
> only `docs/design/brief.md` exists). The schema validator and the key maps can be built against the
> agreed *shape* before freeze; the *values* land at freeze. See blueprint §7.

See `../blueprint.md` for components (`CMP-13-*`), interfaces (`IF-13-*`) and the REQ→CMP map.

## Work orders

| WO | Title | Kind | Depends on |
|---|---|---|---|
| WO-13-001 | Token schema validation + agent-color/state-vocab key maps | pure logic + contract | design-tokens.json (shape) |
| WO-13-002 | globals.css wiring (themes, elevation, motion, reduced-motion, focus) | CSS | WO-13-001, frozen tokens |
| WO-13-003 | tabular-nums + a11y primitives (focus ring, aria-live, keyboard nav) | CSS/shared | WO-13-002 |
| WO-13-004 | ThemeToggle (light/dark/high-contrast, persisted) | client UI | WO-13-002 |
| WO-13-005 | StateBadge (icon+shape+label, never color-only) | shared UI | WO-13-001 |

## Order & parallelization

- **Wave 1:** WO-13-001 (validator + key maps — buildable against the token *shape* before freeze).
- **Wave 2 (needs frozen tokens):** WO-13-002 (globals.css), then WO-13-003 (a11y primitives layer
  over it).
- **Wave 3 (parallel):** WO-13-004 (ThemeToggle, needs the theme vars) and WO-13-005 (StateBadge,
  needs the key maps from 13-001).

These WOs gate the UI WOs of FRD-06 and FRD-12 (agent colors, tabular-nums, motion, reduced-motion,
state badges, focus ring). Prioritize 13-001/002/003.
