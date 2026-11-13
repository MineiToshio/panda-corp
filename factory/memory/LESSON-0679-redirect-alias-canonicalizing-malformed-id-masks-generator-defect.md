---
id: LESSON-0679
type: anti-pattern
domain: data-modeling
tags: [id-generation, redirect, alias-map, legacy-compat, root-cause]
context: a routing/redirect layer (a URL alias table, a legacy-ID lookup map) silently canonicalizes a malformed or duplicate-looking generated identifier to its "correct" counterpart
trigger: use this when you find (or are about to add) a redirect/alias-map entry that maps a malformed-looking generated ID/slug to its canonical form, before accepting that entry as a legitimate backward-compatibility fix
source: "funko-tracker `.pandacorp/run/lessons.md` 2026-11-12 (agent-inferred): `next.config.ts`'s `LEGACY_PIECE_IDS` table (introduced in commit d188d6e3) redirected a clean, duplicated-looking piece ID (containing a repeated `pop-pop-` segment) to its canonical form — the redirect papered over a defect in the ID generator that was still producing the duplicated form for new/re-generated IDs, instead of fixing the generator itself."
provenance: agent-inferred
created: 2026-11-13
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [LESSON-0027]
---

**Situation:** a redirect/alias table existed specifically to map one malformed shape of a generated ID
(a duplicated segment, e.g. `pop-pop-<slug>`) to its clean canonical form. On inspection, the entry wasn't
a historical artifact from an already-fixed bug — the generator that produces these IDs could still
produce the duplicated form for a piece processed today, meaning the redirect was an ACTIVE, ongoing
compensation for a live defect, not a one-time migration aid for already-published legacy URLs.

**Lesson:** a redirect/alias-map entry that exists to reconcile a malformed generated value with its
canonical form is not evidence the problem was fixed — it is evidence someone (an agent or a developer)
found it easier to special-case the SYMPTOM at the routing layer than to trace and fix the generator that
produces it. Unlike a genuine legacy-compat redirect (old URL format → new one, for content that will
never be re-generated), an alias that keeps being necessary for freshly-generated content is a standing
tax that grows with every new malformed ID, and it hides the defect from anyone auditing "does ID
generation work" by making every malformed case look handled.

**Apply next time:** when you encounter (or are tempted to add) a redirect/alias-map entry whose purpose
is "canonicalize this malformed-looking generated value," don't stop at making the symptom navigable —
trace back to the generator and determine whether it can still produce that malformed shape for new
input. If it can, the alias-map entry is a defect marker, not a fix: file the generator bug (in the
project's own change queue if it's the project's own code) and keep the alias only as a one-time
migration aid for content that predates the generator fix, never as the ongoing mechanism.
