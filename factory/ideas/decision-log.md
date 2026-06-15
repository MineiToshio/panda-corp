# Decision Log — Ideas

Decisions about the **idea base and its process** (scoring, discarding, discovery flow). Most recent on top. See the index and format in [DECISION-LOG.md](../../DECISION-LOG.md).

> Note: the content and status of **each idea** lives in its own card (`factory/ideas/<slug>.md`, frontmatter). This file holds decisions about **how we manage ideas**, not the ideas themselves.

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
