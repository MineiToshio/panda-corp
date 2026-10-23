---
id: LESSON-0502
type: gotcha
domain: tooling
tags: [edit-tool, read-tool, bash, claude-code]
context: using the Edit tool on a file that was read only via a `Bash cat <file>` call in the same
  session, rather than the Read tool
trigger: use this when the Edit tool refuses with "File has not been read yet" on a file you believe you
  already inspected
source: "mission-control .pandacorp/run/lessons.md 2026-10-22 (agent-inferred): Edit refused with
  \"File has not been read yet\" after the file had only been read via Bash cat; the same call batch
  also successfully Read a DIFFERENT file, confirming the Edit tool's read-tracking does not count a
  Bash-tool read as having read the file"
provenance: agent-inferred
created: 2026-10-23
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a file was inspected with `Bash cat <file>` (not the Read tool) and then the Edit tool
was called against it, refusing with "File has not been read yet." In the same batch, the Read tool had
successfully been used on a different file and Edit worked fine against that one — so the failure was
specific to how the first file was read, not a transient tool error.

**Lesson:** the Edit tool's "has this file been read" tracking only counts a read performed through the
Read tool itself; a `Bash cat`/`head`/`tail`/similar shell read of the same file's content does not
register as having satisfied that precondition, even though the agent now has the file's content in
context.

**Apply next time:** always use the Read tool (not a Bash shell read) on any file you intend to Edit
afterward, even if a Bash read already surfaced the content you needed — the Edit tool checks its own
read-tracking, not whether the content is already known.
