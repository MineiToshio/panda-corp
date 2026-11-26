---
id: LESSON-0728
type: pattern
domain: infra
tags: [neon, egress, quota, cost-control, caching, public-endpoints, agent-inferred]
context: a project on a managed free/metered-tier database is approaching its egress/compute ceiling, and part of the drain is production read traffic on public, high-traffic, warm-cacheable endpoints (catalog browse, search) hitting the DB on every request
trigger: use this when a shared-quota cloud DB resource (egress, compute-hours, read count) is near its ceiling and some of the draw comes from production reads on public pages that don't need per-request freshness
source: "funko-tracker commit 23e6a703 (2026-11-25), decision-log entry 'Reuse the public browse revision on runtime visits': /explore and franchise/native search now read a warm in-process/shared cache keyed to the current public-catalog revision instead of hitting Postgres on every anonymous/signed-in visit, dropping those paths to 0 DB reads with a warm cache; only index-miss/cold paths and revision-changed continuations fall back to SQL, and the fallback validates only the requested IDs rather than re-querying everything. Landed the same week as LESSON-0727's dev-default + egress-alert fixes, as the production-read-side mitigation for the same Neon Free egress pressure (owner at ~80% of the 5GB/month allowance from dev alone, per docs/decision-log.md 2026-11-23/24) — but unlike LESSON-0727, the decision-log entry does not attribute this specific caching architecture to an explicit owner statement, so provenance is agent-inferred, not owner-stated."
provenance: agent-inferred
created: 2026-11-26
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0727, DR-140]
---

**Situation:** a project is pushing against a shared-quota managed DB's metered ceiling (egress, read
count, compute-hours). LESSON-0727 already covers the *development*-traffic side (default dev off the
cloud DB, add a proactive usage alert) — but production serving itself can also be a steady drain when
public, high-traffic pages (a catalog browse page, search, a hub) re-query the database on every single
visit even though their underlying data only changes on a known, infrequent event (a new ingestion
revision), not on every request.

**Lesson:** a public read endpoint whose data is keyed to an infrequently-changing version/revision
(not per-request state) doesn't need a DB round-trip per visit — it needs a warm cache keyed to that
revision, with the DB reserved for the cache-miss/cold path and for validating only what's actually
requested (not re-fetching the whole result set) when a revision change invalidates it. Treating "the
database" as the only source of truth for every request, even for data that is effectively immutable
between revisions, turns ordinary read traffic into continuous egress/compute pressure on a shared quota
— the same failure shape as LESSON-0727's dev-traffic case, just on the production-serving side instead
of the dev-tooling side.

**Apply next time:** when a project nears a shared-quota DB ceiling (or wants to avoid approaching one)
and has public, high-traffic read endpoints backed by data that changes only on a known, infrequent
event (a publish/ingestion revision, a cache-bust signal), cache those reads server-side keyed to that
revision so a warm visit costs zero DB reads; keep the DB path only for the cold/cache-miss case and for
validating the specific ids a revision change touches, not for re-querying the full page on every visit.
Pair with LESSON-0727 (dev-default + proactive alert) as the two complementary mitigations — one on the
dev-traffic side, one on the production-serving side — for the same underlying constraint (a shared,
metered resource drained by more than just "real" production traffic).
