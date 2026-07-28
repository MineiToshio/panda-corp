---
id: LESSON-0183
type: gotcha
domain: agent-verification
tags: [review-launch, dr-043, status-yaml, release-phase, deploy-verification, dns-cutover, kill-signal]
context: a scheduled review-launch (or any post-launch check) is about to read the value of a market/kill-signal window, or state a product is "live", by trusting the project's status.yaml phase field
trigger: use this when about to treat status.yaml's phase:release (or any recorded phase/state transition) as evidence that an EXTERNAL action (a production deploy, a DNS cutover, a public rollout) actually happened, rather than curling/inspecting the live public artifact directly
source: "personal-page-v2 2026-07-28 — scheduled /pandacorp:review-launch sweep curled https://toshiominei.com instead of trusting status.yaml's phase:release; found the domain Vercel-hosted but still serving the OLD pre-rebuild site (Firebase-Storage blog images, Disqus, jQuery-era CSS) — /en/projects 404s, /en/blog renders the old 'Welcome!' post, not the new MDX rebuild. .pandacorp/comms/progress.md's close-out only documents the internal integration gate going green; no entry records the external deploy/DNS-cutover step of /pandacorp:release ever running. Net effect: the 60-day reach kill-signal window has been measuring a site the public never saw. docs/decision-log.md 2026-07-28 entry."
provenance: agent-inferred
created: 2026-07-28
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0022, LESSON-0027, LESSON-0069]
---

**Situation:** `status.yaml` recorded `phase: release` for personal-page-v2, and the portfolio's kill-signal
tracking (0 contacts AND <100 unique visitors over 60 days) had been running against that phase since
~2026-07-01. A scheduled review-launch sweep, instead of accepting `phase: release` as proof the product was
actually live for the public, curled the production domain directly — and found it served an entirely
different, older site. The phase field was truthful about the INTERNAL build-loop state (the FRD loop +
hardening had completed) but said nothing about whether the distinct external action it names — deploying
and cutting DNS to the new build — had ever executed. No capture point (`progress.md`, `status.yaml`) records
that step running or failing; it is simply silent, so the gap was invisible until someone checked the live
artifact.

**Lesson:** a recorded phase/status transition is evidence of internal machine-state progress, not proof
that a distinct EXTERNAL, real-world action tied to that phase's name (deploy, DNS cutover, publish) was
actually carried out and observable by the public. This is a specific, high-stakes instance of the broader
"stand-in vs live artifact" family (LESSON-0069/0027): the stand-in here is a machine-written status field
whose semantics implicitly promise an external effect the field itself cannot attest to. It is also a
sibling of LESSON-0022 (an engine set `phase: release` without running the mandated hardening stage) but a
different gap: here the internal stage genuinely ran; what's unverified is the EXTERNAL action the phase name
implies. Any metric computed downstream of that phase (a kill-signal window, a launch-metrics comparison, an
owner-facing "it's live" claim) inherits the same blind spot and can silently measure nothing real.

**Apply next time:** before trusting a `phase: release` (or similarly named) status field as proof a product
is live/deployed/published, independently verify the live public artifact for the SPECIFIC claim the phase
implies — curl the production domain, check response headers/host, and diff a known-new route or piece of
content against what the rebuild actually shipped (not just a 200 status). Do this before computing or citing
any metric/window that is only meaningful if the external action happened, and before telling the owner a
product is "live". If evidence of the external action's execution is missing from every capture point
(`progress.md`, `status.yaml`, decision log), treat that absence as a fail-loud signal, not as "presumably
fine" — flag the operational gap explicitly rather than let a downstream metric quietly measure the wrong
thing.
