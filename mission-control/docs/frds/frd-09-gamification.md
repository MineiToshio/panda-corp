# FRD-09 — Gamification (RPG theme)

The game layer that wraps the real work, in an **honest** and fatigue-free way. Guiding principle: represent real work in more interesting clothes; the factory **is** a campaign and the agents **are** a party.

## Vocabulary: Guild (gremio) vs Party — don't confuse them

Two **distinct and deliberate** RPG layers; each term names a single thing:

- **Guild (gremio)** — the **meta** layer: the operator (the owner) + the entire factory. Guild level/XP in the top bar ("Guild Master"), Guild Hall (trophies and stats), Guild Codex/Manual, Guild Commands, Guild Attributes. It is **persistent and cross-cutting** across the whole app.
- **Party** — the **group of agents building a concrete project** (the live RPG panel, [FRD-06](frd-06-party.md)). There is **one party per project** being built.

Analogy: you belong to a **guild** (the organization) and you go out in a **party** (the active group for each mission); a guild has many parties. **Rule:** don't use "guild" to name the agent panel, nor "party" for the operator layer.

## Acceptance criteria (EARS)
- The top bar SHALL show the **guild's level and XP** (operator), with a title and a bar to the next level.
- The vocabulary and visual accents SHALL have RPG flavor with **restraint** (missions, objectives, party, guild; pixel touches), **without sacrificing the legibility** of the data.
- The gamification SHALL represent **real work**: XP is earned by **result** (work order/phase/release closed), **not** by volume of trivial tasks nor by opening the app.
- The celebration SHALL **scale**: small toast (work order) → medium animation (phase) → celebration (release) → **level-up** moment. Never a flat celebration on every action.
- The system SHALL NOT include: **leaderboards**, **lives/death**, **daily streaks with reset**, nor **false urgency/timers**. Streaks SHALL be **weekly** (with a "freeze").
- The gamification SHALL complement good UX, not compensate for bad UX (clear data comes first).

## Principles validated by research (2026, see `docs/proposals/06-improvement-plan-2026.md`)
- It SHALL live in the **"White Hat" of Octalysis** (Epic Meaning, Accomplishment/Progress, Empowerment + Feedback): the greatest intrinsic asset is **seeing the agents work live**; XP is a secondary confirmation layer, not the main hook.
- XP for activity (not for result) is **forbidden** so as not to trigger the *overjustification effect* (the extrinsic reward can destroy intrinsic motivation). Every achievement maps to a **verifiable** result (work order/phase/release closed, green tests).
- EVERY new mechanic SHALL pass the **ethical test** before being added: does the user control their participation? does it build or undermine intrinsic motivation? is the reward meaningful or an addictive loop? is it honest about its psychological effect? Forbidden patterns: streak anxiety, slot-machine-style variable rewards, false urgency, leaderboards, a bar "stuck at 80%".

## Components (see also)
- Guild level/XP (this FRD) · Agent levels ([FRD-07](frd-07-configuration.md)) · Achievements Hall and stats ([FRD-10](frd-10-achievements-hall.md)) · Party RPG ([FRD-06](frd-06-party.md)).

## Future
Full-screen level-up moment; phase transitions as a "cutscene"; meta-achievements (titled, displayable Seals); XP multiplier for weekly streak.
