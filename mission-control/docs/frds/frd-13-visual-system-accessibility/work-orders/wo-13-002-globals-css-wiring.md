---
id: WO-13-002
type: work-order
slug: globals-css-wiring
title: >-
  WO-13-002 — globals.css wiring (themes, elevation, motion, reduced-motion,
  focus)
status: ACTIVE
parent: FRD-13
implementation_status: VERIFIED
source_requirements: []
dependsOn: [WO-13-001]
last_updated: '2026-06-18'
---
# WO-13-002 — globals.css wiring (themes, elevation, motion, reduced-motion, focus)

**Components/Interfaces:** `CMP-13-globals`, `IF-13-theme-vars` · **Traces:** REQ-13-001, REQ-13-002, REQ-13-004, REQ-13-005, REQ-13-006

## Realignment (2026-06-18 — Party redesign, reopened → PLANNED)
Add the `@theme` agent-color tokens for the roles added in WO-13-001 (`--color-agent-implementer`, `--color-agent-copywriter`, `--color-agent-analytics`, `--color-agent-devops`) in both light and dark themes, and remove `--color-agent-guild`. Reuse the existing warm/cat palette; keep contrast ≥4.5:1. Narrow scope — the rest of globals.css stays verified.
**Deploy unit:** global styles · **Location:** `app/globals.css`

## Acceptance criteria (verbatim EARS)
- AC-13-001.1: Theme from few OKLCH tokens; high-contrast mode without redesign.
- AC-13-002.1: A **single rationed accent** (punctuation, not paint); the rest warm neutrals.
- AC-13-004.1: 3 elevation levels with a tokenized shadow/spacing scale.
- AC-13-005.1: Animation only `transform`/`opacity`, <300ms, 2–3 easing tokens.
- AC-13-006.1: The UI SHALL honor `prefers-reduced-motion`: disables ALL Party animation.

## Scope
- Map the frozen `design-tokens.json` into Tailwind v4 `@theme` CSS variables (OKLCH base/accent/contrast; light/dark/high-contrast via `color-scheme` + a data-attr/class).
- Define the 3 elevation levels (canvas/panel/card) as tokenized shadow + radius (8px) + spacing (0.25rem multiples) + hairline (1px).
- Define the motion tokens (durations <300ms, 2–3 easings) as CSS vars; document that animations use only `transform`/`opacity`.
- `@media (prefers-reduced-motion: reduce)`: zero animation durations/transitions globally (the Party engine additionally skips its RAF loop in FRD-06 WO-06-011).
- Visible focus ring var that respects `border-radius`.

## Dependencies
- WO-13-001 (validated token shape), frozen `docs/design/design-tokens.json` (values).

## TDD / Definition of done
- CSS is not unit-tested directly; verification is via the design-phase a11y report (axe-core) + consuming component tests. DoD: the theme vars exist for light/dark/high-contrast; switching the theme attribute changes the resolved vars; the reduced-motion media query is present; biome/tsc clean (no JS). Build succeeds.

## Status Note — IN_REVIEW (2026-06-18 realignment, commit 8bd4be2)

**What was built:**

Realigned `app/globals.css` `@theme` agent-color block to match the Party redesign role set from WO-13-001 (`tokens.ts`):
- **Removed** `--color-agent-guild` (fictitious aggregate, violates FRD-13 `AGENT_ROLES` contract).
- **Added** `--color-agent-implementer`, `--color-agent-copywriter`, `--color-agent-analytics`, `--color-agent-devops` — all four new real engine/pipeline roles, with warm OKLCH values that reuse the existing L/C ranges (L=0.60–0.70, C=0.18–0.20) to maintain contrast ≥4.5:1.

**Interfaces/contracts exposed:**

- `CMP-13-globals` (`src/app/globals.css`): `@theme` block now declares 32 CSS custom properties (3 OKLCH + 2 surface/text + 13 agent + 3 elevation + 3 spacing + 3 duration + 2 easing + 1 focus-ring + 1 backdrop). The 13 agent keys match `AGENT_COLOR` in `app/_design/tokens/tokens.ts`.
- `IF-13-theme-vars`: unchanged — light/dark/high-contrast theme mode selectors, `:focus-visible`, `@media (prefers-reduced-motion: reduce)` all verified.
- `IF-13-agent-colors`: CSS side is now in sync with the TS side (WO-13-001). FRD-06 (`agentColor()`) and FRD-12 DAG can resolve `var(--color-agent-implementer)` etc.

**Integration seams:**
- `app/_design/tokens/tokens.ts` `AGENT_COLOR` (WO-13-001) → `globals.css` `@theme` CSS vars: all 13 role keys now have a corresponding CSS custom property.
- Party engine / FRD-06 sprite resolver reads `AGENT_COLOR[role]` → `var(--color-agent-<role>)` → resolved by `@theme`.

**Test files:**
- `src/app/_tests/globals.css.test.ts` — 54 tests (52 pre-existing + 2 new regression assertions: guild absent, 4 new roles present).

**Gate results (commit 8bd4be2):**
- `vitest run src/app/_tests/globals.css.test.ts` — 54 passed (0 failed)
- `vitest run` (full suite) — 4924 passed | 2 expected fail | 5 skipped (0 regressions)
- `tsc --noEmit` — clean (exit 0)
- `biome check .` — 36 warnings pre-existing, 0 new errors
- `.pandacorp/verify.sh` — green (exit 0)

