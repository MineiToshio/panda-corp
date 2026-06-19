---
id: FRD-07
type: frd
title: FRD-07 — Configuration
status: ACTIVE
implementation_status: VERIFIED
ui: true
visual_source: docs/design/prototype/index.html
last_updated: '2026-06-19'
---
# FRD-07 — Configuration

Read-only view of what is configured in the factory, with the agents' identity and progression.

## Acceptance criteria (EARS)
- Configuration SHALL offer sections: **Skills · Agents · Decision rules · Standards**.
- EACH section SHALL list its items with a name and a real **description** of what each one does.
- WHEN the owner clicks an item, it SHALL show its **detail** (reading the content / explanation).
- The detail of a **skill** SHALL show what it is for, where it runs (factory/project), what it produces, and a high-level **mini-flow** (chips with the agents it uses, colored per agent, with arrows) — the "graph of how the skill works".
- The **Decision rules** section SHALL explain what a decision rule IS, show ALL the DRs with an **auto-approves (●) / asks you (●)** indicator, their detail (pre-approved default), and a **"New decision rule"** button that copies `/pandacorp:learn`.
- The **Standards** section SHALL be **categorized by domain** (Programming, Architecture, Design, Technology, Quality, Security, Operation, Data/Privacy, Product/Docs), with **severity** badges (MUST/SHOULD/MAY) and **enforcement** (lint/CI/checklist/human gate); each standard with two views, **Summary** (real key points) and **Detail** (markdown), and a **"New standard"** button that copies `/pandacorp:learn`.
- The **Agents** section SHALL show, per agent: a **pixel-art avatar** (Final Fantasy style), its **level** and its **title** (Apprentice → Engineer → Senior → Architect).
- WHEN an agent's detail is opened, it SHALL show an **XP bar to the next level** and the explanation that it **levels up by completing work orders** (each closed work order adds XP).
- The content is read from the factory plugin (`plugin/skills`, `plugin/agents`, `factory/decisions/registry.yaml`, `factory/standards/`); it is **read-only** — to edit, you do it in the files / Claude Code.

## Note
The agents' level/XP is an honest representation of real work (work orders completed), part of the gamification layer ([FRD-09](../frd-09-gamification/frd.md)).
