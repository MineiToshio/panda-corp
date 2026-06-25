---
id: FRD-09
type: frd
title: FRD-09 — Gamification (RPG theme)
status: ACTIVE
implementation_status: VERIFIED
last_updated: '2026-06-21'
ui: true
visual_source: docs/design/prototype/index.html
---
# FRD-09 — Gamification (RPG theme)

The game layer that wraps the real work, in an **honest** and fatigue-free way. Guiding principle: represent real work in more interesting clothes; the factory **is** a campaign and the agents **are** a party.

## Vocabulary: Guild (gremio) vs Party — don't confuse them

Two **distinct and deliberate** RPG layers; each term names a single thing:

- **Guild (gremio)** — the **meta** layer: the operator (the owner) + the entire factory. Guild level/XP in the top bar ("Guild Master"), Guild Hall (trophies and stats), Guild Codex/Manual, Guild Commands, Guild Attributes. It is **persistent and cross-cutting** across the whole app.
- **Party** — the **group of agents building a concrete project** (the live RPG panel, [FRD-06](../frd-06-party/frd.md)). There is **one party per project** being built.

Analogy: you belong to a **guild** (the organization) and you go out in a **party** (the active group for each mission); a guild has many parties. **Rule:** don't use "guild" to name the agent panel, nor "party" for the operator layer.

## Acceptance criteria (EARS)
- The top bar SHALL show the **guild's level and XP** (operator), with a title and a bar to the next level.
- The guild rank SHALL climb a **40-rung RPG ladder** (Final Fantasy tone, owner-authored 2026-06-25): the **level IS the rank** (one rank per level) — Humano (1) → Buscador del Alba I–III → Portador de Luz I–III → Guardián del Juramento I–III → Guardián de Glifos I–III → Guardián del Éter I–III → Portador de Esquirla I–III → Caballero Radiante I–III → Invocador de Reinos I–III → Heraldo del Alba I–III → Señor de Tormentas I–III → Ascendente I–III → Ascendente del Fénix → Señor del Leviatán → Señor Dragón Carmesí → Guardián Celestial → Soberano del Alba → **Portador del Juramento Eterno (40)**. Each rank carries a **custom pixel-art emblem** (`/ranks/<family>.png` via `RankEmblem`; one emblem per I·II·III family + the 6 standalone tops + Humano = 18 sprites; the Tabler icon remains a fallback) shown beside the rank name in the GuildBar (header), the GuildHero, and the Rangos tab. XP thresholds grow super-linearly so the top is deliberately far. The ladder is the single source `RANKS` in `lib/gamification/gamification.ts`.
- The vocabulary and visual accents SHALL have RPG flavor with **restraint** (missions, objectives, party, guild; pixel touches), **without sacrificing the legibility** of the data.
- The gamification SHALL represent **real work**: XP is earned by **result** (work order/phase/release closed), **not** by volume of trivial tasks nor by opening the app.
- The celebration SHALL **scale**: small toast (work order) → medium animation (phase) → celebration (release) → **level-up** moment. Never a flat celebration on every action.
- WHEN a product **ships** (the release milestone is met) THE system SHALL fire the **release celebration AUTOMATICALLY** (triggered by the milestone, e.g. `/pandacorp:release` completing), NOT via a button the owner presses.
- WHEN an agent or the guild **levels up** (an XP threshold is crossed) THE system SHALL fire the **level-up moment AUTOMATICALLY** on the milestone, NOT via a button.
- IF a celebration/level-up overlay is shown THEN the owner SHALL be able to **dismiss** it (honest, fatigue-free — White-Hat): the trigger is automatic, but it never blocks or nags.
- The system SHALL NOT include: **leaderboards**, **lives/death**, **daily streaks with reset**, nor **false urgency/timers**. Streaks SHALL be **weekly** (with a "freeze").
- The gamification SHALL complement good UX, not compensate for bad UX (clear data comes first).

## Principles validated by research (2026, see `docs/proposals/06-improvement-plan-2026.md`)
- It SHALL live in the **"White Hat" of Octalysis** (Epic Meaning, Accomplishment/Progress, Empowerment + Feedback): the greatest intrinsic asset is **seeing the agents work live**; XP is a secondary confirmation layer, not the main hook.
- XP for activity (not for result) is **forbidden** so as not to trigger the *overjustification effect* (the extrinsic reward can destroy intrinsic motivation). Every achievement maps to a **verifiable** result (work order/phase/release closed, green tests).
- EVERY new mechanic SHALL pass the **ethical test** before being added: does the user control their participation? does it build or undermine intrinsic motivation? is the reward meaningful or an addictive loop? is it honest about its psychological effect? Forbidden patterns: streak anxiety, slot-machine-style variable rewards, false urgency, leaderboards, a bar "stuck at 80%".

## Components (see also)
- Guild level/XP (this FRD) · Agent levels ([FRD-07](../frd-07-configuration/frd.md)) · Achievements Hall and stats ([FRD-10](../frd-10-achievements-hall/frd.md)) · Party RPG ([FRD-06](../frd-06-party/frd.md)).

## Acceptance criteria — persistence (AC-09-006)
- **AC-09-006.1** — WHEN Mission Control computes guild outcomes THEN it SHALL read the local ledger (`factory/gamification-ledger.json`, gitignored) and use `MAX(live, ledger)` for each metric (workOrdersDone, phasesCompleted, releases) so that **deleting a project NEVER decreases the guild's XP or level**.
- **AC-09-006.2** — WHEN a live metric exceeds the stored ledger value THEN Mission Control SHALL update the ledger to record the new maximum (snapshot-on-exceed, fire-and-forget — does NOT block the render).
- **AC-09-006.3** — `factory/gamification-ledger.json` SHALL be gitignored (personal data, DR-033). It SHALL NOT be committed to the repo.

## Future
Full-screen level-up moment; phase transitions as a "cutscene"; meta-achievements (titled, displayable Seals); XP multiplier for weekly streak.
