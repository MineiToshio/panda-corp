---
id: FDD-09
type: fdd
slug: gamification
title: Guild layer (sidebar guild card, rank ladder, achievement notice)
status: ACTIVE
parent: FRD-09
ui: true
visual_source: docs/design/prototype/index.html
mock: docs/frds/frd-09-gamification/mocks/gamification.html
last_updated: '2026-10-22'
prototype_blessed_at: '409a0564'
---

# FDD — FRD-09 Gamification (guild layer)

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> This is the Órbita design (round 5, iteration 28), frozen from the approved prototype. It describes only what the captured states of `mocks/gamification.html` draw (DR-130). The guild level lives in the sidebar guild card (no top bar). RPG flavour is used with restraint: pixel emblems and gold accents, never at the cost of legible data. The scaled celebrations (phase animation, release and level-up moments) are out of v2 and not drawn; the gold achievement notice is the only celebration. There are no leaderboards, lives, streak resets or timers.

The Logros screens (hero, Resumen, Misiones, Trofeos, Estadísticas) belong to FRD-10; this FDD owns the sidebar guild card, the Rangos tab as the rank ladder, and the achievement notice. The vocabulary rule stands: «gremio» names the operator layer, «party» the agents building one project (FRD-06).

## Screens

| Screen | Purpose | Oracle state | ACs |
|---|---|---|---|
| Sidebar guild card | The guild level, rank and progress to the next level, visible on every screen | `guild-rank-ladder` | AC-09-008.1, FRD-09#U1 |
| Rank ladder (Logros, tab «Rangos») | The ladder of ranks by era: which are earned, where the owner is, what is still locked | `guild-rank-ladder` | FRD-09#U2 |
| Gold achievement notice | A new trophy raises one notice on top of whatever screen is open (here, Inicio) | `guild-achievement-notice` | AC-09-008.2, FRD-09#U8 |

## States

| State | How it looks | Oracle state | ACs |
|---|---|---|---|
| Guild card, expanded sidebar (1280) | At the foot of the sidebar: a crest with the guild level («22»), the rank name «Portador de Luz III», the line «175 / 200 XP al nivel 23» and a gold progress bar. The whole card is a link to Logros. Its accessible name reads «Gremio nivel 22: Portador de Luz III, 175 / 200 XP al nivel 23». | `guild-rank-ladder` | AC-09-008.1, FRD-09#U1 |
| Guild card on the tablet rail (768) | The card is reduced to the crest with the level and a short gold bar under it. Name and XP line are not shown. | `guild-achievement-notice` | AC-09-008.1 |
| Rank ladder at rest | The intro «El escalafón del gremio: tu nivel sube con XP y cada rango cubre un tramo de niveles.» followed by the eras as headings with their level span: «El despertar» («Nv 1–12 · completa»), «Los portadores» («Nv 13–24»), «Los guardianes» («Nv 25–72») open, and «Los campeones», «Los ascendidos» and «La trascendencia» collapsed with their rank count (for example «Nv 73–141 · 9 rangos»). Each rank is one row: its pixel emblem (with a small roman badge I, II or III when the emblem is shared by a family), the rank name, a one-line description, the level band («Nv 1–3») and its state at the right. | `guild-rank-ladder` | FRD-09#U2 |
| Rank earned | The chip «Conseguido» with a check and the XP that unlocked it, for example «0 XP» for «Humano» and «Buscador del Alba I» through «Portador de Luz II». | `guild-rank-ladder` | FRD-09#U2 |
| Current rank | «Portador de Luz III» is highlighted with the chip «Estás aquí», its XP («2040 XP»), a gold progress bar and the line «Faltan 450 XP para Guardián del Juramento I». | `guild-rank-ladder` | FRD-09#U2 |
| Rank still locked | A lock icon with the level that unlocks it (for example «Nv 25») and the XP it needs («2860 XP»); the emblem is dimmed. State is the lock and the words, not colour alone. | `guild-rank-ladder` | FRD-09#U2 |
| Achievement notice raised | A gold-bordered card fixed at the bottom right, over the page: a trophy tile, an uppercase gold eyebrow, the trophy title «El primer ladrillo», its description «Creaste tu primer proyecto.», the action «Ver» (opens Logros) and a close button named «Cerrar aviso». The captured notice is the preview mode and its eyebrow reads «Vista previa del aviso»; a real unlock draws the same card with the label AC-09-008.2 names. | `guild-achievement-notice` | AC-09-008.2, FRD-09#U8 |

