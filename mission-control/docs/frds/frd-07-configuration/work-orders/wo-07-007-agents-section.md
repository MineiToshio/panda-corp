---
id: WO-07-007
type: work-order
slug: agents-section
title: 'WO-07-007 — Agents section: list + detail + XP bar'
status: DRAFT
parent: FRD-07
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-18'
---
# WO-07-007 — Agents section: list + detail + XP bar

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-07-agent-list`, `CMP-07-agent-detail`](../blueprint.md#3-components--interfaces).

## Goal
Render the Agents section: per agent a pixel-art avatar (FF style), level and title (Apprentice →
Engineer → Senior → Architect); on detail, an XP bar to the next level and the honest explanation
that the agent levels up by **completing work orders**.

## Acceptance criteria (EARS, from FRD-07 + FRD-09 honesty)
- **AC-07-007.1** — The Agents section SHALL show, per agent, a pixel-art avatar, its **level** and its **title** (Apprentice → Engineer → Senior → Architect), from `IF-09-agent-xp`.
- **AC-07-007.2** — WHEN the owner opens an agent's detail, the system SHALL show an **XP bar to the next level** and the text explaining that it levels up by completing work orders (each closed work order adds XP).
- **AC-07-007.3** — The level/XP SHALL be derived from **real completed work orders** (FRD-09), NOT from app opens or activity volume; with no data the bar SHALL read 0/next honestly (never a fake-progress bar).
- **AC-07-007.4** — Avatar/level/title and the XP bar SHALL use FRD-13 tokens (rationed accent on the bar), with state never by color alone.

## Dependencies
- WO-07-001 (`readAgents()`), WO-07-005 (page shell). Intra-feature.
- **FRD-09** `IF-09-agent-xp` (agent XP from work orders) + the pixel-art avatar component
  (FRD-09 WO-09-002/003). Cross-feature — this WO depends on those.
- FRD-13 tokens. Cross-feature.

## TDD plan
1. RED: tests for avatar+level+title in the list, click→XP bar + explanation, zero-data honesty (0/next, no fake fill).
2. GREEN: implement list + detail consuming `readAgents()` + `IF-09-agent-xp`.
3. Refactor.

## Definition of done
- Component tests green; tsc + biome clean; tokens only; XP honest (no fake progress). `.pandacorp/verify.sh` passes.

## Status Note (retry — 2026-06-18, commit 08e5763)

**Blocker fixed:** The reviewer's blocking integration failure (AC-07-007.1) is resolved.

**Root cause:** `page.tsx` (Server Component) never called `readAgents()` or `computeAgentLevel()`, so the `agentsData` prop was never passed to `ConfigurationShell` and the Agents tab always showed an empty list at runtime.

**Fix applied in `src/app/configuration/page.tsx`:**
- Added `readAgents()` call (reads `plugin/agents/*.md` via `IF-07-reference`).
- Added `readEvents()` call (honest XP source — FRD-09 honesty contract).
- Built `levels: Record<string, AgentLevelResult>` by calling `computeAgentLevel(agent.id, events)` for each agent.
- Passed `agentsData={{ agents, levels }}` to `<ConfigurationShell />` alongside the existing `skills`, `rules`, `standards` props.

**Interfaces/contracts exposed:**

- `AgentsData` (exported from `ConfigurationShell.tsx`): `{ agents: AgentRef[]; levels: Record<string, AgentLevelResult> }` — page.tsx pre-computes and passes this.
- `AgentListProps`: `{ agents: AgentRef[]; levels: Record<string, AgentLevelResult>; selectedAgentId: string | null; onSelectAgent: (id: string) => void }`.
- `AgentDetailProps`: `{ agent: AgentRef; level: AgentLevelResult }`.

**Integration seams:**
- Data flow: `page.tsx` → `readAgents()` + `computeAgentLevel(id, events)` per agent → `agentsData` prop → `ConfigurationShell` → `AgentList` / `AgentDetail`.
- `pctToNext` from `computeAgentLevel` is [0,1] fraction; `XpBar` expects [0,100] — `AgentDetail` multiplies: `Math.round(level.pctToNext * 100)`.
- Zero events → xp=0, pctToNext=0 → bar fill=0% (honest, AC-07-007.3).
- `selectedAgentId` state resets when leaving the agents tab.

**Test coverage:**
- `src/app/configuration/_tests/agents.test.tsx` — 39 tests covering AC-07-007.1..4 (unchanged, all GREEN).
- `src/app/configuration/_tests/page.integration.reviewer.test.tsx` — 7 NEW integration tests that render the REAL `ConfigurationPage` against the real factory tree (`PANDACORP_FACTORY_ROOT` = repo root), confirming agent-card count > 0 (the gap that caused the original failure).

**Verify:** `pnpm vitest run src/app/configuration/_tests/agents.test.tsx src/app/configuration/_tests/page.integration.reviewer.test.tsx` → 46/46 GREEN. `tsc --noEmit` clean on changed files. `biome check` clean on changed files (2 pre-existing biome errors in untracked files from prior reviewer runs are out of scope).

## Reviewer finding (FRD-07 gate, 2026-06-17, Opus 4.8) — REOPENED → PLANNED → resolved in retry

**Blocking integration failure (AC-07-007.1).** The `AgentList`/`AgentDetail` components are
correct in isolation, but they NEVER reach the owner: the agents wiring was never added to
`app/configuration/page.tsx`. `git log -p -- app/configuration/page.tsx` shows `readAgents`
appears **0 times** — the Server Component never calls `readAgents()` / `computeAgentLevel()`
and never passes the `agentsData` prop to `ConfigurationShell`. At runtime the Agents tab
renders an empty list (`agentsData?.agents ?? []`), so no avatar/level/title is ever shown.

Proven with a reviewer integration test rendering the REAL `ConfigurationPage` default export
against the real factory tree (`PANDACORP_FACTORY_ROOT` = repo root): the agents tab contained
**0** `agent-card` elements (`expected 0 to be greater than 0`). The skills and standards tabs
were populated; agents was empty. The existing "integration" tests render `<ConfigurationShell />`
with NO props, so they never exercise the page→shell data flow and missed this.

**Fixed in retry:** `page.tsx` now calls `readAgents()` + `readEvents()` + `computeAgentLevel()` and passes `agentsData={{ agents, levels }}` to `ConfigurationShell`. A real page integration test was added to guard this seam.
</content>
