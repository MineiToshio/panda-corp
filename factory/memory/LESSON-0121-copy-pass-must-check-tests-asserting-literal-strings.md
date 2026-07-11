---
id: LESSON-0121
type: gotcha
domain: testing
tags: [copy, i18n, golden-strings, tests, content-pass]
context: rewriting UI or content copy in a codebase where some tests assert exact literal phrases (a compliance disclaimer, a CTA, a headline) rather than structural/semantic assertions
trigger: use this when planning or executing a copy-rewrite/content pass over any UI text, MDX or i18n messages before touching wording that might be under test
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-09 — the home/contact copy was found to be 'locked' by tests asserting exact literal phrases (homeCopyHonesty.test, HomeView.test, HowIUseAI.test, Hero.test — e.g. the mandatory 'not an AI engineer' disclaimer, 'let's work together', 'projects, told straight'); a copy-pass that changes wording without updating those literals reds the suite (agent-inferred)"
provenance: agent-inferred
created: 2026-07-09
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a test suite can assert **exact literal copy strings** — not just "a disclaimer renders"
but the disclaimer's precise wording — usually because the phrase carries a compliance/honesty
requirement (e.g. "not an AI engineer") the team wants locked, not just present. A copy-rewrite pass
done by grepping only the content/i18n files (MDX, JSON messages) will miss these tests entirely, since
the tests live in `*.test.*` files, not the content files being edited.

**Lesson:** literal-string test assertions are a deliberate lock on specific wording, not incidental
coupling — treat a reworded phrase's test failure as "the copy changed and the guarantee needs
re-approval," not as a stale test to just update blindly. But you must first KNOW such tests exist:
before starting a copy pass, grep the test suite for the phrases being changed (or for the copy's
source strings/keys) so the locked phrases surface up front, rather than being discovered one red test
at a time.

**Apply next time:** before any copy/content-rewrite pass, `grep -r` the test suite for substrings of
the copy about to change (or for the i18n keys touched); update the locked literal in the same commit as
the copy change, deliberately, rather than reactively chasing red tests. If a locked phrase encodes a
real compliance/honesty requirement, confirm with the owner that the requirement still holds before
loosening the test's literal — don't just make it pass.
