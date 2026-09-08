---
id: LESSON-0206
type: pattern
domain: content-generation
tags: [copywriting, ai-tell, red-team, persona-copy, contractions, voice-and-tone]
context: producing first-person persona/biographical copy (About page, bio, hero) with an AI writer and needing it to read as genuinely human-authored
trigger: use this when finalizing AI-drafted first-person persona copy before it ships — run this checklist before the visual/content gate, not after
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-08: (owner-stated) the owner's acceptance bar for the About-page rebuild was explicit — copy must not 'feel machine-made', must be scannable, avoid unusual/stilted words, land neither too formal nor too informal, and storytelling is welcome; the owner asked for an explicit 'sounds like AI' red-team pass before delivery. (agent-inferred, same session) an opus-tier draft of the English copy (770 words) had ZERO contractions — the single strongest AI-prose tell, directly against this project's own voice-and-tone rule requiring contractions — plus 'the AI' with a definite article and impersonal aphorisms ('X beats Y'); the Spanish pass separately needed the y→e phonetic-euphony rule before a vowel-i sound ('y igual' → 'e igual'). (agent-inferred) the working end-to-end flow that produced copy that passed: interview → gitignored dossier with one [source] annotation per claim → draft written ONLY from the dossier → an adversarial red-team against 8 explicit criteria (traceability, privacy, positioning balance, native-ES phrasing, native-EN phrasing, sounds-like-AI, scannability, coherence with the rest of the site) → apply the ordered findings → gate; this red-team pass alone caught 4 unsourced facts and 2 duplications with the H1/intro"
provenance: owner-stated
created: 2026-09-08
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: [LESSON-0129, LESSON-0123, LESSON-0204, LESSON-0205]
---

**Situation:** an About-page copy pass needed to satisfy an explicit owner bar ("doesn't feel
machine-made", scannable, correctly calibrated formality) that a first AI-drafted pass failed on
concrete, checkable grounds: a 770-word English draft used not one contraction (violating this project's
own voice-and-tone guidance), leaned on "the AI" with an article and impersonal "X beats Y" aphorisms, and
the Spanish draft needed a language-specific euphony fix. A structured red-team pass against 8 explicit
criteria caught these plus 4 unsourced facts and 2 content duplications before they shipped.

**Lesson:** "sounds like AI" is not a vague vibe check — it decomposes into concrete, checkable signals
(missing contractions, hedged/impersonal phrasing, formulaic comparative aphorisms, language-specific
tells like Spanish y/e euphony) that a targeted pass catches reliably, the same way a linter catches a
style violation. Pairing that with a traceability check (every claim sourced) and a positioning check
(LESSON-0205) in one ordered red-team, run against a fixed criteria list, is what turned a rejected first
draft into an accepted one — this is a sibling technique to LESSON-0129's copy-taste corrections (concrete
over clever, exactly one hedge), but targets prose AUTHENTICITY tells rather than narrative cadence.

**Apply next time:** before shipping AI-drafted first-person persona copy, run an explicit adversarial
red-team against a fixed criteria list covering at minimum: traceability (every claim sourced to an owner
interview, per LESSON-0204), privacy, positioning balance (LESSON-0205), native-language phrasing per
target language, scannability, coherence with the rest of the site, and a dedicated "sounds like AI" pass
checking for missing contractions, "the AI" with an article, impersonal comparative aphorisms, and any
target-language-specific tells. Ask the owner up front for their concrete acceptance bar (formality level,
tone words to avoid) rather than guessing it.
