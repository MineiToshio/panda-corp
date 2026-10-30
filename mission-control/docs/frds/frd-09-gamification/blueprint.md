---
id: BP-09
type: blueprint
slug: gamification
title: 'Blueprint — FRD-09 Gamification (v2 «Órbita»: guild card, notice, honest engine)'
status: ACTIVE
parent: FRD-09
implementation_status: VERIFIED
readiness_gate: passed 2026-10-22
grounding_gate: passed 2026-10-22
consistency_gate: passed 2026-10-22
last_updated: 2026-10-22
---

# Blueprint — FRD-09 Gamification (v2 «Órbita»: guild card, notice, honest engine)

> Source-of-truth hierarchy: `FRD > FDD > design-tokens > blueprint > work order`.
> Per-feature blueprint (DR-049). The platform is
> [`docs/product/architecture.md`](../../product/architecture.md) (§6 read interfaces, §7 read-only
> invariant: the guild ledger is the bounded write 5, ADR-0005); the visual system and copy are FRD-13's,
> the shell that hosts the guild card and the notice is FRD-19's
> ([blueprint](../frd-19-app-shell/blueprint.md)).

## Purpose

The honest game layer over real work. In v2 it is: the pure guild XP / level engine and the 40-rung rank
ladder (built, kept), the single guild-state resolver with the `MAX(live, ledger)` floor and its
gitignored ledger (built, kept), and two surfaces the Órbita prototype draws in the shell: the sidebar
guild card and the gold achievement notice. The scaled celebrations (work-order toast, phase animation,
release and level-up moments), the agent XP engine and the top-bar guild block are out of v2 and are
removed. FRD-09 has **no new work order**: its two drawn surfaces are folded into FRD-19's WO-19-003
(each alone would be under 20 minutes, DR-100), and its kept engine and ledger WOs stay live as built.

## Requirement map

FRD-09 states most rules as unnumbered bullets. This blueprint names them by position, as the FDD does:
FRD-09#U1 (sidebar guild card shows level and XP), #U2 (40-rung ladder, granular level and rank band,
emblems), #U3 (RPG vocabulary with restraint), #U4 (XP by result only), #U5 to #U7 (scaled, release and
level-up celebrations, **Out of v2**), #U8 (the notice is dismissible and closes by itself), #U9 (no
leaderboards, lives, daily-reset streaks or false urgency; weekly streak), #U10 (complements good UX).
The numbered groups are REQ-09-006 (AC-09-006.1..3, ledger), REQ-09-007 (runtime-neutral result ledger,
unnumbered bullets) and REQ-09-008 (AC-09-008.1..2, guild card and notice).

## Components & Interfaces

| ID | Kind | Name / location | Responsibility | Traces | Built by |
|---|---|---|---|---|---|
| IF-09-guild-xp | pure module | `src/lib/gamification/gamification.ts` (`computeGuildLevel`, `RANKS`, `xpForLevel`, `levelForXp`, `rankForLevel`) | Level from XP (super-linear curve), rank as the level band, XP from verifiable outcomes only, weekly streak only | #U1, #U2, #U4, #U9 | WO-09-001 (kept) |
| IF-09-guild-state | resolver | `src/lib/gamification/guildState.ts` (`getGuildState()`, request-cached) | THE single source of the displayed level: live outcomes, ledger-merged outcomes, level; every surface reads it | #U1, REQ-09-006 | WO-09-006 (kept) |
| IF-09-ledger | module + Server Action | `src/lib/gamification/ledger.ts`, `src/app/_actions/snapshotLedger.ts`, `GamificationLedgerSync` | `MAX(live, ledger)` floor, snapshot-on-exceed, gitignored file, schema v2 runtime-neutral fact keys (R9) | REQ-09-006, REQ-09-007 | WO-09-006 (kept) |
| CMP-09-rank-emblem | component | `src/components/core/RankEmblem/RankEmblem.tsx` | Pixel emblem per rank family with the I·II·III badge | #U2 | kept (v1); consumed by FRD-10 WO-10-016 |
| CMP-09-guild-card | component | `GuildCard` (`src/components/modules/GuildBar/GuildCard.tsx`) | Crest with the level, rank name, «N / M XP al nivel L», gold bar, link to Logros; crest only on the rails | REQ-09-008 (AC-09-008.1), #U1 | WO-19-003 (FRD-19) |
| CMP-09-achievement-notice | component | `AchievementToast` (`src/components/modules/AchievementToast/`) | Gold notice for a trophy new or unlocked within 7 days, once per browser, «Ver» and «Cerrar aviso», closes after 9 s, polite status | REQ-09-008 (AC-09-008.2), #U8 | WO-19-003 (FRD-19) |
| (FRD-10) | surface | Logros hero, Rangos tab (`RankRow`, `EraGroup`) | The rank ladder screen of FDD-09 (`guild-rank-ladder`) and the guild hero | #U2 | WO-10-016 (FRD-10) |

