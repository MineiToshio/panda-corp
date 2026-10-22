---
id: FRD-09
type: frd
title: FRD-09 — Gamification (RPG theme)
status: ACTIVE
implementation_status: VERIFIED
last_updated: '2026-10-22'
ui: true
visual_source: docs/design/prototype/index.html
visual_source_mocks: docs/frds/frd-09-gamification/mocks/gamification.html
---
# FRD-09 — Gamification (RPG theme)

The game layer that wraps the real work, in an **honest** and fatigue-free way. Guiding principle: represent real work in more interesting clothes; the factory **is** a campaign and the agents **are** a party.

> **Design freeze amendment (2026-10-22, S2.2).** The approved Órbita prototype is the oracle. The guild level moves from a top bar to a sidebar guild card, and the celebration moments the prototype does not draw are out of v2 (owner decision 2026-10-21, prefixed **Out of v2**, original text kept). Prototype-drawn behaviours are AC-09-008.1 and AC-09-008.2. Source: `docs/design/freeze/reconciliation.md` (C-12, B-18).

## Vocabulary: Guild (gremio) vs Party — don't confuse them

Two **distinct and deliberate** RPG layers; each term names a single thing:

- **Guild (gremio)** — the **meta** layer: the operator (the owner) + the entire factory. Guild level/XP in the sidebar guild card (the rank name is the title), Logros (trophies and stats), Documentación, Guild Commands, Guild Attributes. It is **persistent and cross-cutting** across the whole app.
- **Party** — the **group of agents building a concrete project** (La Fragua, [FRD-06](../frd-06-party/frd.md)). There is **one party per project** being built.

Analogy: you belong to a **guild** (the organization) and you go out in a **party** (the active group for each mission); a guild has many parties. **Rule:** don't use "guild" to name the agent panel, nor "party" for the operator layer.

## Acceptance criteria (EARS)
- The sidebar guild card (AC-09-008.1) SHALL show the **guild's level and XP** (operator), with the rank name as its title and a bar to the next level.
- The guild rank SHALL climb a **40-rung RPG ladder** (Final Fantasy tone, owner-authored 2026-06-25): **the level is GRANULAR and the rank is a BAND of levels** (the rank is NOT 1:1 with the level — decision 2026-06-25, owner) — Humano (Nv 1–3) → Buscador del Alba I–III → Portador de Luz I–III → Guardián del Juramento I–III → Guardián de Glifos I–III → Guardián del Éter I–III → Portador de Esquirla I–III → Caballero Radiante I–III → Invocador de Reinos I–III → Heraldo del Alba I–III → Señor de Tormentas I–III → Ascendente I–III → Ascendente del Fénix → Señor del Leviatán → Señor Dragón Carmesí → Guardián Celestial → Soberano del Alba → **Portador del Juramento Eterno (Nv ~289+)**. The **level** is derived from XP via a super-linear per-level curve (`xpForLevel`/`levelForXp` — each level costs more than the last, so leveling gets harder as you climb); the **rank** is the level band that contains the current level (`rankForLevel`), and the bands **widen toward the summit** (`rankBandSize`) so the higher ranks take more levels to earn. Each rank carries a **custom pixel-art emblem** (`/ranks/<family>.png` via `RankEmblem`; one emblem per I·II·III family + the 6 standalone tops + Humano = 18 sprites; the Tabler icon remains a fallback), and within a shared family emblem the **sub-grade I·II·III is distinguished by a small roman-numeral badge** (`RankEmblem grade`). The emblem + grade are shown as the crest of the sidebar guild card, beside the rank name in the Logros hero, and in the Rangos tab. The ladder is the single source `RANKS` in `lib/gamification/gamification.ts`, each rank carrying its `minLevel` (band entry) + `grade`.
- The vocabulary and visual accents SHALL have RPG flavor with **restraint** (missions, objectives, party, guild; pixel touches), **without sacrificing the legibility** of the data.
- The gamification SHALL represent **real work**: XP is earned by **result** (work order/phase/release closed), **not** by volume of trivial tasks nor by opening the app.
- **Out of v2 (owner decision 2026-10-21):** The celebration SHALL **scale**: small toast (work order) → medium animation (phase) → celebration (release) → **level-up** moment. Never a flat celebration on every action. In v2 the only celebration is the gold achievement notice (AC-09-008.2), the first rung.
- **Out of v2 (owner decision 2026-10-21):** WHEN a product **ships** (the release milestone is met) THE system SHALL fire the **release celebration AUTOMATICALLY** (triggered by the milestone, e.g. `/pandacorp:release` completing), NOT via a button the owner presses.
- **Out of v2 (owner decision 2026-10-21):** WHEN an agent or the guild **levels up** (an XP threshold is crossed) THE system SHALL fire the **level-up moment AUTOMATICALLY** on the milestone, NOT via a button.
- IF the achievement notice (AC-09-008.2) is shown THEN the owner SHALL be able to **dismiss** it ("Cerrar aviso"; it also closes by itself) (honest, fatigue-free — White-Hat): the trigger is automatic, but it never blocks or nags.
- The system SHALL NOT include: **leaderboards**, **lives/death**, **daily streaks with reset**, nor **false urgency/timers**. Streaks SHALL be **weekly** (with a "freeze").
- The gamification SHALL complement good UX, not compensate for bad UX (clear data comes first).

