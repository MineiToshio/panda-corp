---
id: LESSON-0185
type: pattern
domain: testing
tags: [playwright, e2e, flakiness, verification, synthesis, webserver]
context: a Playwright e2e spec or suite fails intermittently or "looks like a regression" and you are about to diagnose it as a real code defect
trigger: use this when a Playwright e2e run goes red intermittently, or red only on first boot / under a shared webServer / right after navigation — before trusting it as a real regression in the code under test
source: "synthesis over 4 evidence-anchored candidates, personal-page-v2 + mission-control, 2026-07-01..07-10 (already cross-linked in each lesson's own `links:`): LESSON-0040 (a fixed webServer port/lock collides with another project's dev server on the same machine, or an orphaned `next dev` lock blocks boot even on a free port — 6 corroborating occurrences across 2 projects), LESSON-0066 (a spec using `waitUntil: \"networkidle\"` flakes under a shared/contended webServer where sibling specs use `domcontentloaded` + explicit assertions), LESSON-0079 (an element-not-found failure reproduces ONLY on the very first test run right after webServer cold-boot, then passes reliably on retry/isolation), LESSON-0139 (a click/interaction right after `domcontentloaded` races a React Client Component's hydration, failing as \"element not found\" on a page that needs client-side JS) — librarian reflection pass, 2026-08-03. Folded in 2026-09-07 (librarian review): LESSON-0197 (personal-page-v2, 2026-09-06/07 — an HMR WebSocket handshake failure left the page looking rendered but never fully hydrated, so interaction tests failed while render/screenshot tests on the same pages passed; a mount-gated control, e.g. next-themes' disabled-until-mounted toggle, is a free oracle for hydration status), a 5th distinct mechanism with the same interaction-vs-render symptom split."
provenance: agent-inferred
created: 2026-08-03
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0040, LESSON-0066, LESSON-0079, LESSON-0139, LESSON-0197]
---

**Situation:** across two projects and eleven total corroborating occurrences, a Playwright e2e suite went
red (or flaked intermittently) for five *different* mechanisms, each one individually diagnosed at some
point as "the code under test is broken" before the real cause was found: a shared/orphaned dev-server
port or lock on the machine (LESSON-0040), `networkidle` contention under a shared webServer
(LESSON-0066), a first-run-only cold-boot timing gap (LESSON-0079), a client-hydration race right
after `domcontentloaded` (LESSON-0139), and an HMR WebSocket handshake failure that silently prevented
full client hydration while the static HTML still rendered/screenshotted clean (LESSON-0197). None of
these is a defect in the application code being tested; each is a distinct property of the *test
harness/environment* that looks like a regression from the outside.

**Lesson:** Playwright e2e flakiness is not a single failure mode with one fix — it is a family of
distinct, non-overlapping harness-level traps that share one symptom (an unexplained red or intermittent
failure) and one anti-pattern (trusting the red as proof the code changed for the worse). Before spending
time bisecting the application code, each of the five known mechanisms is cheap to rule out and each has
its own established fix: a port/lock collision is ruled out with `lsof -i :<port>` and checking for an
orphaned `next dev` process (LESSON-0040); `networkidle` under a shared webServer is fixed by switching
to `domcontentloaded` + an explicit assertion, matching sibling specs (LESSON-0066); a cold-boot-only
failure is fixed by warming the webServer once before the real run, or accepting a documented first-run
retry (LESSON-0079); a hydration race right after navigation is fixed by wrapping the interaction in
`expect(...).toPass()` rather than guessing at a timing wait (LESSON-0139); and a broader "interaction
tests fail, render tests pass" split is triaged by checking a mount-gated control (a hydration oracle
already present in the failure snapshot) before suspecting the feature at all (LESSON-0197).

**Apply next time:** when a Playwright suite goes red unexpectedly or flakes, check in order before
touching the application code: (1) is a foreign or orphaned dev-server process holding the port/lock
(LESSON-0040)? (2) does the failing spec use `networkidle` while siblings use `domcontentloaded`
(LESSON-0066)? (3) does the failure reproduce ONLY on the very first run after a cold webServer boot,
never on retry/isolation (LESSON-0079)? (4) does the failing interaction happen immediately after
navigation on a Client Component that needs hydration (LESSON-0139)? (5) do interaction tests fail while
render/screenshot tests on the same pages pass — check a mount-gated control in the failure snapshot for
stuck-pre-hydration state before suspecting the feature (LESSON-0197)? Only after ruling out all five
should an e2e red be treated as evidence of a real application regression.
