# FRD-10 — Achievements Hall

A page of achievements that are also **stats that grow**, with a date and project on each one. (Today with example data in the prototype; when the real Mission Control is built, the stats are computed by reading the factory and the projects.)

## Acceptance criteria (EARS)
- It SHALL show a **statistics panel** (counters that only grow): products shipped, ideas captured, work orders, phases completed, iterations, flawless launches, ideas discarded, PRDs, ADRs, agents coordinated, record streak, record idea→launch.
- It SHALL show **cumulative chains** that tier up (**Bronze → Silver → Gold → Platinum → Legend**) when the associated stat crosses each threshold, with a **progress bar to the next tier** and the name of the next tier.
- EACH unlocked tier SHALL store and show the **date** and **project** where it happened.
- It SHALL show an **"Almost there"** section with the chains closest to their next tier (Zeigarnik effect).
- It SHALL show **unique achievements** (one-time only) grouped by category (**Discovery, Speed, Quality, Consistency, Mastery**), with date + project when unlocked, and the condition when locked.
- It SHALL include **secret achievements** shown as a silhouette + a **cryptic hint** until unlocked; ON unlocking, it SHALL **reveal its criterion** (what triggered it), never remain an obscure loot-box-style mechanic.
- The chains and progress bars SHALL apply **honest endowed progress**: start by showing the progress **already achieved** (not at zero) — it speeds up completion (Zeigarnik effect) and is honest because it corresponds to real work. No notifications or nagging reminders.
- The names SHALL be fun and scale in grandeur by tier (e.g. Products shipped: The first brick → Master builder → The architect → The digital magnate → The factory oracle).

## Detail
Full list of stats, thresholds, tier names and unique achievements in [mission-control/docs/achievements.md](../achievements.md).

## Future
Meta-achievements (titled, displayable Seals), a "New" badge for 7 days after unlocking, estimated rarity (Common→Legendary).
