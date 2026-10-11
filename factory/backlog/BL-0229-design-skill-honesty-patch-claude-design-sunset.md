---
id: BL-0229
type: bug
area: plugin-skill
title: "Design skill + designer agent still route EXPLORE to standalone Claude Design (sunsets 2026-12-14) and tell the agent to generate WITH DesignSync, which the tool now forbids"
status: done
severity: p1
opened: 2026-10-11
closed: 2026-10-11
source: "docs/proposals/42-absorb-claude-design-to-artifacts.md, Plan step 2 (owner-approved 2026-10-10)"
closes: "plugin v9.121.1 — design SKILL.md Step 0 routes EXPLORE to hand-authored HTML, designer.md no longer generates with DesignSync, canvas-procedure.md + standards/design.md §1c marked LEGACY, DR-058/DR-109 superseded-pending"
links: [DR-058, DR-109, DR-081, BL-0058, BL-0117, LESSON-0141]
---

## Problem
Anthropic closes standalone Claude Design (`claude.ai/design`) on **2026-12-14**
(https://support.claude.com/en/articles/17440474). Design generation now happens in **Artifacts**
(the `Design`, `Design System` and `Slides` types, created with the `Artifact` tool). The live
`DesignSync` tool description (verified 2026-10-10, Claude Code v2.1.286) says: *"Never use it to make a
design, deck or prototype: those are made from a Slides or Design Artifact type with the Artifact tool."*

The factory still says the opposite:
- `plugin/agents/designer.md:33` (and its generated mirror `.codex/agents/designer.toml`) tells the
  designer to "generate the system + reusable components with the `/design-sync` skill + `DesignSync`
  tool (claude.ai/design)".
- `plugin/skills/design/SKILL.md` Step 0 (engine table + connection facts, ~:20-36) makes **Claude Design
  the EXPLORE default (DR-058)**, rationale "implementation fidelity from Claude Design output has been
  HIGH". That claim rests on about one project (proposal 22 F6), and LESSON-0141 records four failure
  modes of that same canvas on pandacast.
- `plugin/skills/design/references/canvas-procedure.md` (DR-109) is a relay ladder
  (claude-in-chrome → clipboard → manual) plus DesignSync polling against a surface that is going away.
- BL-0058 (chrome relay rung) is open p1 against that dead procedure.

Impact: the next EXPLORE run would route into a sunsetting surface and tell a subagent to use a tool
for the one thing the tool forbids.

## Root cause
DR-058/DR-109 encoded a third-party surface's state as of 2026-06/07 as a durable default, with no
re-check trigger. The tool's own description changed; the DRs did not.

## Fix plan
This is the **minimal honesty patch**. It does NOT design the replacement engine; that waits for the spike
(BL-0117, reopened) and validation on a real project (proposal 42 Plan steps 3-5).
1. `plugin/agents/designer.md:33`: replace the DesignSync-generation bullet. Claude Design standalone
   is sunsetting. The designer writes self-contained HTML directions in the repo (on the frozen tokens)
   and never generates with DesignSync. Publishing for owner review is the lead session's job, not the
   subagent's. Regenerate the Codex mirror (`node plugin/scripts/generate-codex-agents.mjs`).
2. `plugin/skills/design/SKILL.md` Step 0:
   - Engine table: Greenfield EXPLORE → **hand-authored HTML directions (Steps 4-6)**. The Claude Design
     row is marked *sunsetting 2026-12-14, do not start new canvas projects*.
   - Remove the "fidelity HIGH" rationale and state where fidelity actually comes from: frozen tokens,
     the per-FRD shards and the DR-056 gate.
   - Replace the connection-facts paragraph with the 2026-10-10 facts (Artifacts, DesignSync's new scope,
     `/design` native command drafts and implements and so **bypasses** our architecture/WO gates, so
     do not use it in the lifecycle).
   - Keep the DR-101 cadence, tracker and §12 rubric (engine-agnostic).
3. `plugin/skills/design/references/canvas-procedure.md`: a banner at the top saying it is **legacy**:
   valid only to finish an in-flight standalone canvas before 2026-12-14, and archived after that. The
   rescue/export path is Share → Project HTML → Project archive into `docs/design/claude-design-archive/`.
4. `factory/standards/design.md` §1c: the same sunset banner and routing change (one paragraph, not a
   rewrite).
5. `factory/decisions/registry.yaml`: DR-058 and DR-109 each get a `status`/note "superseded-pending,
   standalone sunset 2026-12-14, see proposal 42". **No new DR yet**, because the replacement is not
   validated.
6. Close BL-0058 as obsolete (`status: done`, `closes:` "obsolete — the relay surface sunsets; proposal
   42"). Reopen BL-0117 with the spike as its new fix plan.
7. Bump `plugin/runtime/plugin-metadata.json` (PATCH), run `node plugin/scripts/generate-plugin-manifests.mjs`,
   and add a `plugin/docs/decision-log.md` entry.

## Tests (prove the fix — TDD, RED → GREEN)
Script assertions (documented, run by hand, because these are prose contracts):
- `grep -n "DesignSync" plugin/agents/designer.md` no longer pairs DesignSync with "generate".
- `grep -n "default, DR-058" plugin/skills/design/SKILL.md` returns nothing, and the EXPLORE row names
  hand-authored HTML.
- `grep -n "HIGH" plugin/skills/design/SKILL.md` no longer finds the fidelity rationale.
- `head -5 plugin/skills/design/references/canvas-procedure.md` shows the LEGACY banner.
- `claude plugin validate plugin/` passes, and both manifests are at the new version
  (the derived-drift Stop gate is green).

## Done when
All the grep assertions hold. The plugin version is bumped and the manifests are regenerated. The Codex
mirror is regenerated. The decision-log entry exists. BL-0058 is closed and BL-0117 is reopened.

## Out of scope
- The replacement engine (Artifact-published review loop, Design System projection, LIST-shape token
  converter): BL-0117 spike first, then `/pandacorp:learn` after validation.
- Mission Control's "Claude Design" copy (project plane; `/pandacorp:change` once wording settles).
