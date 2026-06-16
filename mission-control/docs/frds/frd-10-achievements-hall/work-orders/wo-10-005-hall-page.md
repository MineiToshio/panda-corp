# WO-10-005 — Hall page shell + hero + tabs + stats panel

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-10-hall-page`, `CMP-10-stats-panel`](../blueprint.md#4-components--interfaces).

## Goal
Build `app/achievements/page.tsx` (Server Component): the Guild Hall hero (guild level/XP via
`IF-09-guild-xp` + party avatars via `CMP-09-avatar`), the tabs (Resumen · Misiones · Trofeos ·
Estadísticas) and the **stats panel** (only-grow counters, each with its tier medal). Architecture
§11 surface `app/achievements`.

## Acceptance criteria (EARS, from FRD-10)
- **AC-10-005.1** — The page SHALL show a hero with the guild's level/XP (from `IF-09-guild-xp`) and the party avatars (`CMP-09-avatar`), plus tabs.
- **AC-10-005.2** — The page SHALL show a **statistics panel** with the only-grow counters from `computeStats()`, each with its tier medal.
- **AC-10-005.3** — Every number SHALL use `tabular-nums` (FRD-13); the XP bar reuses `CMP-09-xp-bar` (honest, no fake fill).
- **AC-10-005.4** — The page SHALL render gracefully on an empty/fresh factory (honest zeros, no fabricated trophies) (negative AC).
- **AC-10-005.5** — Styling SHALL use FRD-13 tokens only (tier colors are tokens), Spanish labels/`aria-label`s, keyboard navigation, visible focus.

## Dependencies
- WO-10-001 (`computeStats`). Intra-feature.
- FRD-09 `IF-09-guild-xp`, `CMP-09-xp-bar`, `CMP-09-avatar`. Cross-feature.
- FRD-13 tokens, `tabular-nums`. Cross-feature.

## TDD plan
1. RED: `app/achievements/page.test.tsx` — hero with guild XP + party, tabs, stats panel from the engine, `tabular-nums`, empty-factory honesty, a11y.
2. GREEN: implement the shell + hero + stats panel.
3. Refactor.

## Definition of done
- Component tests green incl. empty-factory negative AC; tsc + biome clean; tokens only; `tabular-nums`. `.pandacorp/verify.sh` passes.
</content>
