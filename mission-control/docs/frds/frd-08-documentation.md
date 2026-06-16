# FRD-08 — Documentation

Navigable factory manual inside Pandacorp, to understand the system (including the handoff to another person). It is the **operable surface of the factory's know-how**, organized with the Diátaxis model — tutorial ("Empezar aquí"), how-to ("Guías"), reference ("Referencia"), explanation ("Conceptos").

## Acceptance criteria (EARS)
- The Documentation SHALL offer a side menu with pages and a reading area that renders each page.
- The pages SHALL cover, at minimum: what Pandacorp is, the flow, the stages in detail, the commands, the implementation modes, the standards, and how to operate / hand off to another person.
- The content SHALL be sufficient for someone with no prior context to understand how the factory works and how to operate it.
- The Reference catalogs — commands (skills), agents (party), decision rules, and standards — SHALL be **derived from the canonical source** at build/read time: the plugin skill and agent frontmatter (name + description) under `plugin/skills/` and `plugin/agents/`, `factory/decisions/registry.yaml`, and `factory/standards/`. They SHALL NOT be a hand-maintained copy, so that a new, renamed or removed skill, agent, rule or standard appears automatically with no drift (DR-046).
- The Manual SHALL stay in sync with the factory: the Reference is auto-derived (above); the hand-authored Tutorial / Guides / Concepts pages are kept in sync by the documentation discipline — a change to how the factory is operated updates the affected page in the same change (DR-046; see the root `CLAUDE.md` "Decision log" section).

> **Prototype note.** While only the HTML prototype exists (`mission-control/prototype/index.html`), the Reference catalogs live in the `CONFIG.{skills,agents,rules,estandares}` arrays and are reconciled by hand; the Next.js app implements the derivation above by reading the source files directly. See the Mission Control decision-log (2026-06-15).
