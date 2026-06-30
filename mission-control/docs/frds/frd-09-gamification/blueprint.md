---
id: FRD-09-blueprint
type: blueprint
parent: FRD-09
status: ACTIVE
implementation_status: VERIFIED
last_updated: '2026-06-29'
---
# FRD-09 — Gamification (RPG theme) · feature blueprint

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> This is the **per-FRD blueprint** (DR-049). It references the
> **[platform architecture](../../product/architecture.md)** (the event contract §5, the `lib/events.ts`
> and `lib/status.ts` readers §6, the read-only invariant §1/§7, FRD-13 tokens §7). Read it first.

## 1. Feature summary

The **honest** RPG layer that wraps real work. It is **cross-cutting** (the top bar + shared
primitives), not a page. Two deliberate, non-interchangeable layers (FRD vocabulary):

- **Guild (gremio)** — the **meta** layer: the operator + the whole factory. Guild level/XP in the
  top bar, persistent across the app. (The Guild Hall lives in [FRD-10](../frd-10-achievements-hall/blueprint.md).)
- **Party** — the agents building **one** project (the live panel, FRD-06). One party per project.

The non-negotiable design constraint: **XP is earned by verifiable RESULT** (work order / phase /
release closed, green tests) — **never** by activity, app opens, or trivial volume. This avoids the
*overjustification effect* and keeps the layer ethical (FRD-09 principles). **Forbidden:**
leaderboards, lives/death, daily streaks with reset, false urgency/timers. Streaks are **weekly**
with a "freeze". Celebrations **scale**: toast (WO) → animation (phase) → celebration (release) →
level-up. Animation honors `prefers-reduced-motion` (FRD-13).

This blueprint owns the **XP engine** (the pure derivation of guild XP/level and agent XP/level from
real outcomes), which FRD-07 (agent levels) and FRD-10 (the Hall) consume. There is one engine.

## 2. Where XP comes from (the honesty contract)

XP is **derived** from real, verifiable factory outcomes read via the platform readers — it is never
stored as a mutable counter the app increments on interaction:

| Outcome (verifiable) | Source | Reader |
|---|---|---|
| Work order closed (green) | `.pandacorp/status.yaml` `work_orders_done`; event `achievement`/`test_ok` + `work_order` | `lib/status.ts` (FRD-01), `lib/events.ts` (FRD-06/12) |
| Phase completed | `status.yaml` `phase` transitions | `lib/status.ts` |
| Release / launch | `phase: release` reached (DR-085: the launched/terminal phase) | `lib/status.ts`, `portfolio` |
| Green tests | event `test_ok` | `lib/events.ts` |
| Agent did a work order | event with `agent` + `work_order` + `status: ok` | `lib/events.ts` |

The XP→level mapping is a **pure function** of these counts (no time-decay, no engagement bonus, no
opening-the-app reward). With no data it reports honestly (level/XP from whatever real outcomes
exist, or zero) — **never a bar stuck at 80%** and never fake progress (FRD-09 forbidden patterns).

> **No new `lib/` module.** The XP engine is a pure module `lib/gamification.ts` over the EXISTING
> readers (`status`, `events`). It is **flagged** as a new file in §7 (architecture §6 maps FRD-09 to
> `events`+`status` but does not name a derivation module).

## 3. Components & interfaces

### Interfaces (`lib/gamification.ts`, NEW pure module — §7)
- **`IF-09-guild-xp`** — `computeGuildLevel(outcomes): { level, rankIndex, title, titleEn?, icon?, sprite?, grade?, xp, next, pctToNext }`. Derives the **granular level** from XP and the **rank** as the level band that contains it (see *Rank ladder*, §3a). `level` is the granular level; `next`/`pctToNext` target the **next level** (the bar fills toward the next level); `rankIndex`/`title`/`grade`/`sprite` describe the current rank band. Pure, fixture-tested. → top-bar AC.
- **`IF-09-guild-state`** (`lib/gamification/guildState.ts`) — **THE single source of truth for the displayed guild level.** `getGuildState(): { statuses, eventsSnapshot, outcomes, level }` reads the live data layers once (`readPortfolio` → `readStatus(resolveProjectPath(path))` → `readEvents`), derives the outcomes and the level, and is wrapped in React `cache()` so every consumer in a request gets the identical object. **Every surface that shows the guild level MUST read it from here** — the GuildBar (`app/layout.tsx`), the Inicio dashboard (`app/page.tsx`) and the Logros hero (`app/achievements/page.tsx`) — instead of each re-deriving `deriveGuildOutcomes` + `computeGuildLevel`. (Three independent derivations is exactly how the header once showed NV3 while Logros showed NV1 — one passed an unresolved portfolio path to `readStatus`.) The uncached core `readGuildState()` is exported for tests. This is also the one place a future ledger merge — `MAX(live, ledger)`, §5 / WO-09-006 — must live so the floor applies everywhere at once.
- **`IF-09-agent-xp`** — `computeAgentLevel(agentId, events): { level, title, xp, next, pctToNext }`. Title ladder Apprentice → Engineer → Senior → Architect (FRD-07 AC). XP only from that agent's closed work orders. Consumed by **FRD-07** (agent section/detail). Pure, fixture-tested.
- **`IF-09-celebration`** — `classifyCelebration(event): "toast" | "phase" | "release" | "levelup" | "none"`. Maps an outcome to the celebration tier so it scales (never flat). Pure.

