---
id: LESSON-0605
type: pattern
domain: security
tags: [auth, threat-model, internal-tool, risk-acceptance, owner-decision]
context: deciding whether an internal/personal tool needs authentication on its local-network deployment
trigger: use this when deciding whether a personal/internal tool's LAN or local deployment needs authentication, or when justifying an accepted no-auth posture to a reviewer
source: "mission-control .pandacorp/run/lessons.md 2026-11-01 (owner-stated), corroborating the already-accepted H-1 finding in mission-control/docs/reviews/security-2026-10-31.md (\"this is a domestic network and contains no confidential information\") and the 2026-10-12 decision-log entry approving the unauthenticated LAN bind — this note adds the owner's explicit reasoning for WHY no data there rises to confidential, not previously recorded verbatim"
provenance: owner-stated
created: 2026-11-04
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: []
---

**Situation:** Mission Control (a personal, internal factory dashboard) is deployed unauthenticated on
the owner's home LAN. A reviewer could read this as a security gap. The owner's own reasoning: the data
shown has no confidentiality requirement because the projects it tracks would be published publicly on
GitHub anyway — the handful that stay in private repos are private only to manage brand/trademark legal
exposure, not because their content or data is sensitive.

**Lesson:** "this tool holds private/business data" and "this tool's repo is private" are two
independent facts, and only the first one should drive an auth decision. A repo can be private purely
for legal/brand reasons (trademark risk, not wanting to pre-announce a name) while everything that same
tool DISPLAYS is data the owner is comfortable making fully public. Conflating repo-visibility with
data-confidentiality over-justifies authentication that isn't actually needed — or, in the other
direction, could under-justify skipping auth for a tool whose repo happens to be public but whose
runtime data (user records, secrets, PII) is genuinely sensitive. The deciding question is always about
the DATA the running tool exposes, never the git hosting visibility of its source.

**Apply next time:** when deciding (or defending a decision) on authentication for a personal/internal
tool's local/LAN deployment, ask specifically "is the DATA this tool displays/mutates confidential?" —
separately from "is the SOURCE REPO private, and why?". A private repo for brand/trademark reasons does
not imply the running app's data needs auth; conversely a public repo never excuses skipping auth for
genuinely sensitive runtime data. Record the owner's answer to the data-confidentiality question
explicitly in the security review (as mission-control's H-1 already does) rather than inferring it from
repo visibility.
