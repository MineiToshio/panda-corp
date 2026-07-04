---
name: recommend
description: Analyzes the Pandacorp ideas base and recommends to the owner which ones to advance, with a justified ranking aligned to their profile (interests, assets, goals) and to the dual value (monetary or opportunity return). Use when the owner asks "which ones do you recommend?", "what do we build?", or wants to review the state of their ideas.
---

# /pandacorp:recommend

Ranking and recommendation over the ideas base.

## Step 0 — Read the profile

Read `factory/profile.md`: interests, goals, **assets/levers** (audience, community, network, niche, skills), monetization appetite and preferred project types. The ranking is justified against this. If the profile doesn't exist, recommend running `/pandacorp:onboarding` and rank only by general value in the meantime.

## Steps

1. Read all the cards in `factory/ideas/` (at the factory root; the frontmatter — incl. `score` + `score_rationale` — plus the `### Evidencia` body section). Ignore `_idea-template.md` and the `discarded`/`shipped`/`in-pipeline` statuses.
2. **Re-validate scores if they are old** (created >60 days ago or weak evidence): a quick pass by the `researcher` to confirm the opportunity is still current.
3. Build the ranking considering, besides the score: **alignment with the profile**, **return type** (monetary, of opportunity —reach/network/positioning— or personal; weigh it by the owner's appetite), portfolio balance (mix; not 3 scrapers at once), available effort (projects already in pipeline — check `factory/portfolio.md`) and quick wins (high value / low difficulty first).
4. **Present in two blocks** so the owner sees both logics:
   - **Best bets (general value)** — the most promising by return/ease, regardless of topic.
   - **Aligned with you** — the ones that fit your interests or **leverage your assets / open doors for you**, even if their monetary return is smaller; explain *why* they fit.
   For each one: what it is (1 line), project type, why now, score, return type and difficulty, and what v1 would validate. Close with "which ones NOT and why".
5. Mark `status: recommended` on your choices (top picks from both blocks); the rest stay in `discovered`. **The final selection is the owner's** (human gate #1) and is expressed by running `/pandacorp:spec <idea>` on whichever they want (the visible handoff command — it runs the internal `scaffold` step for the mechanics and moves the card to `in-pipeline`). The ones they don't want, they discard from Mission Control (→ `discarded`). The Mission Control board is read-only: it reflects these statuses, it is not moved by hand.

## Rules
- At most ~5 recommended in total; choosing is what's hard, not listing.
- Be direct in recommendation #1: "I would start with X because Y".
- Don't penalize an aligned idea for low monetary return if it opens doors or leverages an asset; nor a general idea for not being "on the owner's topic". Both logics coexist.
