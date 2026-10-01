---
id: LESSON-0236
type: anti-pattern
domain: build-orchestration
tags: [content-publish, hand-maintained-artifact, llms-txt, sitemap, visual-baseline, drift]
context: a content-publish flow (a blog-generator skill, any "add new content" automation) touches the canonical content source but a separate, hand-maintained artifact mirrors/depends on that content and is never updated in the same step
trigger: use this when designing or auditing a content-publish flow (blog post, case study, any new-content pipeline) — enumerate every hand-maintained artifact that mirrors published content before assuming the publish step is complete
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-12 (agent-inferred, 2 occurrences confirmed on the same project) — public/llms.txt is a STATIC, hand-maintained file that llmsTxt.test.ts derives its expectations from content/blog/ directly (source-of-truth-style assertion), so it can never silently drift out of the TEST's view -- but nothing enforces the FILE staying in sync with new content. A blog post published without updating llms.txt broke the gate for every unrelated change afterward; the same root cause independently broke a blessed visual baseline for the blog index (its post-count-dependent height changed). Confirmed to recur on a SECOND, later blog publish, fixed the same manual way both times -- proving it is a structural gap in the publish flow, not a one-off mistake. Corroborated a THIRD time (2026-09-30, same project, agent-inferred) with finer-grained facets on the same two mirror classes plus a genuinely new third: (a) llms.txt's expected set is PER-LOCALE, not per-post — one post publish needs one llms.txt entry per locale it ships in, not a single entry; (b) the visual-baseline obligation extends past the index's own height to the RELATED-POSTS BAND of sibling posts — publishing a new post can shift which posts a sibling page recommends, so sibling pages' own baselines need re-blessing too, not just the index; (c) new facet — a freshly-published route (draft flips to false) renders live for the FIRST time, so this is also the first run where browser/visual gates actually exercise that route at all, not a drift risk but a first-exposure risk (a defect that was always latent in the route's markup/data only surfaces now)."
provenance: agent-inferred
created: 2026-09-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0040, LESSON-0222]
---

**Situation:** a project's blog-publish flow updated the canonical content source (`content/blog/`) but
left two independent, hand-maintained downstream artifacts untouched: a static `llms.txt` file whose test
derives its expectations from the content source (so the test's OWN view can't drift, but the file itself
can), and a Playwright visual baseline for the blog index whose rendered height depends on the post count.
The gap recurred verbatim on a second, later publish — proving it is structural, not a one-off slip.

**Lesson:** whenever a content-publish flow (a blog generator, any "ship new content" automation) touches
the canonical content source, every downstream artifact that **mirrors or is hand-maintained in sync
with** that content — a static `llms.txt`/sitemap/RSS-style file, JSON-LD, or a blessed visual baseline for
a route whose layout depends on content volume — is a candidate to silently drift the moment a publish
happens without touching it too. A test that derives its expectations from the content source directly
(the "assert against the source of truth" pattern) protects the TEST from drifting, but does nothing to
protect the mirrored FILE itself from falling behind. The durable fix belongs in the publish flow, not in
catching each drift by hand afterward: either generate the mirrored artifact at build time from the
content source (removing the hand-maintenance step entirely), or add an explicit pre-publish/gate check
that fails loudly the moment the mirror and the source diverge.

**Apply next time:** when designing or reviewing any content-publish flow, enumerate every hand-maintained
artifact that mirrors the published content (search-surface files, structured-data exports, content-
volume-dependent visual baselines) and give the publish flow an explicit step — or a generator, or a
failing gate check — for each one, rather than relying on a human/agent to remember them per publish.

**Third occurrence sharpens the checklist with three concrete items:** (1) when a mirrored manifest
(llms.txt-style) is locale-aware, verify it gained one entry PER LOCALE the published content ships in,
not one entry per post/item; (2) a content-volume-dependent visual baseline obligation is not limited to
the index/listing page — any SIBLING page whose own rendering depends on the published item (a
related-items/recommendation band computed from the full content set) needs its baseline re-blessed too;
enumerate sibling pages with that dependency, not just the index. (3) treat a newly-published route's
first live render as a FIRST-EXPOSURE event, not just a drift risk — a route that was always generable
from draft content but never rendered through the real gate can surface a latent defect (missing data,
broken markup) that nothing caught earlier simply because nothing exercised it; budget a first-render
check specifically for any route crossing draft → published for the first time.
