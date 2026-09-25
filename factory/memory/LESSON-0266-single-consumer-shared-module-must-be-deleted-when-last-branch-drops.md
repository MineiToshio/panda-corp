---
id: LESSON-0266
type: pattern
domain: code-architecture
tags: [refactoring, rule-of-three, speculative-abstraction, clean-code, module-design]
context: a behavior/content change removes the branch/call site that was the second consumer of a shared predicate or utility module, leaving it with only one caller
trigger: use this when a change removes the only branch that justified a shared module's existence, leaving it with a single consumer — before leaving the module in place
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-24 (agent-inferred) — hrefKind.ts (LESSON-0252) was extracted to export both isInternalHref and isOffSiteHref for two callers; once a content-rule change (AC-05-003.8, all blog-post links open in a new tab) meant BlogProseLink no longer branched on href kind, isOffSiteHref had zero callers and isInternalHref had exactly one, so the module was deleted and its logic inlined back into LocaleLink in the SAME change"
provenance: agent-inferred
created: 2026-09-25
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0252]
---

**Situation:** a shared predicate module (`hrefKind.ts`) was correctly extracted while it served two
distinct call sites with two distinct-but-related meanings (LESSON-0252). A later, unrelated content-rule
change removed the branch at one of those call sites, so the module's justification for existing
(preventing two meanings from drifting apart) disappeared along with it — one export dropped to zero
callers, the other to exactly one.

**Lesson:** this is the counterpart lifecycle event to LESSON-0252: a shared module is justified WHILE it
serves ≥2 genuinely distinct consumers; the moment a change drops it to one consumer, the module becomes
the speculative abstraction the rule of three warns against, and a linter like knip will NOT flag it
because the surviving single import still counts as "used" — nothing automated catches this decay. The fix
belongs in the SAME change that removed the second consumer, not a later cleanup pass: leaving a
one-consumer shared module around invites a future reader to assume it still serves two purposes.

**Apply next time:** whenever a change removes a branch/call site, check whether that call site was one of
only two consumers of a shared predicate/utility module it touched; if the module now has a single
consumer, delete the module and inline its logic at that one remaining call site in the SAME change, rather
than leaving it as a passing knip check.
