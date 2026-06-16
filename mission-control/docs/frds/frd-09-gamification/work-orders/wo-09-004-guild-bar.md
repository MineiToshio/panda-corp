# WO-09-004 — `CMP-09-xp-bar` + guild top-bar

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-09-xp-bar`, `CMP-09-guild-bar`](../blueprint.md#3-components--interfaces).

## Goal
Build the reusable honest XP bar primitive and the cross-cutting **guild top-bar** block (level,
title, XP bar to next, "faltan N para Nv X · <next title>"). The top-bar lives in `app/layout.tsx`
and is visible across the app. Consumes `IF-09-guild-xp`.

## Acceptance criteria (EARS, from FRD-09)
- **AC-09-004.1** — The top bar SHALL show the **guild's level and XP** (operator) with a title and a bar to the next level, from `computeGuildLevel()`.
- **AC-09-004.2** — Every number (level, XP, next) SHALL use `font-variant-numeric: tabular-nums` (FRD-13).
- **AC-09-004.3** — The XP bar SHALL reflect **real** pct-to-next; it SHALL NEVER render fake/stuck progress (negative AC, FRD-09).
- **AC-09-004.4** — The XP bar SHALL use the **rationed accent** (FRD-13: accent only on what matters) and SHALL NOT depend on color alone for state (label/shape present).
- **AC-09-004.5** — `CMP-09-xp-bar` SHALL be a reusable primitive consumed by the guild bar, FRD-07 agent detail and FRD-10.

## Dependencies
- WO-09-001 (`IF-09-guild-xp`). Intra-feature.
- FRD-13 tokens, `tabular-nums`. Cross-feature.

## TDD plan
1. RED: tests for top-bar level/title/XP from the engine; `tabular-nums` on numbers; real pct (no fake); rationed accent / not-color-alone; reusability of the bar.
2. GREEN: implement the bar primitive + top-bar block in the layout.
3. Refactor.

## Definition of done
- Component tests green incl. negative AC; tsc + biome clean; tokens only; `tabular-nums`. `.pandacorp/verify.sh` passes.
</content>
