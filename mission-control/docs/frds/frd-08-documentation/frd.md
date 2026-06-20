---
id: FRD-08
type: frd
title: FRD-08 — Documentation
status: ACTIVE
implementation_status: VERIFIED
ui: true
visual_source: docs/design/prototype/index.html
last_updated: '2026-06-19'
---
# FRD-08 — Documentation

The **"Documentación"** surface: the navigable face of the factory's know-how inside Pandacorp, to understand the system (including the handoff to another person). It is the **operable surface of the factory's know-how**, organized with the **Diátaxis** model and surfaced as the top-nav tab labelled **"Documentación"** (the contract name — it is NOT called "Manual" or "Códice"; "el códice del gremio" may appear only as flavor copy in the subtitle).

## Acceptance criteria (EARS)
- The Documentation SHALL be labelled **"Documentación"** in the top nav and as its page H1; "Manual" / "Códice" SHALL NOT be the surface name.
- The Documentation SHALL offer a side menu with pages and a reading area that renders each page.
- The pages SHALL be organized by the full **Diátaxis** taxonomy: **tutorials** ("Empezar aquí" — learning-oriented, the first-mission walkthrough), **how-to guides** ("Guías" — task-oriented), **reference** ("Referencia" — information-oriented, the catalogs) and **explanation / concepts** ("Conceptos" — understanding-oriented, the why). Every documentation page SHALL belong to one of these four buckets.
- The pages SHALL cover, at minimum: what Pandacorp is, the flow, the stages in detail, the commands, the implementation modes, the standards, and how to operate / hand off to another person.
- The content SHALL be sufficient for someone with no prior context to understand how the factory works and how to operate it.
- The Reference catalogs — commands (skills), agents (party), decision rules, and standards — SHALL be **derived dynamically from the factory at build/read time** from the canonical source: the plugin skill and agent frontmatter (name + description) under `plugin/skills/` and `plugin/agents/`, `factory/decisions/registry.yaml`, and `factory/standards/`. They SHALL NOT be a hand-maintained copy, so that a **new, renamed or removed** skill, agent, rule or standard appears in the Reference **automatically** with no drift (DR-046).
- The Reference catalogs SHALL **reuse the Configuración (FRD-07) card components** — the same skill / agent / rule / standard card, grid and detail surfaces — rather than re-implementing them, so the two surfaces stay visually and behaviorally consistent.
- The hand-authored Tutorial / Guides / Concepts pages SHALL reflect the **current** factory workflow — the v2 build engine (the Build Plan, coarse work orders, repair-before-block, resumable runs) and the recent decision rules — NOT stale earlier content; a change to how the factory is operated SHALL update the affected page in the same change (DR-046; see the root `CLAUDE.md` "Decision log" section).
- WHERE a Concept/Guide page describes a project's documentation structure, it SHALL reflect the **feature-centric** layout (DR-049): the shared product layer (`docs/product/`), the per-feature module folders `docs/frds/frd-NN-<slug>/` (`frd.md` + on-demand `fdd.md`/`blueprint.md`/`mocks/`/`work-orders/`), the global `docs/{adr,analytics,reviews,decision-log.md}`, the stable-ID spine (`REQ-NN-MMM → AC-NN-MMM.K → CMP/IF-NN → WO-NN-MMM`) and the source-of-truth hierarchy `FRD > FDD > design-tokens > blueprint > work order` — NOT the old by-type layout (a flat `docs/frds/`, a global `docs/blueprint.md`, a global `docs/work-orders/`). The derived Reference picks up DR-049 and the rewritten `structure.md` standard automatically.

> **Prototype note.** While only the HTML prototype exists (`docs/design/prototype/index.html`), the "Documentación" surface (`manualView`) renders the Diátaxis side-menu and reuses the Configuración cards for the Reference; the Reference catalogs live in the `CONFIG.{skills,agents,rules,estandares}` arrays and are reconciled by hand; the Next.js app implements the dynamic derivation above by reading the source files directly. See the Mission Control decision-log (2026-06-15).