### §3a. Rank ladder — granular level + rank-by-band (reconciled from code, 2026-06-25)

> *Reconciled from code by `/pandacorp:sync` on 2026-06-25 — describes the shipped rank system (owner-authored, phases 1–6), not a forward plan. Supersedes the earlier 3-rung "Aprendiz → Maestro del gremio" ladder.*

The guild climbs a **40-rung ladder** (Final Fantasy tone). The level and the rank are **two distinct axes** (decision 2026-06-25 — they are NOT 1:1):

- **Level (granular).** `xpForLevel(level)` is a super-linear curve (rounded to 5) so each level costs more than the last; `levelForXp(xp)` inverts it. The level keeps climbing with XP, unbounded.
- **Rank (a band of levels).** The 40 ranks are `RANK_DEFS` (Spanish + English names + a Tabler fallback icon). `rankBandSize(i) = 3 + ⌊i/4⌋` widens the bands toward the summit; `RANK_MIN_LEVEL[i]` is the cumulative entry level; `rankForLevel(level)` returns the last rank whose `minLevel ≤ level`. So higher ranks take more levels to earn, and the top (**Portador del Juramento Eterno**) starts at ~Nv 289 — deliberately far.
- **Families & grades.** Most ranks come in three grades **I·II·III** (`grade ∈ {1,2,3}`, `0` for Humano + the 6 standalone summits). `RANKS` is the single exported source: `Rank = { title, titleEn, icon, sprite, minLevel, grade }`.
- **Custom emblems.** Each family has a **pixel-art emblem** at `public/ranks/<slug>.png`; `RANK_SPRITES[40]` maps each rank to its family slug (18 sprites = 11 families × shared + 6 summits + Humano). The Tabler `icon` remains the graceful fallback when a sprite is missing.

This ladder is consumed by the GuildBar (header), the GuildHero (hero), and the **Rangos tab** (FRD-10 `RankLadder`).

### Components
- **`CMP-09-guild-bar`** — the top-bar Guild level/XP block (level pill `NV {n}`, the **rank emblem + name**, XP bar to next level). Consumes `IF-09-guild-xp` and renders `CMP-09-rank-emblem` (18px). Cross-cutting (in `AppShell`/`app/layout.tsx`). → AC "top bar guild level/XP". Uses the rationed accent on the XP bar (FRD-13); number with `tabular-nums`.
- **`CMP-09-rank-emblem`** (`components/core/RankEmblem/RankEmblem.tsx`) — the rank's self-framed pixel-art medal: renders `/ranks/<sprite>.png` at a fixed square `size`, falls back to the rank's Tabler `icon` when the sprite is absent, and overlays a small **roman-numeral badge** (I·II·III) when `grade ∈ {1,2,3}` so the three grades of a shared family emblem are distinguishable. Reused by `CMP-09-guild-bar` (18px), `CMP-09-guild-hero` (32px) and FRD-10's `RankLadder` (88/104/124px). → AC "custom pixel-art emblem per rank".
- **`CMP-09-xp-bar`** — reusable honest XP bar primitive (label + bar + "faltan N para Nv X · <next title>"). Reused by `CMP-09-guild-bar`, FRD-07 agent detail, FRD-10. Never renders fake fill. → AC "bar to next level".
- **`CMP-09-celebration`** (`"use client"`) — the scaling celebration surface: toast → animation → celebration → level-up moment, driven by `IF-09-celebration` over new events. Honors `prefers-reduced-motion` (no animation), `transform`/`opacity` only, <300ms (FRD-13). → AC "celebration scales".
- **`CMP-09-rpg-vocab`** — the shared RPG copy/flavor helpers (missions, objectives, party, guild) applied with restraint, Spanish. → AC "RPG flavor with restraint".
- **`CMP-09-avatar`** — the pixel-art (FF-style) agent avatar component (used here and by FRD-07/10). Static sprite assets; degrades gracefully if a sprite is missing. → FRD-07 avatar AC dependency.

### Reused
- `lib/events.ts` (FRD-06/12), `lib/status.ts` (FRD-01) — readers; FRD-09 adds NO new reader.
- FRD-13 tokens, `tabular-nums`, motion rules, `prefers-reduced-motion`.

## 4. Ethical gate (build-time requirement, from FRD-09)

EVERY mechanic in this feature SHALL pass the FRD-09 ethical test before shipping: user controls
participation? builds vs undermines intrinsic motivation? meaningful vs addictive loop? honest about
its effect? The work orders encode this as **negative acceptance criteria** (tests that the
forbidden patterns are ABSENT): no leaderboard, no lives/death, no daily-reset streak, no
false-urgency timer, no XP for activity/app-open, no bar artificially stuck.

