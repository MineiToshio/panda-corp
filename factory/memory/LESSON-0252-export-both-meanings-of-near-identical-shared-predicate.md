---
id: LESSON-0252
type: pattern
domain: code-architecture
tags: [typescript, shared-predicate, module-design, drift-prevention]
context: two call sites need nearly-identical-but-distinct boolean predicates derived from the same underlying data (e.g. a URL/href classification)
trigger: use this when a shared predicate has two call sites that need almost-but-not-quite the same boolean answer from the same input
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-20 (agent-inferred) — src/lib/i18n/hrefKind.ts exports both isInternalHref (router-owned in-app path, what LocaleLink needs) and isOffSiteHref (leaves the site, what a prose-link override needs); the difference is the hash-only href, internal to neither meaning"
provenance: agent-inferred
created: 2026-09-22
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0266]
---

**Situation:** two features needed a classification of the same input (an href) that looked like the same
predicate but actually differed on an edge case (a hash-only href is not "internal" in the router sense,
but it also doesn't "leave the site"). Deriving each meaning inline at its own call site would let the two
definitions silently drift apart.

**Lesson:** when a shared predicate has two nearly-identical-but-different meanings needed by different
call sites, name and export BOTH from one module, rather than letting each call site derive its own version
inline. This makes the distinction explicit (each exported name documents exactly what it means) and
prevents the two meanings from drifting apart as the codebase evolves — the same class of drift a single
source of truth is meant to prevent (DR-115).

**Apply next time:** when a second call site needs "almost the same" boolean as an existing predicate,
resist inlining a slightly-different check at the new call site — instead, name the new meaning, export it
alongside the original from the same module, and have both call sites import from that one source.

**Lifecycle counterpart (LESSON-0266):** this module is justified only WHILE ≥2 genuinely distinct
consumers exist. If a later change removes one of the two branches that justified the split, the module
drops back to a single consumer and must be deleted and inlined in that same change — see LESSON-0266,
which fired on this exact module (`hrefKind.ts`) 4 days after this lesson was captured, when a content-rule
change removed the branch at `BlogProseLink`.
