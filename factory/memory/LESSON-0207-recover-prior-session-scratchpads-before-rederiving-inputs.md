---
id: LESSON-0207
type: pattern
domain: agent-orchestration
tags: [scratchpad, session-continuity, find, rederivation, cost]
context: starting a new session/subagent on a task that a previous session likely already did partial research or produced inputs for (a fact sheet, a research memo, generated assets)
trigger: use this when starting work that resembles something a previous session in the same project may have already researched or drafted, or when a session restart has just occurred and background workers were in flight before it
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-07, agent-inferred. Complementary facet, 2026-09-13 (same project, agent-inferred): the session scratchpad can be WIPED between sessions (the `find`-based recovery above fails). To keep editing an already-published artifact in that case, recover it via the Artifact tool's `action=read` (it saves the full HTML under `tool-results/`) and strip the publish-time doctype/head/body wrapper before republishing — a second, independent recovery channel for when the filesystem-based one is unavailable. Corroborated from a SECOND, distinct project (mission-control, 2026-09-25, `.pandacorp/run/lessons.md` 2026-09-22, librarian harvest): a session restart during the 2026-09 implement-speed sprint wiped the scratchpad holding several canary/forensic analysis reports (`canary-d-report.md`, `canary-c-forensics.md`, etc.) with no recovery channel available for that artifact type (unlike a published HTML page, a plain analysis report has no Artifact-tool backstop) — the reports were permanently lost, not just inconvenient to re-derive. This corroborates the 'wiped' failure mode across two independent projects and adds a sharper prescription: durable analysis output has no guaranteed recovery path at all once the scratchpad is wiped, so it must be written to the repo (`docs/reviews/`, `factory/`, or the equivalent durable location) in the SAME turn it is produced, not left in scratch pending a later write. Fourth corroboration, factory (`factory/memory/_inbox.md` 2026-10-24, agent-inferred): a session restart also kills any BACKGROUND WORKERS dispatched before it, not just scratchpad files — there is no recovery channel for a background worker itself, so the correct response is to re-launch the work and tell the owner plainly that nothing from before the restart ran, never assume or report pre-restart completion (CONV-13)."
provenance: agent-inferred
created: 2026-09-08
status: active
promotion: proposed   # 2026-10-19 (librarian review) — target: factory/standards/agent-portability.md (or a new session-continuity convention): "before re-deriving research/analysis a prior session likely already produced, check for its scratchpad (find-based recovery) or the Artifact tool's action=read as a second channel; and write durable analysis output to the repo in the SAME turn it is produced, never left pending in scratch, since a wiped scratchpad has no recovery path for a plain report." Corroborated across 2 distinct projects (personal-page-v2's wiped-scratchpad + Artifact-tool recovery facets; mission-control's permanently-lost canary/forensic reports during the 2026-09 speed sprint) with zero contradicting evidence.
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0177, LESSON-0186]
---

**Situation:** prior sessions' scratchpad directories survive on disk at
`/private/tmp/claude-501/<project>/<session-id>/scratchpad` after the session ends, and can be located
with `find`. A new session re-deriving inputs (a fact sheet, a research memo) that a previous session
already produced wastes the work and risks drift between the two versions.

**Lesson:** scratchpad directories are not session-scoped from the filesystem's point of view — they
persist and are discoverable across sessions in the same project. Checking for and reusing a prior
session's scratchpad output is cheaper and more consistent than re-deriving the same inputs from scratch.

**Apply next time:** at the start of a task likely to overlap prior work, search for previous scratchpads
(`find /private/tmp/claude-501/<project-slug> -type d -name scratchpad` or similar), copy anything relevant
into the current session's own scratchpad, and note the source path in the raw lessons inbox so the
provenance of the reused input stays traceable. This is agent-inferred from a single occurrence — treat as
a candidate technique pending corroboration from another project before leaning on it as settled practice.
If the scratchpad itself was wiped (the `find` comes back empty) but the artifact was already published,
try the Artifact tool's `action=read` as a second recovery channel before re-deriving from scratch — it
returns the full published HTML, which just needs its publish-time doctype/head/body wrapper stripped
before it can be edited and republished.

**A second, distinct project corroborated the 'wiped' failure mode with a sharper stake: a plain analysis
report (a canary/forensic write-up, not a published artifact) has NO recovery channel at all once the
scratchpad is wiped** — no Artifact-tool backstop exists for that content type, so the loss is permanent,
not just an inconvenience to re-derive. The durable prescription: any analysis, report, or finding meant to
outlive the current turn belongs in the repo (`docs/reviews/`, `factory/`, or the project's equivalent
durable location) written in the SAME turn it is produced — never left sitting only in the session
scratchpad pending a later "I'll write it up properly" pass, because that later pass may never get the
chance to run before the scratchpad disappears.

**Third corroboration, same project (2026-09-28/29):** an in-progress blog draft was lost when the
scratchpad rotated mid-session and had to be rebuilt via the Artifact-tool `action=read` recovery channel
above. Sharper technique for the strip step: the publish wrapper adds a doctype/head around the authored
file, so recover the authored content by slicing from the authored `<title>` tag to the LAST `</script>`
tag in the returned HTML, discarding everything outside that span, before re-editing and republishing.
Also re-publish after every meaningful edit rather than batching several edits before the next publish —
batching widens the window in which a scratchpad rotation can erase unpublished work.

**Fourth corroboration, factory (2026-10-24, agent-inferred):** a session restart does not just wipe the
scratchpad's FILES — it also kills any background workers (Agent-tool subagents) that were dispatched
before the restart. Neither their output nor any trace that they ran survives; there is no recovery
channel for a background worker itself (distinct from recovering an already-written artifact). The
correct response on noticing a restart is to re-launch the needed work from scratch AND tell the owner
plainly that nothing from before the restart actually ran — never assume or report that a pre-restart
background task completed just because it was dispatched; verify its output exists post-restart before
trusting or citing it (CONV-13).
