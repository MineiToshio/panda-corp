---
id: WO-08-003
type: work-order
slug: reference-commands-agents
title: 'WO-08-003 — Reference: commands + agents (DERIVED, DR-046)'
status: DRAFT
parent: FRD-08
implementation_status: VERIFIED
source_requirements: []
last_updated: '2026-06-17'
---
# WO-08-003 — Reference: commands + agents (DERIVED, DR-046)

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-08-reference-commands`, `CMP-08-reference-agents`](../blueprint.md#5-components--interfaces) + [§2 derivation](../blueprint.md#2-how-the-reference-is-derived-the-dr-046-core).

## Goal
Render the Reference's **commands** and **agents** catalogs, **derived** from the FRD-07 readers
(`readSkills()`, `readAgents()`) — NOT a hand-maintained array. This is the DR-046 core.

## Acceptance criteria (EARS, from FRD-08 + DR-046)
- **AC-08-003.1** — The Reference SHALL list the commands (skills) derived at read time from `plugin/skills/<slug>/SKILL.md` via `readSkills()`, showing name (`/pandacorp:<slug>`) + description.
- **AC-08-003.2** — The Reference SHALL list the agents (party) derived from `plugin/agents/<id>.md` via `readAgents()`, showing name + description + model.
- **AC-08-003.3** — WHEN a skill/agent is **added, renamed or removed** in the factory, it SHALL appear/rename/disappear in the Reference **with no edit to any Manual file** (the DR-046 acceptance test) — verified by swapping the fixture tree.
- **AC-08-003.4** — There SHALL be **no hand-maintained catalog array** for commands/agents in the app (anti-pattern check).
- **AC-08-003.5** — The view SHALL use FRD-13 tokens; inline command names SHALL offer a `CopyButton` (copy only, no exec).

## Dependencies
- FRD-07 WO-07-001 (`readSkills`, `readAgents`). Cross-feature — REUSE, do not duplicate.
- WO-08-002 (shell). Intra-feature.
- FRD-02 `CopyButton`, FRD-13 tokens. Cross-feature.

## TDD plan
1. RED: tests rendering from the readers; a "rename a skill dir in the fixture → label changes" test (DR-046); an anti-pattern test asserting the component imports the reader, not a literal array.
2. GREEN: implement the two catalog views over the readers.
3. Refactor.

## Definition of done
- Component tests green incl. the DR-046 swap test; tsc + biome clean; no hand-copied catalog. `.pandacorp/verify.sh` passes.

## Status Note

**Built:** `ReferenceCommandsSection` (CMP-08-reference-commands) and `ReferenceAgentsSection` (CMP-08-reference-agents) — two dedicated Client Components that receive their data as props from the Server Component (`page.tsx`) which calls the FRD-07 readers at render time. No hand-maintained catalog array in either component (AC-08-003.4).

**Interfaces / contracts exposed:**

```tsx
// app/manual/ReferenceCommandsSection.tsx
export interface ReferenceCommandsSectionProps { skills: SkillRef[]; }
export function ReferenceCommandsSection({ skills }: ReferenceCommandsSectionProps): React.JSX.Element
// data-testid="reference-commands-section" — root container
// data-testid="reference-command-{slug}" — one <li> per skill
// Shows: /pandacorp:<slug> (text + CopyButton) + runsIn badge + description

// app/manual/ReferenceAgentsSection.tsx
export interface ReferenceAgentsSectionProps { agents: AgentRef[]; }
export function ReferenceAgentsSection({ agents }: ReferenceAgentsSectionProps): React.JSX.Element
// data-testid="reference-agents-section" — root container
// data-testid="reference-agent-{id}" — one <li> per agent
// Shows: name (or id fallback) + model badge (when !== "unknown") + description
// data-model={model} on the badge for targeting
```

**Integration seams:**
- `DocReader.tsx` delegates `activePage.catalog === "commands"` → `<ReferenceCommandsSection skills={skills} />` and `catalog === "agents"` → `<ReferenceAgentsSection agents={agents} />`.
- The `skills` / `agents` props flow from `page.tsx` server-side reads of `readSkills()` / `readAgents()` (IF-07-reference, FRD-07 WO-07-001). No new reader introduced.
- `CopyButton` (FRD-02) is used inline on each command row — copy only, never executes.

**DR-046 swap tests verified (AC-08-003.3):** renaming a skill slug in the fixture yields the new `/pandacorp:<new-slug>` name with zero Manual file edits; adding/removing entries adds/removes rows proportionally.

**Test files:** `app/manual/ReferenceCommandsSection.test.tsx` (29 tests covering AC-08-003.1/.2/.3/.4/.5 + DR-046 swap tests). WO-08-002 tests (`app/manual/page.test.tsx`) updated to the new `-section` testids.

**Gate:** 172 test files, 4723 tests GREEN. tsc clean. biome clean. verify.sh PASS.
</content>
