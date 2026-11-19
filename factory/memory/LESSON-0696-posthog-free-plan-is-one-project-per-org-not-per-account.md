---
id: LESSON-0696
type: library-verdict
domain: external-services
tags: [posthog, analytics, provisioning, free-plan, organizations, dr-160]
context: provisioning PostHog analytics for a new app under an existing PostHog login, deciding whether to reuse one organization/project or create a new one
trigger: use this when choosing how to provision PostHog (or verifying a prior claim about its account limits) for a new project under an owner's existing PostHog login
source: "mission-control .pandacorp/run/lessons.md 2026-11-13 (owner-stated, verified live same day): an earlier architecture-phase research claim said PostHog did not allow more than one organization per login — WRONG. Verified live 2026-11-13: the SAME login can create UNLIMITED organizations; the real limit is per-organization — the free plan allows exactly 1 project per organization (6 projects with a card added, still $0), and the 1M-events/month analytics quota is also per-organization. This grounded DR-160 (factory/decisions/registry.yaml): one PostHog organization per app, under the owner's existing login, free plan, no card."
provenance: owner-stated
created: 2026-11-19
status: active   # owner-stated: eligible for immediate activation per the eval-gate
promotion: none
confidence: high
times_applied: 0
applied_in: [mission-control]
links: [DR-160, DR-036, DR-134]
---

**Situation:** architecture research for an app had claimed PostHog does not allow more than one
organization per account/login, which would have forced reusing one organization (and its single
free-tier project) across every app, or paying. A same-day live check overturned that claim.

**Lesson:** PostHog's actual limit is **per organization, not per login**. One login can create as many
organizations as it wants, each starting fresh on the free plan: 1 project per organization (6 with a
card, still $0/month), and the 1M-events/month quota is also scoped per organization — so N apps under
N organizations get N independent free quotas, not one shared pool. Don't trust a prior research claim
about a SaaS's account/org/project limits without re-verifying live against the provider's current
pricing/docs page — provider limits change and a stale or wrong claim (as here) can needlessly force a
paid upgrade or a shared-quota design that isn't actually required.

**Apply next time:** when provisioning PostHog (or any multi-tenant SaaS with an org/project hierarchy)
for a new app under an existing login, check live whether the free-tier ceiling is per-login or
per-organization before assuming you must reuse an existing organization/project. For PostHog
specifically: create a new organization per app (DR-160) — it is free, isolates quota, and needs no
card. Never carry forward an unverified "the provider doesn't allow X" claim from an earlier research
pass into a provisioning decision without a live re-check (CONV-13).