Removed in v2 (map §6.C items 2, 3, 16): `IF-09-agent-xp` (`agents.ts`, agent levels), `IF-09-celebration`
(`classifyCelebration` and its tier types), `CMP-09-celebration` (`CelebrationSurface`,
`CelebrationWatcher`), `CMP-09-xp-bar` (`XpBar`) and `CMP-09-guild-bar` (the top-bar block). Removal
owners: WO-19-002 (unmount, `CelebrationWatcher`), WO-07-006 (agent levels in Configuración), WO-13-013
(file deletions).

### Traceability

| Requirement | Component(s) | Work order |
|---|---|---|
| #U1 guild level and XP in the sidebar | IF-09-guild-xp, IF-09-guild-state, CMP-09-guild-card | WO-09-001, WO-09-006, WO-19-003 |
| #U2 rank ladder, emblems | IF-09-guild-xp, CMP-09-rank-emblem, FRD-10's Rangos tab | WO-09-001, WO-10-016 |
| #U3 RPG vocabulary with restraint | copy catalogue through FRD-13's `t()`; every guild surface | WO-13-010 and the surface WOs |
| #U4 XP by result | IF-09-guild-xp | WO-09-001 |
| #U5..#U7 celebrations | Out of v2 (removed) | WO-19-002, WO-13-013 |
| #U8 notice dismissible and self-closing | CMP-09-achievement-notice | WO-19-003 |
| #U9 forbidden patterns, weekly streak | IF-09-guild-xp (negative tests), all guild surfaces | WO-09-001, WO-19-003, WO-10-016 |
| #U10 complements good UX | cross-cutting (FRD-13 legibility rules) | — |
| REQ-09-006 (AC-09-006.1..3) | IF-09-ledger, IF-09-guild-state | WO-09-006 |
| REQ-09-007 runtime-neutral ledger | IF-09-ledger | WO-09-006 (kept, as built) |
| REQ-09-008 (AC-09-008.1, AC-09-008.2) | CMP-09-guild-card, CMP-09-achievement-notice | WO-19-003 |

## Contracts

- **Guild state (IF-09-guild-state).** `getGuildState()` → `{ statuses, eventsSnapshot, liveOutcomes,
  outcomes, level }`, cached per request; `level` = `{ level, rankIndex, title, grade, sprite, xp, next,
  pctToNext }` from IF-09-guild-xp over the ledger-merged outcomes. The guild card's line «N / M XP al
  nivel L» is N = XP above the current level's threshold, M = the current level's span (both from
  `xpForLevel`), L = level + 1. No outcomes → honest zero (no fake fill, #U9). No surface re-derives the
  level.
- **Ledger (IF-09-ledger).** Unchanged in v2: sole writer `snapshotGamificationLedger` (Server Action,
  fire-and-forget, never blocks the render), gitignored `factory/gamification-ledger.json`, refuses
  symlinks, fails closed on corrupt data; it adopts WO-01-010's clock in WO-01-011 (no behaviour change).
- **Achievement notice.** Input: the newest trophy the FRD-10 achievements reader flags new or unlocked
  within 7 days of `now()`, and the browser-local `orbita-ach-seen` list. Output: one polite status card;
  closing by «Ver», «Cerrar aviso» or the 9-second timer records the id; never raised twice in a
  browser; no factory write. The prototype's `?achievement=preview` affordance is not built (no AC asks
  for it and its label is not in the catalogue); the oracle state uses the recipe's fallback.

## Visual spec

| Surface | Mocks and oracle states | Built by |
|---|---|---|
| Guild card (sidebar, rails) | `mocks/gamification.html#guild-rank-ladder` (expanded card), `#guild-achievement-notice` (tablet crest); FRD-19 `app-shell.html#shell-expanded`, `#shell-rail-collapsed` | WO-19-003 |
| Achievement notice | `mocks/gamification.html#guild-achievement-notice` (375, 768, 1280) | WO-19-003 |
| Rank ladder (Logros › Rangos) | `mocks/gamification.html#guild-rank-ladder` | WO-10-016 (FRD-10) |

Assets: rank emblems `public/ranks/*.png` (original bytes, staged by WO-13-010), `trophy` icon.

## Dependencies & Risks

