---
id: FRD-07
type: frd
title: FRD-07 — Configuration
status: ACTIVE
implementation_status: VERIFIED
ui: true
visual_source: docs/design/prototype/index.html
visual_source_mocks: docs/frds/frd-07-configuration/mocks/configuration.html
last_updated: '2026-10-22'
floor: false
---
# FRD-07 — Configuration

Read-only view of what is configured in the factory: a Resumen hub and four catalogs (Habilidades, Agentes, Reglas de decisión, Estándares). The interface calls this surface "Configuración".

> **Design freeze amendment (2026-10-22, S2.2).** The approved Órbita prototype is the oracle. The previously unnumbered criteria are now numbered REQ-07-001 to REQ-07-012 in file order (the old `FRD-07#Uk` names map to REQ-07-0kk). Items the owner left out of v2 (decisions 2026-10-21 and M1) stay in place, prefixed **Out of v2**. Prototype-drawn behaviours are REQ-07-013 (AC-07-013.1 to AC-07-013.5). Source: `docs/design/freeze/reconciliation.md`, `docs/design/freeze/copy/frd-07.md`.

## Acceptance criteria (EARS)
- **REQ-07-001** — Configuración SHALL open on a **Resumen** hub (AC-07-013.1) and offer the catalogs **Habilidades · Agentes · Reglas de decisión · Estándares**.
- **REQ-07-002** — EACH catalog SHALL list its items with a name and a real **description** of what each one does. The descriptions keep their source language (they are shown content, not interface copy).
- **REQ-07-003** — WHEN the owner clicks an item, it SHALL show its **detail**: skills, agents and standards open a detail dialog; a decision rule opens as an inline accordion showing its default text (a deliberate exception to "reveal-more is a modal": 48 short rows, REQ-07-009).
- **REQ-07-004** — WHERE a command (skill) is shown, the `/pandacorp:<slug>` chip SHALL offer a **copy-to-clipboard** action; the copy only writes the command string to the clipboard (the app never runs it or calls Claude).
- **REQ-07-005** — The Habilidades catalog SHALL be **grouped by run-location**: the skills that run **"En la fábrica"** vs the skills that run **"Dentro de un proyecto"**, plus a third group **"Otras"** for skills whose scope is not declared (never dropped or filed under another group), each group shown under its own heading with a count.
- **REQ-07-006** — A skill that is **internal** (normally invoked by another skill, not run directly by the owner) SHALL carry a **"Motor interno"** chip on its row and in its detail header; an owner command carries "Comando tuyo" in its detail header.
- **REQ-07-007** — The detail of a **skill** SHALL show what it is for, where it runs ("En la fábrica" / "Dentro de un proyecto"), and its full definition (`SKILL.md`) behind "Definición completa". **Out of v2 (owner decision 2026-10-21):** the high-level **mini-flow** (chips with the agents it uses, coloured per agent, with arrows) and the curated interactive workflow explainer (FlowGraph).
- **REQ-07-008** — The Habilidades and Agentes catalogs SHALL support **cross-navigation**: from a skill's detail the owner SHALL be able to jump to any agent it uses, and from an agent's detail to any skill that uses it (clicking the linked chip opens the other item's detail).
- **REQ-07-009** — The **Reglas de decisión** catalog SHALL show ALL the decision rules with an **"Auto"** (auto-approves) or **"Tu OK"** (asks you) chip and, in the accordion, their default text. **Out of v2 (owner decision 2026-10-21):** the explainer of what a decision rule IS, and the **"New decision rule"** button that copies `/pandacorp:learn`.
- **REQ-07-010** — The **Estándares** catalog SHALL be filterable by **domain** through a data-driven select (the domains present in the factory's standards, not a fixed list of nine), with **severity** badges ("Obligatorio" / "Recomendado" / "Opcional" for MUST / SHOULD / MAY) and the **enforcement** (lint/CI/checklist/human gate); activating a standard opens a dialog with its markdown (no separate Summary and Detail views). **Out of v2 (owner decision 2026-10-21):** the **"New standard"** button that copies `/pandacorp:learn`.
- **REQ-07-011** — The **Agentes** catalog SHALL show, per agent: an avatar (its sprite where it has one, otherwise two-letter initials), a **model chip** ("Opus", "Sonnet" or "Modelo heredado") and an effort chip ("esfuerzo alto", "esfuerzo medio" or "esfuerzo bajo"). **Out of v2 (owner decision 2026-10-21):** the pixel-art avatar for every agent, and the agent's **level** and **title** (Apprentice → Engineer → Senior → Architect).
- **REQ-07-012** — **Out of v2 (owner decision 2026-10-21):** WHEN an agent's detail is opened, it SHALL show an **XP bar to the next level**, the explanation that it **levels up by completing work orders** (each closed work order adds XP), and an explanation of its **model assignment** — why it uses `opus` or `sonnet`. In v2 the model assignment is explained once per group, in the model-tier group header (AC-07-013.3).

The content is read from the factory plugin (`plugin/skills`, `plugin/agents`, `factory/decisions/registry.yaml`, `factory/standards/`); it is **read-only** — to edit, you do it in the files / Claude Code.

### REQ-07-013 — Resumen hub, search, tiers and filters (added 2026-10-22, design freeze)

- **AC-07-013.1** — THE Configuración SHALL open on a Resumen that offers one search across skills, agents, rules and standards, four count tiles, and "Tus comandos" (the owner's commands, copied on click).
- **AC-07-013.2** — EACH catalog tab SHALL offer a search, and Habilidades SHALL filter by the chips "Todas · Comandos tuyos · Motores internos" and offer a copy button per row.
- **AC-07-013.3** — THE Agentes tab SHALL group agents by model tier, each group header explaining the tier in one line, and each agent SHALL carry an effort chip.
- **AC-07-013.4** — THE Reglas de decisión tab SHALL filter by the chips "Todas · Automáticas · Requieren tu OK", SHALL mark each rule with its Auto or Tu OK chip, and SHALL list 30 rules at a time with "Mostrar más".
- **AC-07-013.5** — THE Estándares tab SHALL list the Obligatorio standards first in one list, SHALL filter by severity facets and by domain select, and SHALL show each standard's enforcement line under its title.

**Worked example (AC-07-013.4).** The factory has 48 decision rules, 13 of which need the owner's OK. The hub tile reads "13 requieren tu OK"; choosing the chip "Requieren tu OK" lists those 13; choosing "Todas" lists the first 30 and "Mostrar más" reveals the next 18.

## Edge cases
- An agent without a sprite → two-letter initials (REQ-07-011).
- A standard of severity MAY → "Opcional" (REQ-07-010).
- A skill or agent source that cannot be read → fail-loud error state naming it (DR-078), never an empty catalog.

## Does NOT include
- Editing any item (read-only), the creation affordances ("New decision rule", "New standard"), the skill workflow diagram, and agent level/XP progression (all out of v2).

## Note
Agent level and XP (earlier a part of the gamification layer, [FRD-09](../frd-09-gamification/frd.md)) are not shown in v2.

## Persistent navigation integration — FRD-25 (2026-10-17)

The [cross-cutting URL contract](../frd-25-persistent-navigation/frd.md) supersedes earlier local-only tab/detail state, exact-root navigation matching and display-name-derived project addresses in this document. Meaningful selections/filters are URL-owned, legacy links retain their resource and presentation context, and reload/Back/Forward restore that location. Existing visual design, data-read boundaries, action gates and machine-status history remain unchanged. Implementation scope and evidence live in FRD-25's blueprint/work-order record and delivery note.
