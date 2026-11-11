---
id: LESSON-0672
type: anti-pattern
domain: factory-engineering
tags: [block-dangerous, release-gate, false-positive, scope-check, git-remote]
context: a safety hook blocks a git command based on the CURRENT project's own status.yaml (phase/launch state) by matching the branch/ref name alone, without checking which repository the command's destination remote actually resolves to
trigger: use this when designing or reviewing a safety hook that blocks a git command based on a project's own status.yaml (phase/launch state) rather than the actual destination of that command
source: "panda-corp/funko-tracker, 2026-11-10 (agent-inferred): plugin/scripts/block-dangerous.sh's DR-138 'launched project' push guard (lines ~390-425) matches on the push destination's branch/ref name ('main') and the cwd's own .pandacorp/status.yaml, but never checks which repository the push's remote actually points to — running `git push` to an UNRELATED repo (e.g. panda-corp itself) from inside a launched project's working directory still triggers the block and demands PANDACORP_OWNER_RELEASE_OK=1, even though the destination isn't that project's own production. Filed as factory backlog BL-0308."
provenance: agent-inferred
created: 2026-11-11
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [BL-0308]
---

**Situation:** a safety hook designed to stop an accidental production push reads the CURRENT project's
own `status.yaml` (is this project launched? what's its phase?) and inspects the push command's branch/
ref name, but never resolves which actual repository the push's remote argument points to. A legitimate
`git push` to a completely different, unrelated repository — issued from a session whose working
directory happens to sit inside a launched project — still gets blocked, because the hook's logic only
ever asked "is the CURRENT project launched and is this ref named main," not "does this push's
destination belong to that launched project at all."

**Lesson:** a safety gate scoped by "which project's status.yaml says what" is only as correct as its
assumption that the command's effect also targets THAT project — a command that can target an arbitrary
OTHER destination (a different remote, a different repo) breaks that assumption, and checking only the
command's surface shape (a ref name) rather than its actual destination produces a false block on
legitimate, unrelated work.

**Apply next time:** when a safety hook's trigger condition depends on "is this destination the
protected one," resolve and check the command's actual destination identity (the remote's URL/repo, not
just a ref/branch name) before blocking — a ref name like `main` is not itself evidence the push targets
the project whose `status.yaml` triggered the check.
