# Work orders — FRD-09 Gamification

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> The authoritative order is the **Build Plan** in [`../blueprint.md`](../blueprint.md). FRD-09 has no
> new v2 work order: its engine and ledger work orders stay live as built, and its two drawn surfaces
> (sidebar guild card, achievement notice) are built by FRD-19's WO-19-003.

## Work orders

| WO | Slug | Status | Depends on | Summary |
|---|---|---|---|---|
| WO-09-001 | guild-xp-engine | VERIFIED | WO-01-005, WO-06-012 | Pure guild XP / level engine and the 40-rung rank ladder (kept live, built) |
| WO-09-006 | gamification-ledger | VERIFIED | WO-09-001 | Guild ledger `MAX(live, ledger)`, snapshot-on-exceed Server Action and the single guild-state resolver (kept live, built) |

> **Depends on** mirrors each WO's `dependsOn` frontmatter (DR-087).

## Build order

- WO-09-001 sits in W3 and WO-09-006 in W4 by their own dependencies; both are VERIFIED and are not
  rebuilt.
- Cross-FRD: WO-19-003 (FRD-19, W6) builds the guild card and the notice and owns AC-09-008.1 and
  AC-09-008.2; WO-10-016 (FRD-10, W4) builds the Logros hero and the Rangos ladder; WO-13-013 (FRD-13, W7)
  deletes the v1 guild leftovers (top-bar `GuildBar`, `XpBar`, `CelebrationSurface`, `agents.ts`,
  `classifyCelebration`).

## AC coverage

| AC | Work order |
|---|---|
| AC-09-006.1 | WO-09-006 |
| AC-09-006.2 | WO-09-006 |
| AC-09-006.3 | WO-09-006 |
| AC-09-008.1 | WO-19-003 |
| AC-09-008.2 | WO-19-003 |

## Superseded (v1 history)

- WO-09-002 (agent XP / level engine) → WO-07-006, WO-13-013
- WO-09-003 (guild surfaces: GuildBar, GuildHero, StatRadar, CelebrationSurface) → WO-19-003, WO-10-016
- WO-09-005 (celebration tier classifier) → WO-19-002, WO-13-013
- WO-09-007 (rank ladder surfaces) → WO-10-016
