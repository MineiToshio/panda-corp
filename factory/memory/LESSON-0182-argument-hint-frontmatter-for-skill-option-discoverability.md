---
id: LESSON-0182
type: gotcha
domain: skill-authoring
tags: [skill-md, frontmatter, argument-hint, discoverability, claude-code]
context: a skill accepts an option/tag/flag (e.g. a mode keyword after the slash command) that is documented only in the skill's body prose
trigger: use this when authoring or reviewing a SKILL.md that accepts arguments/options a user should discover from the slash-command menu itself
source: "panda-corp — claude-code-guide vs https://code.claude.com/docs/en/skills.md verification, factory/memory/_inbox.md 2026-07-22 (agent-inferred)"
provenance: agent-inferred
created: 2026-07-24
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a skill's SKILL.md documented an option/tag/flag only in its body text (prose read after
invocation). A user typing `/skill` in the slash-command menu has no way to discover that option exists
before invoking — it is invisible at the point of use.

**Lesson:** an option documented only in a skill's body is undiscoverable from the slash menu. Verified
against the live spec (claude-code-guide vs `https://code.claude.com/docs/en/skills.md`, v2.1.206+):
SKILL.md frontmatter supports `argument-hint` (renders as ghost/placeholder text directly on `/skill` in
the menu) alongside `arguments`, `effort`, `model`, `allowed-tools`, `disallowed-tools`,
`disable-model-invocation`, `user-invocable`, `context: fork`, `agent`, `hooks`, `paths`, `shell` —
commands and skills share one merged frontmatter schema. Frontmatter changes to an already-installed
skill may need a session restart before the slash-command autocomplete menu picks them up (a stale menu
is not evidence the change didn't take).

**Apply next time:** when a skill accepts an argument a user should discover before invoking it, name it
in `argument-hint` (and reinforce it in the `description`) rather than leaving it only in the body prose.
If a just-added `argument-hint` doesn't appear in the slash menu, restart the session before assuming the
change failed.
