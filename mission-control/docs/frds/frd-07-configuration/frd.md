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
- WHERE a command (skill) is shown, the `/pandacorp:<slug>` chip SHALL offer a **copy-to-clipboard** action; the copy only writes the command string to the clipboard (the app never runs it or calls Claude).
- The **Skills** section SHALL be **grouped by run-location**: the skills that run in the **factory** vs the skills that run **inside a project**, each group shown under its own heading with a count.
- A skill that is **internal** (normally invoked by another skill, not run directly by the owner) SHALL carry an **"interno" flag** on its card and in its detail header.
- The detail of a **skill** SHALL show what it is for, where it runs (factory/project), what it produces, and a high-level **mini-flow** (chips with the agents it uses, colored per agent, with arrows) — the "graph of how the skill works".
- The Skills and Agents sections SHALL support **cross-navigation**: from a skill's detail the owner SHALL be able to jump to any agent it uses, and from an agent's detail to any skill that uses it (clicking the linked chip opens the other item's detail).
- The **Decision rules** section SHALL explain what a decision rule IS, show ALL the DRs with an **auto-approves (●) / asks you (●)** indicator, their detail (pre-approved default), and a **"New decision rule"** button that copies `/pandacorp:learn`.
- The **Standards** section SHALL be **categorized by domain** (Programming, Architecture, Design, Technology, Quality, Security, Operation, Data/Privacy, Product/Docs), with **severity** badges (MUST/SHOULD/MAY) and **enforcement** (lint/CI/checklist/human gate); each standard with two views, **Summary** (real key points) and **Detail** (markdown), and a **"New standard"** button that copies `/pandacorp:learn`.
- The **Agents** section SHALL show, per agent: a **pixel-art avatar** (Final Fantasy style), its **level**, its **title** (Apprentice → Engineer → Senior → Architect) and a **model chip** (`opus` / `sonnet`) indicating which model the agent runs on.
- WHEN an agent's detail is opened, it SHALL show an **XP bar to the next level**, the explanation that it **levels up by completing work orders** (each closed work order adds XP), and an explanation of its **model assignment** — why it uses `opus` (judgment work: architecture, review, specs — the most capable model) or `sonnet` (mechanical, verifiable work: implementation, search — cheaper and faster).
- The content is read from the factory plugin (`plugin/skills`, `plugin/agents`, `factory/decisions/registry.yaml`, `factory/standards/`); it is **read-only** — to edit, you do it in the files / Claude Code.

## Note
The agents' level/XP is an honest representation of real work (work orders completed), part of the gamification layer ([FRD-09](../frd-09-gamification/frd.md)).