Behaviour with no picture (data rules, not layout): the guild level is derived from XP by a super-linear per-level curve and the rank is the band of levels that contains it, with bands widening toward the summit (FRD-09#U2); XP comes from verified results, never from activity or opening the app; the guild outcome is `MAX(live, ledger)` from the local gitignored ledger, so deleting a project never lowers the level (AC-09-006.1 to AC-09-006.3); durable XP and achievements count a result once, from the server-side oracle, whatever runtime reported it (AC-09-007). The notice appears only for a trophy flagged new or unlocked in the last 7 days, once per browser, and closes by itself after 9 seconds (AC-09-008.2).

## Components used

From `docs/design/components.md`. Nothing new is introduced by this FRD.

| On screen | Component | Notes |
|---|---|---|
| Sidebar guild card | `GuildCard` | crest, rank, XP line, gold bar; link to Logros; crest only on the rails |
| Rank rows | `RankRow` | emblem on the left, level band, state at the right |
| Era headings and groups | `EraGroup` | open up to the era after the current one; collapsed when further beyond the current rank |
| Rank state chips | `Chip` family | «Conseguido» (green, with check), «Estás aquí» (gold); lock icon for locked |
| Gold achievement notice | `AchievementToast` | trophy tile, eyebrow, title, description, «Ver», «Cerrar aviso» |
| Rank emblems | `Avatar` pixel-art emblem set | one emblem per rank family, roman badge for I, II and III |

## Interaction & flow

- The guild card is always present in the shell and links to Logros (`guild-rank-ladder`).
- The rank ladder is read-only: eras collapse and expand; no control changes the level or the XP (`guild-rank-ladder`).
- The notice appears over the page on first load in a browser when a trophy is new. «Ver» opens Logros and closes the notice; «Cerrar aviso» closes it; left alone it closes after 9 seconds. It never blocks the page and never repeats in the same browser (`guild-achievement-notice`).
- No other celebration exists in v2.

## Responsive & accessibility

- Expanded sidebar at 1280; at tablet width (768) the sidebar is a rail and the card is the crest alone; on phones the guild card is reached through the drawer and Logros (`guild-achievement-notice` at 375, 768 and 1280).
- The notice sits at the bottom right on desktop and tablet; on phones it rises above the bottom navigation and is as wide as the viewport allows (`guild-achievement-notice` at 375).
- The notice is a polite status region, its close button has the accessible name «Cerrar aviso», and focus is not taken from the page. The notice is dismissible by keyboard.
- Rank state is conveyed by words and icons («Conseguido» with a check, «Estás aquí», a lock), never by colour or dimming alone. Gold is used for progress and the notice only.
- Text on the dark and light themes meets AA contrast; the notice and the ladder use the same tokens in both themes. Motion is limited to transforms and respects `prefers-reduced-motion`.

## Copy

Interface strings are the Spanish ones in the states above and in `docs/design/microcopy.es.json`. Rank names and descriptions are owner-authored game copy (Final Fantasy tone). The trophy title and description in the notice come from the trophy data.

## Fidelity references

Build against `docs/design/fidelity-checklist.md` (its `## Fidelity target` is the bar; its *How to verify* is the gate): the component catalogue (`docs/design/prototype/components.html`), measured styles (`docs/design/prototype/reference/computed-styles.json`), the exported icons and logo (`docs/design/prototype/{icons,logo}/`), the copy file and the whole-app prototype for states and motion.

prototype_blessed_at: 409a0564

- **Mock:** `docs/frds/frd-09-gamification/mocks/gamification.html` (sections `guild-achievement-notice`, `guild-rank-ladder`).
- **Mock screenshots** in `mocks/screenshots/`: `<id>-<width>-<theme>.jpg` at 375, 768 and 1280, light and dark.
- **Binding comparison URLs:** `docs/design/prototype/index.html?demo=off&host=page&theme=<theme>&achievement=preview#inicio` for the notice and `…#logros?tab=Rangos` for the ladder.
- **Oracle entries** (`docs/design/freeze/fidelity.config.json`, `states["frd-09-gamification"]`): `guild-achievement-notice`, `guild-rank-ladder`.
- **Reference files:** root `DESIGN.md`, `docs/design/design-tokens.json`, `docs/design/freeze/m1-decisions.md`, `docs/design/freeze/reconciliation.md` (C-12, B-18), `docs/design/prototype/prototype.css` (`.ach-toast`, `.guildcard`, `.rank`).
- **components.md rows:** `GuildCard`, `RankRow` / `EraGroup`, `AchievementToast`, `Chip` family.

`logros-mobile` first blessed 2026-10-31 at the FRD-13 recheck, viewed at 390 against `docs/design/prototype/index.html#logros`. Reviewer sign-off: hero, Casi lo tienes, sellos, rango, trofeos and the radar are present, no console error; the bottom bar mid-image is a full-page capture effect. Consistency only; the next oracle pass judges fidelity.

prototype_blessed_at: 0e6b7191
