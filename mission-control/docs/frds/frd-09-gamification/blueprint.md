---
id: FRD-09-blueprint
type: blueprint
parent: FRD-09
status: ACTIVE
implementation_status: PLANNED
last_updated: '2026-06-16'
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
| Release / launch | `phase: operation` reached | `lib/status.ts`, `portfolio` |
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
- **`IF-09-guild-xp`** — `computeGuildLevel(outcomes): { level, title, xp, next, pctToNext }`. Title from the rank ladder (Aprendiz → … → Maestro del gremio → …, see prototype `RANKS`). Pure, fixture-tested. → top-bar AC.
- **`IF-09-agent-xp`** — `computeAgentLevel(agentId, events): { level, title, xp, next, pctToNext }`. Title ladder Apprentice → Engineer → Senior → Architect (FRD-07 AC). XP only from that agent's closed work orders. Consumed by **FRD-07** (agent section/detail). Pure, fixture-tested.
- **`IF-09-celebration`** — `classifyCelebration(event): "toast" | "phase" | "release" | "levelup" | "none"`. Maps an outcome to the celebration tier so it scales (never flat). Pure.

### Components
- **`CMP-09-guild-bar`** — the top-bar Guild level/XP block (level, title, XP bar to next). Consumes `IF-09-guild-xp`. Cross-cutting (in `app/layout.tsx`). → AC "top bar guild level/XP". Uses the rationed accent on the XP bar (FRD-13); number with `tabular-nums`.
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
All XP is **derived** from read-only sources (architecture §7); nothing is written. No personal data
beyond the local factory repo. The celebration is purely client-side visual over already-read events.

## 6. Traceability (REQ → AC → CMP/IF)

FRD-09 states EARS bullets (no explicit `REQ-09-MMM` ids). Work orders assign `AC-09-MMM.K`.

| FRD-09 EARS bullet | Component(s) / Interface(s) |
|---|---|
| Top bar shows guild level/XP (operator) + title + bar to next | `CMP-09-guild-bar`, `CMP-09-xp-bar`, `IF-09-guild-xp` |
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
</content>