## REVIEWER VERDICT — REJECTED → PLANNED (2026-06-18, FRD-13 gate, Opus 4.8)

**Blocking finding (integration regression introduced by this WO).** Removing
`--color-agent-guild` from the `@theme` block left **two dangling consumers** that still
reference the deleted custom property:

- `src/app/achievements/StatsPanel.tsx:64` — `return "var(--color-tier-5, var(--color-agent-guild))";`
- `src/app/achievements/ChainCard/ChainCard.tsx:61` — `return "var(--color-tier-5, var(--color-agent-guild))";`

`--color-tier-5` is **not declared anywhere** in the CSS (verified: `grep "color-tier" src/app/globals.css` → empty), so those two components relied entirely on the `--color-agent-guild`
**fallback**. At last-green `f00b3ca` the token existed (globals.css:49) and the highest tier
("Leyenda"/"Platino") medals/chains rendered with the guild color. After this WO the
`var(--color-tier-5, var(--color-agent-guild))` expression resolves to an **undefined custom
property with no fallback** → the `color` is dropped → tier-5 falls back to inherited text color.
**Real visual regression on the achievements page (FRD-10).**

Why the WO self-test missed it: it asserted only the FORWARD direction (each AGENT_COLOR key has a
CSS var; `guild` absent from `@theme`) and `vitest --changed` does not run the FRD-10 consumer tests
because those source files weren't touched. The reverse contract — *no production code references a
removed `--color-agent-*` token* — was untested.

**Concrete fix (next run, narrow scope — do NOT touch the VERIFIED FRD-10 consumers' state):**
pick ONE —
1. Declare `--color-tier-5` (and ideally `--color-tier-1..4` for consistency) in the `@theme` block
   so the consumers stop relying on a now-removed agent token as fallback; OR
2. If tiers should reuse a surviving agent color, repoint the fallback to a still-declared token
   (e.g. `--color-agent-analytics`) — but the cleaner answer is (1): a tier scale is its own concern,
   not an agent role.

Either way, after the fix `src/app/_tests/agentColorTokens.integration.reviewer.test.ts` (added by
the reviewer) must go green — it now FAILS, proving the regression is real, not decorative.

## REPAIR-PASS RESOLUTION → IN_REVIEW (2026-06-18, repair engine, Opus 4.8)

The regression flagged above is **fixed**. Took the reviewer's option 2 (repoint the fallback to a
still-declared agent token — the cleanest minimal change, and the design contract in
`wo-10-006-chains-almost-there.md` already mandates "fallback to existing agent tokens until FRD-13
defines them explicitly"): the two FRD-10 consumers now use
`var(--color-tier-5, var(--color-agent-product-manager))` instead of the removed
`var(--color-agent-guild)`. `--color-agent-product-manager` (golden `oklch(0.7 0.18 85)`) is a
surviving canonical token that reads as the apex "Leyenda" tier and stays visually distinct from the
tier-1..4 fallbacks (`researcher`/`frontend-dev`/`accent`/`reviewer`).

- `src/app/_tests/agentColorTokens.integration.reviewer.test.ts` — now **2/2 GREEN** (both the
  no-dangling-reference probe and the bidirectional sync probe).
- All 131 FRD-10 achievements component tests still pass (behavior preserved — the tier-5 fallback
  now resolves to a real color again instead of dropping to inherited text).
- Full `.pandacorp/verify.sh` — **green** (187 files, 5145 pass + 2 expected-fail + 5 skipped; biome,
  tsc, madge, structure + max-lines guards all clean).

Returns to IN_REVIEW for the FRD-13 reviewer.

**Note on scope:** WO-13-001 (`tokens.ts` realignment + `Avatar.tsx`) is correct — the bidirectional
`AGENT_ROLES ⟷ @theme` sync probe passes and `tokens.ts` has no `guild` code reference. Only this WO
(the CSS removal) is reopened. Pre-existing fallback refs to non-canonical names
(`--color-agent-librarian/orchestrator/unknown`) are out of FRD-13 scope and predate this cycle.

## Status — DONE (2026-06-16, original)

**[x] DONE — all gates green**

Gate results:
- `vitest run app/globals.css.test.ts` — 52 passed (0 failed)
- `vitest run` (full suite) — 2600 passed
- `tsc --noEmit` — clean (exit 0)
- `biome check .` — exit 0 (added `css.parser.tailwindDirectives: true` + `noImportantStyles: "off"` to `biome.json`)
- `.pandacorp/verify.sh` — green (exit 0)

Implementation notes:
- `app/globals.css`: full `@theme` block with 29 CSS custom properties (3 OKLCH + 2 surface/text + 10 agent + 3 elevation + 3 spacing + 3 duration + 2 easing + 1 focus-ring + 1 backdrop); light/dark/high-contrast theme mode selectors; `:focus-visible` with `outline-offset`; `@media (prefers-reduced-motion: reduce)` with `*` wildcard zeroing `animation-duration`, `transition-duration`, and all `--duration-*` CSS vars (defense-in-depth for Party RAF, WO-06-011).
- `biome.json`: `css.parser.tailwindDirectives: true` to parse `@theme`; `linter.rules.complexity.noImportantStyles: "off"` because `!important` is required in reduced-motion blocks.
- Contract published in `docs/api.md` (WO-13-002 section).
