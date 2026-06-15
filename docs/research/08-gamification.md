# Research: Gamification for Pandacorp (2026-06)

> So the panel feels like an RPG without becoming gimmicky. Sources linked at the end.

## Guiding principle
The gamification that survives in day-to-day professional tools is **"real work in more interesting clothes"** — it represents REAL progress, it doesn't invent fake progress or impose game anxiety onto work that already has its own stakes. In Pandacorp it fits naturally: the factory **is** a campaign; agents completing work orders **are** a party completing a quest.

## What to implement (Tier 1, high value / low fatigue)
1. **Quest log**: projects as missions with objectives (work orders) and phase in quest vocabulary.
2. **Pixel-art agents with 3 states** (idle/working/celebrating) in their "zone"; their presence + animation answers "who's doing what" without tooltips.
3. **Operator XP bar** (level + title), with a floating "+XP" and a level-up moment.
4. **XP/levels per agent** + titles (Apprentice → Engineer → Senior → Architect) and visual marks on level-up.
5. **An early achievement** (first idea, first work order) — the first-session unlock is the #1 retention lever.
6. **Activity graph** GitHub-style per agent (ambient, honest).

## Tier 2
Hall of achievements (trophies), **weekly** streak (not daily), phase transitions as a "cutscene", XP multiplier per streak.

## What to DISCARD
- **Leaderboards** (there's no one to compete against).
- **Lives/death** (Habitica's anxiety, its #1 complaint).
- **Daily streaks** (they punish irregular schedules; 25% of streaks break on Fridays). Use weekly ones with a "freeze".
- **False urgency / timers** (dark pattern; the work already has real deadlines).
- XP for logins/opening the app (rewards presence, not results).
- Full RPG dialogue from the agents (cute for 2 days, annoying after).

## Design rules
- **XP for results, not volume**: splitting a work order into 10 doesn't give more XP (avoids gaming a proxy metric).
- **The gamification S-curve**: there's an optimal point; past ~3-4 dense features, MORE features reduces engagement. Stop before the interface needs an explanation.
- **Scale the celebration**: small toast (work order) → medium animation (phase) → full celebration (release) → full-screen moment (level-up). A flat frequency = it numbs.
- **Achievements**: early unlock + progressive difficulty (the hard ones retain more); show locked ones as a silhouette with their condition.
- Gamification **complements** good UX, it doesn't compensate for it (Linear's lesson).

## Applied to Mission Control (v1, 2026-06-13)
Implemented in the prototype: Hall of achievements (Achievements tab, unlocked + locked by category), the guild's level/XP in the top bar, levels+titles per agent in Settings, progress reskinned as "Mission objectives", and the Party as a map with pixel-art zones where the characters roam their room and gather when they communicate, with an achievement on closing a work order.

Sources: [Habitica](https://trophy.so/blog/habitica-gamification-case-study) · [Duolingo](https://trophy.so/blog/duolingo-gamification-case-study) · [Todoist Karma](https://trophy.so/blog/todoist-gamification-case-study) · [GitHub](https://trophy.so/blog/github-gamification-case-study) · [Achievements/retention](https://trophy.so/blog/achievements-feature-gamification-examples) · [XP system](https://trophy.so/blog/when-your-app-needs-xp-system) · [S-curve (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC12554716/) · [Dark patterns](https://medium.com/@neil_62402/gamification-dark-patterns-light-patterns-and-psychology-9442d49f8b56) · [NPCs/colonists (RimWorld)](https://blog.rubenwardy.com/2022/07/17/game-ai-for-colonists/) · [Pixel art animation](https://www.sandromaglione.com/articles/pixel-art-character-animations-guide)
