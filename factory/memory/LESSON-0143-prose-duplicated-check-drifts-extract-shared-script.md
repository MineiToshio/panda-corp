---
id: LESSON-0143
type: anti-pattern
domain: factory-engineering
tags: [guards, liveness, single-source-of-truth, drift, build-engine]
context: two independent skills/scripts each restate the same "is X alive/valid/current?" guard condition in their own prose or code
trigger: use this when a second skill or script is about to author its OWN copy of a check another skill/script already performs (a liveness guard, a validity guard, any boolean gate condition)
source: "panda-corp v9.84.0 skills-audit-batch — plugin/docs/decision-log.md 2026-07-10 entry; fix landed as plugin/scripts/check-build-liveness.sh, single owner for upgrade's active-build guard and preflight-implement.sh. Corroborating instance: panda-corp _inbox.md 2026-07-15 — factory/backlog/_item-template.md's frontmatter comment says severity is 'optional for a change', but plugin/scripts/validate-backlog.sh requires `severity` (a non-empty p0|p1|p2) unconditionally for every item regardless of `type`; the template's descriptive comment had drifted from the actual validator it describes."
provenance: agent-inferred
created: 2026-07-12
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0077]
---

**Situation:** `/pandacorp:upgrade`'s active-build guard checked only `supervisor_heartbeat` while
`preflight-implement.sh`'s guard for the same "is a build currently running?" question crossed
`max(supervisor_heartbeat, last_event_at)`. The two independently-authored copies of the SAME logical
check had drifted: a live build with a dead supervisor but a fresh `last_event_at` read as "not running"
under `upgrade`'s weaker check, letting an upgrade regenerate the engine mid-build. A second, independent
instance showed the same drift mechanism in PROSE rather than code: `_item-template.md`'s comment claiming
`severity` is optional for a `type: change` item disagreed with `validate-backlog.sh`'s actual REQ list,
which requires it unconditionally — an agent drafting a new backlog item from the template's comment alone
would author a schema-invalid item.

**Lesson:** a boolean guard condition ("is it alive/current/safe?", or a schema rule "is this field
required?") restated in prose OR duplicated code across two places WILL drift the moment one site's
requirement changes and the other isn't touched — this is the same one-shared-resolver principle
LESSON-0077 documents for derived counts, applied here to guard/liveness CHECKS and to a template's
DESCRIPTIVE COMMENTS about a validator's rules. Neither two code call sites nor a comment-and-its-validator
need to agree by discipline; they need to be UNABLE to disagree, which discipline alone cannot guarantee.

**Apply next time:** the moment a second skill or script needs the same yes/no guard another one
already implements, extract the check into ONE shared script/function both call (a single
`check-<thing>-liveness.sh`-style helper) rather than re-deriving the condition inline a second time.
Fail-closed on unparsable input in the shared helper, same posture as other guard scripts. When a
template/doc's comment describes a validator's rule (a required field, an enum), treat the VALIDATOR as
authoritative and verify the comment against it before trusting the comment to draft a new item — and fix
the comment the moment it's found to disagree, since a drifted comment silently teaches the next author
the wrong schema.
