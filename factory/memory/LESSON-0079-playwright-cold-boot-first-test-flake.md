---
id: LESSON-0079
type: gotcha
domain: testing
tags: [playwright, e2e, webServer, cold-boot, flake, first-run]
context: a Playwright e2e spec that queries a specific interactive element fails ONLY on the very first test run right after the webServer cold-boots, then passes reliably on retry and in isolation
trigger: use this when a Playwright e2e suite has an intermittent element-not-found failure that only reproduces on the first run of a session (not on retry, not in isolation)
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-04 — e2e/projects-fidelity.spec.ts 'Lightbox caption ... identical in light and dark theme' test (and its axe-core color-contrast variant) flaked with element-not-found on .lightbox-caption within a 5s timeout, only on cold webServer boot. Second facet, same project (factory/memory/_inbox.md 2026-11-21, agent-inferred): against a COLD `next dev` (no `.next` build cache), a full blog-cover-alt spec on DESKTOP left `/_next/image` requests (a welcome image at w=1200, an avatar) without a response, hitting the spec's own 30s goto timeout; a warm cache, isolated subsets, and a production build all passed — the exact root mechanism (route-compile warm-up vs. the image optimizer's own cold start, e.g. a first-call `sharp` transform) was NOT confirmed, only the correlation (cold dev + this spec = red; warm/prod = green)."
provenance: agent-inferred
created: 2026-07-05
status: candidate
promotion: none
confidence: low
times_applied: 1
applied_in: [panda-corp]
links: [LESSON-0040, LESSON-0066, LESSON-0185, LESSON-0512]
---

**Situation:** a Playwright spec that opens a lightbox/modal and asserts on an element inside it
(`.lightbox-caption`) flaked with an element-not-found within its 5s timeout — but ONLY on the very
first test executed right after Playwright's `webServer` finished cold-booting (Next.js dev/prod
server warming up its first route compile). The same test passed reliably on retry and when run in
isolation (warm server).

**Lesson:** the first test to hit a route in a freshly-booted `webServer` can race against the
server's first-request compile/warm-up (Next.js on-demand route compilation), producing a transient
element-not-found that looks like a real UI/interaction bug but is actually a cold-start latency gap,
not a regression. This is a distinct flake class from LESSON-0040 (port collision) and LESSON-0066
(networkidle unreliability under contention) — same family (shared/cold webServer produces symptoms
that mimic a regression), different trigger (server warm-up latency, not network contention or wrong
target).

**Apply next time:** before diagnosing a lightbox/modal-interaction e2e flake as a real bug, check
whether it only reproduces as the FIRST test hitting a fresh `webServer` boot. If so, treat it as a
stabilization task, not a regression: give the first test(s) in the file a longer timeout, or add an
explicit wait for the trigger element to be interactive/hydrated before interacting with it, rather
than assuming the interaction logic itself is broken.

**Second facet (2026-11-21, same project, unconfirmed exact mechanism):** cold-webServer-boot latency is
not limited to route-compile warm-up producing "element not found" — a request that depends on its own
separate cold-start path (e.g. Next's image-optimizer endpoint, `/_next/image`, possibly a first-call
`sharp` transform) can time out the same way under a COLD `next dev` (no `.next` cache) while passing
cleanly on a warm cache or a production build. Before attributing a network-request timeout to a real
regression, check whether it only reproduces against a cold dev server with no build cache; if a warm
rerun or a prod build passes, treat the cold-dev timeout as this same flake family rather than a defect in
the code under test — even though the exact cold-start mechanism may differ (and remain unconfirmed) from
the lightbox case above.
