---
id: LESSON-0727
type: pattern
domain: infra
tags: [neon, free-tier, egress, quota, cost-control, local-dev, owner-stated]
context: a product project runs its day-to-day development (migrations, seeding, ordinary dev server) against a managed free-tier cloud database (Neon) instead of a local one
trigger: use this when choosing the default DB target for routine dev commands on a project with a managed free-tier database, or when a cloud free-tier resource has any metered allowance (egress, compute-hours, request count) that ordinary development activity can consume
source: "funko-tracker commits 606b9b4e/bb7ac20e (2026-11-23), owner decision: November local development alone used 0.96 GB of the project's 5 GB/month Neon Free egress allowance, approaching 80% of the monthly cap from routine dev use (not production traffic). Owner response, same day: (1) flipped the default DB target for dev/migrate/seed/ops to a local Postgres cluster with a loopback guard, keeping Neon dev as an explicit opt-in (dev:neon, db:migrate:neon-dev); (2) added a weekly scheduled GitHub Action (scripts/ops/neonEgressCheck.mjs) that reads the Neon management API, projects usage to cycle end, and opens/updates a tracked issue at WARN (>=3.5GB/60%) and CRIT (>=4.5GB/80%) thresholds, closing it on recovery. See docs/decision-log.md 2026-11-23 entries."
provenance: owner-stated
created: 2026-11-25
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: [DR-140, LESSON-0699, LESSON-0697, LESSON-0696]
---

**Situation:** a project's managed database (Neon Free) has a monthly egress allowance shared between
dev, CI/test and production. Nothing pointed day-to-day development at it on purpose — it was simply the
default target for `dev`, `migrate`, `seed` and ops scripts — and ordinary local work alone consumed
~20% of the monthly cap before anyone was watching for it. There was no alert; the first signal would
have been Neon suspending the compute outright.

**Lesson:** a free-tier cloud resource's metered allowance is consumed by whatever defaults to it, not
just by what the plan name suggests ("production traffic") — routine development against a shared cloud
DB is a real, continuous drain on the same quota production and CI draw from, and it fails silently
until the ceiling is hit (DR-140 already mandates a local Postgres for *tests*; this is the same
principle one layer up, for ordinary *dev* commands, which DR-140 does not cover). A free-tier quota with
no proactive check is discovered only by its failure mode (suspension), never by a graceful warning.

**Apply next time:** for any project on a managed free-tier resource with a metered allowance shared
across dev/CI/prod (DB egress, compute-hours, API call count, storage), (1) default routine *development*
commands to a local/loopback instance of that resource, keeping the cloud one an explicit, intentionally
named opt-in — not just for automated tests (DR-140); and (2) ship a scheduled proactive usage check
(reads the provider's own usage API, projects to the billing-cycle end, WARN/CRIT thresholds with margin
before the real cap) that surfaces as a tracked, self-closing issue/alert — don't wait to discover the
limit by hitting it.