## Principles validated by research (2026, see `docs/proposals/06-improvement-plan-2026.md`)
- It SHALL live in the **"White Hat" of Octalysis** (Epic Meaning, Accomplishment/Progress, Empowerment + Feedback): the greatest intrinsic asset is **seeing the agents work live**; XP is a secondary confirmation layer, not the main hook.
- XP for activity (not for result) is **forbidden** so as not to trigger the *overjustification effect* (the extrinsic reward can destroy intrinsic motivation). Every achievement maps to a **verifiable** result (work order/phase/release closed, green tests).
- EVERY new mechanic SHALL pass the **ethical test** before being added: does the user control their participation? does it build or undermine intrinsic motivation? is the reward meaningful or an addictive loop? is it honest about its psychological effect? Forbidden patterns: streak anxiety, slot-machine-style variable rewards, false urgency, leaderboards, a bar "stuck at 80%".

## Components (see also)
- Guild level/XP (this FRD) · Agent levels (out of v2, [FRD-07](../frd-07-configuration/frd.md) REQ-07-011) · Achievements Hall and stats ([FRD-10](../frd-10-achievements-hall/frd.md)) · Party RPG ([FRD-06](../frd-06-party/frd.md)).

## Acceptance criteria — persistence (AC-09-006)
- **AC-09-006.1** — WHEN Mission Control computes guild outcomes THEN it SHALL read the local ledger (`factory/gamification-ledger.json`, gitignored) and use `MAX(live, ledger)` for each metric (workOrdersDone, phasesCompleted, releases) so that **deleting a project NEVER decreases the guild's XP or level**.
- **AC-09-006.2** — WHEN a live metric exceeds the stored ledger value THEN Mission Control SHALL update the ledger to record the new maximum (snapshot-on-exceed, fire-and-forget — does NOT block the render).
- **AC-09-006.3** — `factory/gamification-ledger.json` SHALL be gitignored (personal data, DR-033). It SHALL NOT be committed to the repo.

## Acceptance criteria — sidebar guild card and achievement notice (AC-09-008, added 2026-10-22, design freeze)

- **AC-09-008.1** — THE shell SHALL show, in the sidebar, a guild card with the crest carrying the guild level, the rank name, "N / M XP al nivel L", a gold progress bar and a link to Logros; on the collapsed rail (desktop 64 px, tablet 76 px) THE card SHALL be reduced to the crest.
- **AC-09-008.2** — WHEN a trophy is flagged new or was unlocked within the last 7 days, THE system SHALL raise the gold achievement notice ("¡Nuevo logro!") once per browser, with the actions "Ver" and "Cerrar aviso", and SHALL close it automatically after 9 seconds.

**Worked example (AC-09-008.2).** A trophy unlocked 2 days ago. The first time the owner opens Mission Control in this browser the gold notice appears with "Ver" (opens Logros) and "Cerrar aviso". Left alone it closes after 9 s. Reloading in the same browser does not raise it again. A trophy unlocked 9 days ago raises nothing.

## Future
Full-screen level-up moment; phase transitions as a "cutscene"; meta-achievements (titled, displayable Seals); XP multiplier for weekly streak.

## Runtime-neutral result ledger (AC-09-007)

- WHEN the same result is replayed through multiple runtime transports or vocabulary aliases THEN
  durable XP and achievements SHALL count it once by a monotonic oracle-derived fact key, independent
  of declared `event_id` or `run_id`.
- The existing gitignored ledger SHALL use schema v2, migrate valid v1 maxima without fabricating
  event history, write atomically through one Server Action, serialize concurrent reconciliation,
  refuse symlinks and fail closed without overwriting corrupt data.
- The writer SHALL derive totals and evidence from server-side canonical files; it SHALL ignore all
  aggregate values supplied by the client.
- A live/legacy event MAY render as telemetry, but SHALL NOT grant durable XP, agent attribution or an
  achievement until a WO/FRD/status/git/artifact oracle corroborates the result. Uncorroborated
  agent/role/mode/time fields SHALL be discarded when the durable fact is materialized.
