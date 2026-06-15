# Decision Log — Mission Control

Product, design and technical decisions for Mission Control (the Next.js app). Most recent on top. See the index and format in [DECISION-LOG.md](../../DECISION-LOG.md).

> The live project state is in [docs/status.yaml](status.yaml); the PRD in [docs/prd.md](prd.md) and the FRDs in [docs/frds/](frds/). This is where the **why** of the decisions goes, not the state.

## 2026-06-15 — Configuration reflects external-services + DR-032..039
**What:** The prototype (Configuration → Standards and Rules) was synced with the factory: the **external-services** standard card (Operation domain) was added to the "Craft Codex", and the decision registry — which cut off at DR-031 — now includes **DR-032..039** (iterate without advancing, personal data, plugin versioning, Vercel/payments, external services + accounts, secrets/provisioning, push at gates, recommendations based on the profile). The stack summary now names the services (R2, Resend, Kit, Sentry, PostHog, Polar).
**Why:** Configuration is the source of context for understanding the factory; it had to reflect the new standard and decisions, not fall out of date.
**Impact:** `mission-control/prototype/index.html` (the `CONFIG.estandares` and `decisiones` arrays + stack summary).

## 2026-06-15 — Title "Pandacorp Mission Control" + Guild vs Party codified
**What:** (1) The app's visible title becomes **"Pandacorp Mission Control"** (topbar + `<title>`): Pandacorp (brand) + Mission Control (the app). (2) It was clarified that **Guild (gremio)** and **Party** are two **distinct** RPG layers — not synonyms — and the boundary was **codified** in [FRD-09](frds/frd-09-gamification.md): guild = the operator/factory meta layer (level/XP, guild Hall/Codex/Commands); party = the agents of one concrete project (RPG panel, FRD-06). The phrases where they were mixed were cleaned up ("The party works in the guild…" → "…in its room…"; PARTY.md "by a guild" → "by the guild's room").
**Why:** The owner noticed "guild" in several places and wondered if it was the same as Party. It isn't (a guild has many parties); both layers are intentional. Writing down the boundary avoids confusing them in the future.
**Impact:** `mission-control/docs/frds/frd-09-gamification.md` (new "Vocabulary: Guild vs Party" section), `mission-control/PARTY.md`, `mission-control/prototype/index.html` (title + feed).

## 2026-06-15 — Rename: the app is "Mission Control"; the RPG panel is "Party"
**What:** We reassigned the names. The **whole app** (formerly "cockpit") is now called **Mission Control** — the center from which the entire factory is controlled. The **per-project RPG panel** (formerly "Mission Control") becomes **Party**: the subtab where you see your party of agents working live. "Pandacorp" remains the factory/brand. The `cockpit/` → `mission-control/` folder was renamed, the panel's canonical docs (`MISSION-CONTROL.md` → `PARTY.md`, `frd-06-mission-control.md` → `frd-06-party.md`), the prototype (topbar, `<title>`, "Party" subtab, manual texts) and `.claude/launch.json`. Verified in preview: "Mission Control" topbar, "Party" subtab, RPG map and KPIs intact, no console errors.
**Why:** By convention (NASA, macOS), "Mission Control" names the center that supervises and commands the ENTIRE operation, not a sub-panel; having it on the little panel inverted the meaning and was sometimes used as a synonym for the app. The analogy now is clean: Pandacorp (organization) → Mission Control (its control center = the app) → Party (the crew of agents on each mission, in line with the "party" language the prototype already used).
**Impact:** the `mission-control/` folder (formerly `cockpit/`), `mission-control/PARTY.md`, `mission-control/docs/frds/frd-06-party.md`, `mission-control/prototype/index.html`, `.claude/launch.json`. Repo-wide change (CLAUDE.md, README, plugin/skills, standards, registry.yaml, hook): see the twin entry in [factory/decision-log.md](../../factory/decision-log.md).

## 2026-06-15 — Onboarding gate + board tags (category + return)
**What:** Mission Control gains an **onboarding gate**: if it doesn't find `factory/profile.md`, it shows — before anything else — a banner asking to run `/pandacorp:onboarding` (FRD-01). On the board, each card goes from a single tag (monetizable/personal/both) to **two**: **category** (solution type: web/mobile/desktop/AI/claude-code/prompts/automation/CLI/rework) with an icon, and **return** (monetary/opportunity/personal/mixed) with color; the filter is now by category (FRD-02). HTML prototype updated and verified in preview.
**Why:** Without a profile the factory can't make aligned recommendations (hence the gate). A single binary tag captured neither the project type nor the return model (money or opportunity); two orthogonal axes make it clear on the board.
**Impact:** `mission-control/docs/frds/frd-01-data-reading.md`, `mission-control/docs/frds/frd-02-ideas-board.md`, `mission-control/prototype/index.html`. Related: `factory/ideas/_idea-template.md`, DR-039.

## 2026-06-14 — Mission Control decision log created
**What:** The Mission Control decision log starts.
**Why:** Part of the factory's "document everything" discipline — see [factory/decision-log.md](../../factory/decision-log.md).
