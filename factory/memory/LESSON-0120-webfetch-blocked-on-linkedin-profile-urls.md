---
id: LESSON-0120
type: gotcha
domain: research
tags: [webfetch, linkedin, anti-bot, fact-verification, career-history]
context: verifying a person's career-history facts (job titles, dates, companies) by fetching their public LinkedIn profile URL
trigger: use this when a task needs to verify career/professional facts and the plan is to WebFetch a linkedin.com/in/* profile URL
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-09 — WebFetch on the owner's linkedin.com/in/* profile URL returned HTTP 999 (anti-bot block, redirects to a country-code subdomain first) during the copy-truth pass, blocking automated verification of career facts (agent-inferred). Corroborated again (personal-page-v2,
LinkedIn-rewrite session, 2026-09-10, agent-inferred): the block held across ALL THREE automated access
paths in the same session — WebFetch (HTTP 999), the Browser pane (authwall), and Claude in Chrome (not
connected) — confirming this is not one tool's limitation but the platform itself. The fallback that
worked: a literal, owner-provided transcription of the profile's Experience section kept in a gitignored
dossier file, used as the source of truth for the profile's current state instead of any live fetch
attempt. Sharper fallback, 2026-09-13 (personal-page-v2, owner-provided): the owner's own LinkedIn 'More >
Save to PDF' export is a reliable, precisely-scoped current-state source — it includes headline, summary,
all experience text, top 3 skills, languages, certifications and education, but does NOT include photo,
banner, Featured, recommendations, the full skills list, or Open-to settings. Treat the PDF export as
covering exactly that field set; anything outside it still needs a separate owner-provided source (a
screenshot, a direct question)."
provenance: agent-inferred
created: 2026-07-09
status: candidate
promotion: none
confidence: medium
times_applied: 1
applied_in: [panda-corp]
links: [LESSON-0025]
---

**Situation:** a copy/content pass needed to verify career-history facts (job titles, employers, dates) and
attempted to `WebFetch` the person's public `linkedin.com/in/*` profile page as the source of truth.

**Lesson:** LinkedIn profile URLs consistently return HTTP 999 to automated fetchers (an explicit
anti-bot block, often preceded by a redirect to a country-code subdomain) — this is not a flaky
network error, it is LinkedIn's fixed policy. `WebFetch` cannot be used to verify or scrape LinkedIn
profile content, ever. This corroborates LESSON-0025's broader finding that LinkedIn is a "hostile
platform" for automation (there: browser-extension account-ban risk; here: the same hostility shows up
as a flat WebFetch block).

**Apply next time:** never plan a fact-verification step that depends on fetching a `linkedin.com/in/*`
URL — this holds across WebFetch, the Browser pane, and Claude in Chrome alike, not just one access path.
When career-history facts need verification, ask the owner directly (or use a document/screenshot
the owner already provided) instead of attempting to scrape LinkedIn; a literal transcription captured
once into a gitignored dossier file is a durable, reusable fallback for the rest of the session/project.
The owner's own "More > Save to PDF" export is the single most reliable version of this fallback — it
covers headline, summary, all experience text, top-3 skills, languages, certifications and education, but
explicitly excludes photo, banner, Featured, recommendations, the full skills list and Open-to settings;
ask for those separately if needed.
