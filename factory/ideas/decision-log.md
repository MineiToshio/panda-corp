# Decision Log — Ideas

Decisions about the **idea base and its process** (scoring, discarding, discovery flow). Most recent on top. See the index and format in [DECISION-LOG.md](../../DECISION-LOG.md).

> Note: the content and status of **each idea** lives in its own card (`factory/ideas/<slug>.md`, frontmatter). This file holds decisions about **how we manage ideas**, not the ideas themselves.

## 2026-06-15 — Idea-status machine unified + cards migrated to the v4 schema
**What:** Retired `documented` as a card status; the machine is now `discovered → recommended → in-pipeline → shipped | discarded`. `new-idea`/`discover` create cards as `discovered` (not `documented` — a raw idea has no PRD yet); on handoff the card freezes at `in-pipeline` and the board derives the middle columns (documented/design/architecture/building) from the project's `status.yaml` `phase`, NOT the card status — the "Documentada" column = a project in phase `product`. Also migrated the two real cards (`funko-tracker`, `restaurant-table-ordering`) to the v4 frontmatter: valid `project_type` (`web`), `origin: owner`, added `return_type` + `profile_alignment` (they were still in the dropped `tipo` vocabulary, e.g. `project_type: ambas`/`monetizable`).
**Why:** The board promised six columns but no skill ever wrote the middle three to the card; `documented` meant two different things (raw card vs post-PRD); and the real cards carried invalid enum values that the board/skills can't parse.
**Impact:** `factory/ideas/_idea-template.md`, `funko-tracker.md`, `restaurant-table-ordering.md`, `factory/standards/conventions.md` (gitignored-frontmatter-enum rule). Board derivation: `mission-control/docs/decision-log.md` (FRD-01/02). Skills: `plugin/docs/decision-log.md` (v5.0.0).

## 2026-06-15 — Card frontmatter migrated to English keys/enums (UI labels stay Spanish)
**What:** As part of the repo-wide language policy, the idea-card frontmatter keys and enum values moved to English: keys `title/project_type/origin/status/difficulty/profile_alignment/return_type/likely_stack/evidence/created/project`; the `status` enum `discovered → documented → recommended → in-pipeline → shipped | discarded`. The board's consumers were synced (`ideas.base` groups by `status`, `scan-ideas.sh` parses `status:`, the Mission Control prototype maps the English keys to Spanish display labels). Personal cards (gitignored) keep their Spanish prose body; only their frontmatter keys/enums were migrated.
**Why:** Machine-read identifiers must be English (committed = English); the owner still sees Spanish labels in the board.
**Impact:** `factory/ideas/_idea-template.md`, `ideas.base`, `plugin/scripts/scan-ideas.sh`, the prototype. See `factory/decision-log.md` (same date).

## 2026-06-15 — Card schema: category (project_type) + return, dropping the binary tag
**What:** The card replaces the `tipo` tag (monetizable/personal/both) with two orthogonal axes: `project_type` (web/mobile/desktop/ai/claude-code/prompt-system/automation/cli/rework/other) and `return_type` (monetary/opportunity/personal/mixed), plus `profile_alignment`. `new-idea` always classifies both.
**Why:** The binary tag didn't distinguish WHAT kind of solution it is, nor did it capture that the return can be an opportunity and not just money. It aligns the card with the recommendation model (DR-039) and with the board tags (Mission Control FRD-02).
**Impact:** `factory/ideas/_idea-template.md`, `plugin/skills/new-idea/SKILL.md`. Reflected in `mission-control/` (FRD-02) and DR-039.

## 2026-06-15 — Recommendations based on the owner's profile (two streams + dual value)
**What:** `discover` and `recommend` now read `factory/profile.md` and propose ideas in two streams (~50/50): general high-return opportunities, and opportunities aligned to the profile (interests/assets) even if their monetary return is lower. "Return" is no longer just money: it includes opportunity (reach/network/positioning), learning and personal value. The scope is opened up to any technological solution (web/mobile app, rework, tooling/Claude Code project, prompt or prompt system, automation). The card adds `project_type`, `profile_alignment` and `return_type`; `new-idea`'s scoring weighs return and fit.
**Why:** The owner wants recommendations well aligned to him —his interests, goals and assets (e.g. an audience that opens doors)— without losing the big general opportunities. Not everything has to be an app or monetize heavily: what matters is a real problem with good return (monetary or opportunity).
**Impact:** `plugin/skills/{discover,recommend,new-idea,onboarding}/SKILL.md`, `factory/profile.example.md`, `factory/ideas/_idea-template.md`, `factory/constitution.md` (mission), `factory/decisions/registry.yaml` (DR-039), `mission-control/prototype/index.html`.

## 2026-06-14 — Ideas decision log created
**What:** The decision log about the idea base starts.
**Why:** Part of the factory's "document everything" discipline — see [factory/decision-log.md](../decision-log.md).
