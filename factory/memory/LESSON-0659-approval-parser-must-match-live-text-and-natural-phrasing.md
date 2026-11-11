---
id: LESSON-0659
type: gotcha
domain: parsing
tags: [intent-parser, approval-flow, delimiter-mismatch, natural-language, owner-approval]
context: a strict, hand-written intent/reply parser decides whether an owner's or user's chat message counts as approval/delivery-confirmation, by matching against either (a) a specific separator/format in text your OWN system generated and displayed, or (b) a fixed one-item-per-message shape
trigger: use this when designing or debugging a strict intent/reply parser that must recognize an owner's natural-language response quoting or acting on text your own system displayed to them
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-09 and 2026-11-11 (agent-inferred): the HTML delivery seal separated a code and an operationId with ' · ' while the reply parser (identifiesDelivery) only accepted a bare space between them, so the owner's literal 'Sí, publica' quoting the displayed line never registered as approval, with no error surfaced to anyone; separately, deliveryTarget.ts/ownerIntent recognizes only one delivery code per message and rejects a natural multi-item reply like 'Sí, apruebo ambas' — deliveries have to be confirmed one per message with a bare 'Sí'."
provenance: agent-inferred
created: 2026-11-11
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0152]
---

**Situation:** two related failures in the same class of code. (1) A display formatter rendered a
machine-readable "code · operationId" line using ' · ' as the separator; a SEPARATE intent parser that
decides whether the owner's chat reply counts as a publish confirmation only recognized a bare space
between the two tokens. The owner's own literal "Sí, publica" — quoting exactly what was on screen —
silently failed to register, with no error anywhere; it just looked like nothing had happened. (2) A
delivery-approval parser accepts only one delivery code per message and requires a bare "Sí"; a natural
reply approving two deliveries at once ("Sí, apruebo ambas") is rejected outright.

**Lesson:** a generator (what gets displayed) and a parser (what counts as a valid reply to it) are two
independent pieces of code that must agree on an exact literal format, and nothing forces them to stay
in sync — a cosmetic formatting change on the display side (swap a space for ' · ') silently desyncs the
parser with no compile-time or runtime error, it just stops matching. Separately, a parser built to
recognize only the single most-common reply shape (one code, a bare "Sí") will reject a perfectly valid,
more natural reply shape the owner is likely to actually use, and both failure modes look identical from
the outside: the owner's clearly-intended "yes" simply does nothing.

**Apply next time:** when a reply-intent parser matches against text your own system generated and
displayed, test it against the LIVE RENDERED STRING produced by the current formatter, not an assumed
format — and re-test it every time the display formatting changes (this generalizes LESSON-0152's
"generator and parser must agree" lesson from model-output-vs-deterministic-gate to any two code paths
with the same contract). Separately, when the parser's target audience is a human replying in natural
language, design it to accept the plausible NATURAL variations of a correct answer (multiple items in
one message, synonyms for "yes") rather than only the single syntactic shape that was easiest to
implement — a rigid parser turns the owner's correct intent into a silent non-event.