## 5. Read-only & security posture
All XP is **derived** from read-only sources (architecture §7). No personal data beyond the local
factory repo. The celebration is purely client-side visual over already-read events.

**Controlled exception — gamification ledger (WO-09-006):** `factory/gamification-ledger.json`
(gitignored) is a local write: it persists the maximum outcomes ever seen so that deleting a project
never decreases the guild's XP. The write is a fire-and-forget Server Action (does NOT block the
render) called by a lightweight client component after page mount. This is the ONLY write in
FRD-09; it is personal data (DR-033) and must stay gitignored.

## 6. Traceability (REQ → AC → CMP/IF)

FRD-09 states EARS bullets (no explicit `REQ-09-MMM` ids). Work orders assign `AC-09-MMM.K`.

| FRD-09 EARS bullet | Component(s) / Interface(s) |
|---|---|
| Top bar shows guild level/XP (operator) + title + bar to next | `CMP-09-guild-bar`, `CMP-09-xp-bar`, `IF-09-guild-xp` |
| 40-rung rank ladder; level=granular, rank=band of levels; custom emblem + I·II·III badge per rank | `IF-09-guild-xp` (§3a `RANKS`/`rankForLevel`/`xpForLevel`), `CMP-09-rank-emblem` |
| RPG vocabulary & accents with restraint, legibility first | `CMP-09-rpg-vocab` (+ FRD-13) |
| XP earned by RESULT (WO/phase/release closed), not activity/app-open | `IF-09-guild-xp`, `IF-09-agent-xp` (§2 honesty contract) |
| Celebration SCALES (toast → phase → release → level-up), never flat | `CMP-09-celebration`, `IF-09-celebration` |
| NO leaderboards / lives / daily-reset streaks / false urgency; streaks weekly + freeze | negative ACs across all WOs; `IF-09-guild-xp` (weekly streak) |
| Gamification complements good UX, not compensates for bad | cross-cutting; all WOs subordinate to FRD-13 legibility |
| White-Hat Octalysis; every achievement maps to a verifiable result; ethical test | §2 + §4 ethical gate (negative ACs) |
| Agent levels (Apprentice→Architect) — used by FRD-07 | `IF-09-agent-xp`, `CMP-09-avatar` |

## 7. New `lib/` module (flagged)
`lib/gamification.ts` — pure XP/level/celebration derivation over the existing `events`/`status`
readers. Not separately named in architecture §6 (which maps FRD-09 to `events`+`status`); recorded
here as the single new file. No new fs/parse access — it consumes already-typed reader output.

## Build Plan (Phase 2)

Phase 2 re-anchors the **presentational** Guild surfaces to the owner-approved prototype
(`docs/design/prototype/index.html`); the XP/celebration engine is already correct.

**State:**
- **VERIFIED (do not rebuild):** WO-09-001 (guild XP engine), WO-09-002 (agent XP engine),
  WO-09-005 (celebration-tier classifier) — the pure `lib/gamification.ts` module, verified.
- **PLANNED (Phase 2 UI):** WO-09-003 — the single coarse Guild-surfaces work order
  (`GuildBar` + `GuildHero` + `StatRadar` + `CelebrationSurface`, reusing `Shield`/`XpBar`/`Avatar`).
- **PLANNED (Phase 3 — persistence):** WO-09-006 — gamification ledger (`lib/gamification/ledger.ts`
  + `app/_actions/snapshotLedger.ts` + `GamificationLedgerSync` client component). Independent of
  WO-09-003; can build in parallel or after.

**Coarse DAG & parallelism:**

```
[VERIFIED engine: WO-09-001 · WO-09-002 · WO-09-005]   [FRD-13 foundation: WO-13-006/007/008]
                 └───────────────────────────┬───────────────────────────┘
                                             ▼
                             WO-09-003 (Guild surfaces — UI)

[VERIFIED engine: WO-09-001]
          └─── WO-09-006 (ledger persistence — independent of WO-09-003)
```

WO-09-003 is a single sequential UI WO with no intra-FRD UI peer (nothing to parallelize within
FRD-09). It starts once the foundation primitives and the verified engine exist.

**Disjoint artifacts (shared-route coordination with FRD-10):** the achievements route
(`src/app/achievements/`) is **shared** — FRD-09 owns the **hero block in `page.tsx`**,
`components/modules/GuildBar/**`, and `app/achievements/StatsPanel.tsx` (the radar); FRD-10 owns the
chains/trophies/almost-there files (`ChainCard/`, `UniquesSection/`, `AlmostThere.tsx`,
`SecretsPanel.tsx`). The two FRDs must not both claim the same file; `page.tsx` is the one shared
composition point and is owned for its hero region by this WO.

**Cross-FRD deps:** `frd-13` (foundation primitives `PageTitle`/`Shield`/`XpBar`/`Avatar`/
`CelebrationSurface`, tokens, motion, `tabular-nums`); shared achievements route with `frd-10`.
</content>
