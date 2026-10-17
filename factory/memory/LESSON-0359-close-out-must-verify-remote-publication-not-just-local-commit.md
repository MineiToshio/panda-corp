---
id: LESSON-0359
type: gotcha
domain: factory-engineering
tags: [close-out, publication, git-push, sibling-project, deploy]
context: declaring a multi-project close-out complete (own project + a touched sibling project) based on a local commit or a started push
trigger: use this when closing out a change that spans more than one repo/sibling project and reporting that work is published
source: "factory/memory/_inbox.md agent-inferred note — Mission Control close-out, 2026-10-16: PandaSaga was clean locally yet 49 commits ahead of its remote, and the same close-out had to transfer over 716 MiB of versioned visual artifacts before publication was actually confirmed"
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a close-out touched a sibling project. The sibling's working tree was clean (nothing
uncommitted) — which read as "nothing pending" — but the sibling repo was actually 49 commits ahead of its
remote, carrying a large unpublished history (716 MiB of versioned visual artifacts) that still had to be
pushed before the close-out was genuinely done.

**Lesson:** a clean working tree only proves there is no LOCAL uncommitted work; it says nothing about
whether the local history has actually reached the remote. A started `git push` is not a confirmed push
either — a large payload can still be in flight or fail partway. Confusing any of these three states
(clean tree, started push, confirmed remote) with "published" produces a false "done."

**Apply next time:** before reporting a multi-repo close-out as complete, explicitly check each touched
repo's ahead/behind count against its remote AND the size of what still needs to transfer, and confirm the
push actually completed (not just that it was issued) before declaring publication done — especially for a
sibling project whose publication state wasn't the main focus of the session.
