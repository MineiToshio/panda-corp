---
id: LESSON-0277
type: pattern
domain: content-generation
tags: [translation, localization, bilingual, review-order, english-review]
context: reviewing a translated/localized draft (e.g. an English rendering of a Spanish-authored blog post) against its source-language original
trigger: use this when reviewing a bilingual/translated draft and deciding the order of checks between target-language naturalness and source fidelity
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-30, owner-stated — an approved English review should feed specific English rules (natural contractions, habitual collocations, explicit subjects, independent reading before fact-comparing with the Spanish source); the blog source of truth stays ES even though the interface is EN. Reflected in docs/design/voice-and-tone.md and docs/voice/style-guide.md (2026-09-30)."
provenance: owner-stated
created: 2026-10-01
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: [LESSON-0224]
---

**Situation:** reviewing an English translation of a Spanish-authored post needed two different checks —
does the English read naturally, and does it still say what the Spanish source says — and running both
at once let whichever check happened first crowd out the other.

**Lesson:** a translated/localized draft needs two SEPARATE passes, in a specific order: (1) read the
target-language text INDEPENDENTLY, as if it were original prose, with the source closed — judge only
naturalness (contractions, habitual word pairings/collocations, explicit subjects, idiomatic flow). Reading
side-by-side with the source primes a word-for-word mindset that misses non-literal infelicities the
independent read catches immediately. (2) Only once the naturalness pass is done, open the source and
check factual fidelity. This generalizes LESSON-0224's calque-detection facet (bilingual CV copy) to any
translated content: the SOURCE of truth for facts and the SOURCE of truth for how the target language
should read are different texts, checked in different passes, and interleaving them degrades both checks.

**Apply next time:** when reviewing any bilingual/localized content, do the natural-language read of the
target text first, source closed, and record naturalness fixes; only then open the source and verify
facts against it. Never interleave the two checks in one simultaneous read-through.