- Upstream: FRD-01 readers (WO-01-005), FRD-06/12 events reader (WO-06-012), FRD-05 work-order reader;
  FRD-13 (tokens, `t()`, primitives), FRD-19 (the shell that hosts the card and the notice), FRD-10
  (achievements reader with `isNew`).
- Downstream: FRD-10 (Logros hero and Rangos), FRD-18 (Inicio Gremio tile) read IF-09-guild-state.
- Risk: removing the top-bar `GuildBar`, `CelebrationSurface`, `XpBar` and `agents.ts` while the FRD-09
  reviewer integration suite still imports them; mitigated by deleting them only in WO-13-013 (W7), which
  removes that suite with them (map §3.3 rule 3).
- Risk: the notice's eyebrow «¡Nuevo logro!» is drawn in no captured state (the oracle captured the
  preview label); reported to design (DR-130) through the architecture ledger.
- Ethical gate (FRD-09 principles) unchanged: every mechanic keeps its negative tests (no XP for
  activity, no stuck bar, no daily streak, no leaderboard, no false urgency).

## Build Plan

| WO | Depends on | Artifacts (globs) | Foundation | Parallel with |
|---|---|---|---|---|
| WO-09-001 | WO-01-005, WO-06-012 | `src/lib/gamification/gamification.ts`, `src/lib/gamification/_tests/gamification.guild.test.ts` | false | W3 · kept live, built (no rebuild); v2 W3 WOs write other files |
| WO-09-006 | WO-09-001 | `src/lib/gamification/ledger.ts`, `src/lib/gamification/guildState.ts`, `src/lib/gamification/_tests/ledger.test.ts`, `src/lib/gamification/_tests/guildState.test.ts`, `src/app/_actions/snapshotLedger.ts`, `src/app/_tests/wo-09-006-snapshotLedger.test.ts`, `src/components/dashboard/GamificationLedgerSync/**` | false | W4 · kept live, built (no rebuild); v2 W4 WOs write other files |

- Both rows are legacy work orders kept live (`implementation_status: VERIFIED`); the engine does not
  rebuild them. Their waves come from their own `dependsOn`.
- FRD-09's acceptance criteria AC-09-008.1 and AC-09-008.2 are owned by FRD-19's **WO-19-003** (W6);
  FRD-09's gate re-checks the kept WOs and those cross-FRD owners.
- Later writers of the same files, serialized by wave: WO-01-011 (W5: `ledger.ts`, `snapshotLedger.ts`
  adopt the clock seam), WO-13-013 (W7: `gamification.ts` loses `classifyCelebration`; `agents.ts` and
  the obsolete tests go).

## Work Orders

Live: WO-09-001 (kept), WO-09-006 (kept). Cross-FRD owner: WO-19-003. Index:
[`work-orders/README.md`](work-orders/README.md).

## Reconciliation (2026-10-22, binding)

- Kept-live legacy work orders whose `status` is DRAFT (WO-09-001, WO-09-006) stay DRAFT: the blueprint's
  DRAFT → ACTIVE flip activates them (author brief; map §0.5.1's "keep ACTIVE" applies to those already ACTIVE).
- `CMP-09-guild-card` and `CMP-09-achievement-notice` are built by WO-19-003; the notice and Inicio's «Nuevo»
  chip share one predicate, `lastAchievement().fresh` (WO-18-002). The real-unlock notice is captured as FRD-19's
  `shell-achievement-notice`; this FRD's `guild-achievement-notice` (preview mode) keeps the recipe fallback.
- The top-bar `GuildBar`, `CelebrationSurface` and `classifyCelebration` stay on disk (unmounted) until WO-13-013
  (W7) because other FRDs' reviewer suites import them (map §0.3 / §3.3 rule confirmed for every author).

## Superseded (v1 history)

- WO-09-002 agent XP / level engine → WO-07-006 (agent levels leave Configuración), WO-13-013 (`agents.ts` deleted)
- WO-09-003 guild surfaces (GuildBar, GuildHero, StatRadar, CelebrationSurface) → WO-19-003, WO-10-016
- WO-09-005 celebration tier classifier → WO-19-002 (unmounted), WO-13-013 (deleted)
- WO-09-007 rank ladder surfaces → WO-10-016 (the ladder data stays in WO-09-001's module)

## Readiness check (DR-100)

Every FRD-09 requirement maps to a component above (the out-of-v2 bullets map to their removal); the
five live ACs are owned once (AC-09-006.1..3 by WO-09-006, AC-09-008.1..2 by WO-19-003); `dependsOn`
names live work orders only; no open clarification marker remains.
