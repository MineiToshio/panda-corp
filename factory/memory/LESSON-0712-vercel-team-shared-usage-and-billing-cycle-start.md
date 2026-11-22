---
id: LESSON-0712
type: gotcha
domain: infra
tags: [vercel, billing, team-account, cost-attribution]
context: diagnosing or budgeting a single project's Vercel cost when that project's team account also hosts other projects
trigger: use this when attributing a Vercel usage-based cost (CPU, data transfer) to one project, or computing that project's per-day spend rate, on a team account shared with other projects
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-22 (agent-inferred): Vercel usage/cost is pooled across every project in the team, and the billing cycle's start date (this account: Nov 19) does not align with calendar-month boundaries or with 'days since I started investigating' — a per-day spend estimate must be computed from the cycle's actual start."
provenance: agent-inferred
created: 2026-11-22
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0693, LESSON-0701]
---

**Situation:** investigating a project's Vercel bill on a team account that also serves sibling projects.

**Lesson:** usage-based line items (compute/CPU time, data transfer) on Vercel are billed and reported at
the TEAM level, pooled across every project in that team — a dashboard total is never one project's own
number unless the team hosts only that project. Separately, the billing cycle has its own start date set
by when the team/plan began (not the 1st of the calendar month), so "cost so far this month" and "cost per
day" must be computed from that actual cycle start, not from an arbitrary reference point like "when I
noticed the spike."

**Apply next time:** before attributing or budgeting a cost on a shared Vercel team account, confirm
(a) whether other projects share the team (if so, per-project breakdowns, not the team total, are the only
valid signal) and (b) the account's actual billing-cycle start date (Vercel's own billing/usage page states
it) before computing any per-day rate.
