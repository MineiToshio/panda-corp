---
id: WO-07-007
type: work-order
slug: agents-section
title: 'WO-07-007 — Agents section: list + detail + XP bar'
status: DRAFT
parent: FRD-07
implementation_status: PLANNED
source_requirements: []
last_updated: '2026-06-16'
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
- WO-07-002 (`readAgents()`), WO-07-005 (page shell). Intra-feature.
- **FRD-09** `IF-09-agent-xp` (agent XP from work orders) + the pixel-art avatar component
  (FRD-09 WO-09-002/003). Cross-feature — this WO depends on those.
- FRD-13 tokens. Cross-feature.

## TDD plan
1. RED: tests for avatar+level+title in the list, click→XP bar + explanation, zero-data honesty (0/next, no fake fill).
2. GREEN: implement list + detail consuming `readAgents()` + `IF-09-agent-xp`.
3. Refactor.

## Definition of done
- Component tests green; tsc + biome clean; tokens only; XP honest (no fake progress). `.pandacorp/verify.sh` passes.
</content>
