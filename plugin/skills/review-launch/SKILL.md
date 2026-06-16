---
description: Closes the post-launch loop of a Pandacorp project — reads the real product metrics (the PostHog event plan) against the PRD's value hypothesis and kill-signals, and gives the owner a kill / hold / double-down verdict. Runs IN a shipped project (phase operation). Designed to also run as a /loop self-paced job over the portfolio. It does NOT kill anything on its own — killing/archiving is the owner's decision.
---

# /pandacorp:review-launch

The back half of the economic arc (DR-043). The factory can ship and instrument; this skill makes it **learn** whether what it shipped actually works, and decide where to put effort next. Runs IN the project; precondition `phase: operation` in `.pandacorp/status.yaml` (a version is live with telemetry already verified by `release`).

`$ARGUMENTS` optional: a window (e.g. `30d`, `60d`); default = the window from the PRD's kill-signals.

## Steps

1. **Read the targets.** From `docs/prd.md`: the value hypothesis, the **activation milestone**, the success metrics and the **kill-signals with their numeric thresholds** (DR-043). From `.pandacorp/idea-origin.md`: the `return_type` — it decides which metric matters.
2. **Read the real metrics** (PostHog, the events defined in `docs/analytics/events.md`) for the window — acquisition, **activation rate** (share who reached the milestone), retention, and the return metric per `return_type`:
   - **monetary / mixed** → active users, revenue/MRR, and the **unit-economics check**: is revenue covering the per-active-user variable cost + the fixed Vercel Pro seat (the break-even from the PRD/blueprint)?
   - **opportunity** → the opportunity metric (reach/contacts/positioning gained).
   - **personal** → is the owner actually using it (a minimal usage signal)?
   Use the PostHog MCP if available; otherwise leave the queries documented for the owner to run and read what they paste back. **No invented numbers** — if the data isn't there, say so.
3. **Compare vs the hypothesis + kill-signals** and produce a **verdict**:
   - **DOUBLE DOWN** — the hypothesis held (or trends well): recommend the next move (iterate a feature via `/pandacorp:iterate`, or push distribution from `docs/launch-plan.md`).
   - **HOLD** — inconclusive / too early: keep measuring; set the next review date.
   - **KILL / ARCHIVE** — a kill-signal tripped (monetary: under the user/revenue threshold at the window, or CAC > LTV; opportunity: the metric is flat; personal: the owner stopped using it): recommend archiving and freeing the focus.
4. **Update the portfolio business columns** (`factory/portfolio.md`): active users / return metric / last verdict + review date, so the owner sees winners vs zombies across the whole portfolio. Feed it back: a killed idea informs `recommend` (don't re-propose the same dead bet).
5. **Report** (in Spanish, to the owner): the real numbers vs the hypothesis, the verdict with its rationale, and the concrete next step. Trigger a push (DR-038) when it needs a human decision (kill or double-down).

## Rules
- It **reads, recommends, and only writes** the portfolio business columns + a review note. It does NOT kill, archive, deploy or spend — those stay human gates (killing/archiving a shipped product aligns with DR-007/DR-011).
- Evidence over vibes: every verdict cites the real numbers, never "it seems to be going well".
- Return-aware (DR-042): judge by the metric that matches the idea's `return_type`, not always revenue. A `personal` tool the owner uses daily is a success even with $0.
- Designed to run unattended as a **`/loop` self-paced** job over the shipped portfolio: with no human present it only measures, records and notifies — it never kills on its own.
