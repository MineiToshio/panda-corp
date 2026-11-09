---
id: LESSON-0653
type: pattern
domain: quality-assurance
tags: [review-gate, completeness, flagged-vs-unflagged, owner-feedback]
context: a review/approval pass that only surfaces items an automated check already flagged (red/yellow), implicitly treating unflagged ("accepted") items as fine
trigger: use this when designing or operating a review gate that distinguishes flagged vs accepted items, before assuming the accepted ones don't need a look too
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-08 (owner-stated): the owner, reviewing the ingestion HTML from a phone, found that items already marked 'accepted' by the automated check were blurry/badly cropped — the review flow needs to audit the quality/cropping of ALL views, not just the red/yellow flagged ones, before delivering"
provenance: owner-stated
created: 2026-11-09
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: [funko-tracker]
links: []
---

**Situation:** an automated review gate classified items as flagged (red/yellow, needing attention) or
accepted. Reviewing the actual accepted items by eye, the owner found several that were blurry or badly
cropped — defects the automated classifier had not caught, so they never surfaced to anyone as something
needing a look. The gate's own "accepted" status had been silently treated as "no further review
needed."

**Lesson:** an automated flag is a lower bound on what needs review, not an upper bound — "not flagged"
means "the automated check didn't catch anything," never "a human confirmed this is actually fine." Any
review workflow that only surfaces flagged items to a human reviewer is implicitly trusting the automated
classifier's recall completely, and a classifier with any false-negative rate at all will let real defects
through as silently "accepted."

**Apply next time:** when a review/approval gate distinguishes flagged from accepted items for the
purpose of directing human attention, don't let "accepted" mean "skip reviewing this" — budget time to
spot-check (or fully audit, when the batch size allows) accepted items too, specifically for defect
classes the automated check is known or suspected to miss (framing, cropping, blur, legibility) rather
than trusting its flag as complete coverage.
