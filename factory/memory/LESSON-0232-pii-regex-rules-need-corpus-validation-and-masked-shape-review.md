---
id: LESSON-0232
type: gotcha
domain: security
tags: [pii, regex, false-positive, redaction, validation]
context: writing regex-based PII detection rules (phone numbers, card numbers) from memory/general knowledge before running them against real content
trigger: use this when writing or freezing regex-based PII-detection rules (phone/card number patterns) before validating them against real project content
source: "personal-page-v2 .pandacorp/run/lessons.md (agent-inferred, translated from Spanish) — a PII regex set written from memory produces expensive false positives on real technical text: ISO dates, times, and version numbers (1.24 1.25 300) read as phone numbers, and any 13-19 digit id passes Luhn about 10% of the time (matching a card number). Before freezing PII rules, run them against the real corpus and print the MASKED shape of each match (digits -> #), never the actual value; the correct rejection is by shape (a date can't be a phone number, a card comes in one block or groups of 4), not by loosening the threshold."
provenance: agent-inferred
created: 2026-09-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0201, LESSON-0217]
---

**Situation:** a PII-detection regex set written from general knowledge (phone/card number patterns)
produced expensive false positives once run against real technical text: ISO dates, timestamps, and
version numbers (e.g. `1.24`, `1.25`, `300`) matched as phone numbers, and any 13-19 digit identifier
passed the Luhn check roughly 10% of the time, matching as a card number.

**Lesson:** regex-based PII rules written from memory, without validation against real content, are
unreliable in both directions — they will flag technical-looking numeric text that isn't PII. The fix is
not to loosen the match threshold (which just trades false positives for false negatives); it's to
validate the rules against the actual corpus before freezing them, printing the **masked shape** of every
match (digits replaced with `#`, never the real value, to avoid leaking anything into logs/output) and
rejecting by shape (a date's shape can't be a phone number's; a real card number appears as one
contiguous block or clean groups of 4) rather than by adjusting a numeric confidence threshold.

**Apply next time:** before shipping/freezing any regex-based PII detection rule, run it against a real
corpus from the target domain and review the masked shape of every match; reject false positives by
tightening the shape constraint, not by loosening the overall threshold.
