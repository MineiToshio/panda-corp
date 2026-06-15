# Decision log — Plugin pandacorp

Decisions about the plugin: skills, agents, hooks, templates and the factory flow. Most recent on top. See the index and format in [DECISION-LOG.md](../../DECISION-LOG.md).

> Reminder: after editing `plugin/`, commit and run `claude plugin update pandacorp@panda-corp` (see `CLAUDE.md`).

## 2026-06-15 — Launch-language research + direct-push-to-main workflow · v4.0.0
**What:** `onboarding` now captures the owner's `country`; `researcher`/`spec`/`product-manager` gained a launch-market-&-language research dimension (DR-041 — recommend per product, no fixed default, recorded in the PRD); the build agents (`implementer`/`backend-dev`/`frontend-dev`), `iterate` and `block-dangerous.sh` were updated for the direct-push-to-main workflow (DR-040).
**Why:** See `factory/decision-log.md` (same date) for the full rationale.
**Impact:** `plugin/skills/{onboarding,spec,iterate}`, `plugin/agents/{researcher,product-manager,implementer,backend-dev,frontend-dev}`, `plugin/scripts/block-dangerous.sh`, `plugin/templates/shared/{CLAUDE.md.tpl,AGENTS.md.tpl}`. Folded into the same 4.0.0 release (branch not yet shipped) — no extra version bump.

## 2026-06-15 — Language policy migration: committed = English / gitignored = Spanish · v4.0.0
**What:** Executed the language policy (DR-009) across the whole repo. Plugin impact: all skill/agent docs and `STACK.md` translated to English; templates updated — `CLAUDE.md.tpl`/`AGENTS.md.tpl` now state the new rule and use English doc paths/enums, `status.yaml.tpl` is machine-state-only (English) with the Spanish narrative moved to a gitignored `docs/summary.md`, `decision-log.md.tpl` is English, `iteration.md.tpl` stays Spanish (it seeds a gitignored Spanish comms file). `pandacorp-build.js` translated to English and its build-mode tokens migrated `equilibrado|potente|profundo → balanced|powerful|deep` (display labels stay Spanish; synced in `implement` SKILL, FRD-11, the prototype). Idea/profile/status frontmatter keys and enums migrated to English. Bumped MAJOR to **4.0.0** (DR-034) — breaking for existing projects (enum/path/key changes).
**Why:** Anyone cloning the public repo sees everything in English (industry standard) while the owner keeps operating Pandacorp in Spanish (UI + the gitignored communication layer).
**Impact:** `plugin/.claude-plugin/plugin.json` (4.0.0), `.claude-plugin/marketplace.json`, `plugin/skills/**`, `plugin/agents/**`, `plugin/templates/**`, `plugin/scripts/{block-dangerous,verify-before-stop}.sh`. Factory-wide: see `factory/decision-log.md` (same date). Activation: commit + `claude plugin update pandacorp@panda-corp` + restart.

## 2026-06-15 — Skill `teach` renamed to `learn` (name refinement) · v3.0.0
**What:** The owner preferred `learn` over `teach` for the command (the factory *learns* the know-how). `/pandacorp:teach` → `/pandacorp:learn` was renamed (same skill, same function). Renaming a skill = **MAJOR** (DR-034). It's a name refinement on the same day as v2.0.0 (codify→teach), which was never actually used (no restart in between).
**Why:** `learn` communicates better that the factory incorporates/learns the durable know-how.
**Impact:** `plugin/skills/teach/` → `plugin/skills/learn/SKILL.md`, `plugin/.claude-plugin/plugin.json` (3.0.0), `factory/standards/README.md`, `mission-control/docs/frds/frd-07-configuration.md`, `mission-control/prototype/index.html`, `docs/proposals/08-standards-rules-catalog.md`. Activation: commit + `claude plugin update pandacorp@panda-corp` + restart.

## 2026-06-15 — Rename `codify` → `teach` (+ teach creates skills by delegating to skill-creator) · v2.0.0
**What:** The `/pandacorp:codify` command was renamed to `/pandacorp:teach` (the name "codify" read as "write code", the opposite of what it does: record durable know-how). `teach` now covers a third artifact besides standard and decision rule: **create/improve a skill**, delegating authorship and evaluation to the native `skill-creator` (compose, don't reinvent); teach only adds the owner's gate, placement in the plugin, the security/vendoring policy for external skills and the activation ritual. Renaming a skill = **MAJOR** (DR-034).
**Why:** The name was confusing; and creating skills is durable know-how (`teach`'s domain), not product (`implement`'s domain) — reusing `skill-creator` instead of cloning it.
**Impact:** `plugin/skills/codify/` → `plugin/skills/teach/SKILL.md`, `plugin/.claude-plugin/plugin.json` (2.0.0), `factory/standards/README.md`, `mission-control/docs/frds/frd-07-configuration.md`, `mission-control/prototype/index.html`, `docs/proposals/08-standards-rules-catalog.md`. Activation: commit + `claude plugin update pandacorp@panda-corp` + restart.

## 2026-06-15 — App/panel rename reflected in the skills (cockpit→Mission Control, panel→Party) · v1.2.3
**What:** After the app rename (see [factory/decision-log.md](../../factory/decision-log.md) and [mission-control/docs/decision-log.md](../../mission-control/docs/decision-log.md)), the vocabulary in the plugin's skills and artifacts was updated: `implement`, `decide`, `recommend`, `codify`, `bug`, `blueprint` (prose and descriptions: "the cockpit" → "Mission Control"; "followed in Mission Control" where it previously said the panel), `plugin/scripts/emit-event.sh` and `plugin/templates/shared/docs/status.yaml.tpl` (comments). No behavior change → bump **PATCH 1.2.2 → 1.2.3**.
**Why:** The skills mention where "the build is followed"; they must use the correct name (Mission Control = the app; Party = the per-project RPG panel).
**Impact:** `plugin/.claude-plugin/plugin.json` (1.2.3), `plugin/skills/{implement,decide,recommend,codify,bug,blueprint}/SKILL.md`, `plugin/scripts/emit-event.sh`, `plugin/templates/shared/docs/status.yaml.tpl`. Activation: commit + `claude plugin update pandacorp@panda-corp` + restart.

## 2026-06-15 — Deep onboarding + discover/recommend based on the profile (two streams)
**What:** Onboarding now captures interests, hobbies, likes/dislikes, goals, ASSETS/levers (audience, network, niche), monetization appetite and project types. `discover` and `recommend` read that profile and recommend in two streams (~50/50: general high-return ones + profile-aligned ones even if the monetary ROI is lower), with return understood as monetary OR opportunity, and scope open to any technological solution. Model details in [factory/ideas/decision-log.md](../../factory/ideas/decision-log.md) and DR-039.
**Why:** So the factory recommends things well aligned to the owner (their tastes and assets), not generic ones, and so it isn't limited to monetizable apps.
**Impact:** `plugin/skills/{onboarding,discover,recommend,new-idea}/SKILL.md`, `factory/profile.example.md`, `factory/ideas/_idea-template.md`, `factory/decisions/registry.yaml` (DR-039), `mission-control/prototype/index.html`.

## 2026-06-15 — External services, accounts/secrets, payments (Polar) and Vercel warnings
**What:** New standard `factory/standards/external-services.md` (proven services stack, "1 shared org + 1 primitive per app" account model, API-first provisioning, secrets in SOPS+age, payments with Polar/MoR, owner notification at gates). DR-035..038. Skills/agents: the PRD explicitly states "does v1 include payments?", the blueprint/release warn (warning, not a block) when a version that charges uses Vercel (Hobby = non-commercial, whole-account ban → Pro), and any gate fires a push to the owner.
**Why:** The owner (in Peru) launches many test apps; they need to standardize services, manage accounts/secrets autonomously ("leave it running") and have Vercel be a warning, not an impediment. Direct Stripe doesn't operate in Peru → Polar (MoR).
**Impact:** `factory/standards/external-services.md` (new), `factory/standards/stack.md`, `factory/decisions/registry.yaml` (DR-035..038), `plugin/agents/{product-manager,devops,architect}.md`, `plugin/skills/{spec,blueprint,release}/SKILL.md`, `factory/standards/README.md` (index), `CLAUDE.md`, `plugin/.claude-plugin/plugin.json` (1.1.0 → 1.2.1). Includes §9 (SOPS+age operational setup) and §10 (source-verified foundations).

## 2026-06-14 — Plugin semver versioning (DR-034) + removal of reference to a private project
**What:** The plugin debuts `version` in `plugin/.claude-plugin/plugin.json` (starts at `1.0.0`) and the policy is adopted: bump the version on each change to `plugin/` according to semver (PATCH/MINOR/MAJOR). Also removed were the mentions of an owner's private project that was cited as a reference in `factory/standards/README.md` and `plugin/templates/stack-a-nextjs/STACK.md` — the content is kept as a standard/recommended stack, without tying it to a project no one else can see.
**Why:** The owner asked to version and to have the version always updated according to the size of the change; and for the public repo not to reference a project of theirs that no one else can see. The plugin validator was also warning about the missing `version`.
**Impact:** `plugin/.claude-plugin/plugin.json` (version), `CLAUDE.md` (Plugin maintenance + semver policy), `factory/decisions/registry.yaml` (DR-034), `factory/standards/README.md`, `plugin/templates/stack-a-nextjs/STACK.md`.

## 2026-06-14 — Skill `onboarding` + portable paths (preparation for public repo)
**What:** New skill `/pandacorp:onboarding`: interviews the owner and generates `factory/profile.md` (personal), with bootstrap of `portfolio.md` from the seed. Also, the skills/scripts stopped hardcoding the factory path: `scan-ideas.sh` auto-detects the root (repo root), `spec`/`scaffold` create projects relative to the factory (or the profile's `projects_path`), and `CLAUDE.md.tpl` uses the placeholder `{{FACTORY_PATH}}`.
**Why:** Part of opening up the factory as a reusable template (see [factory/decision-log.md](../../factory/decision-log.md)). Onboarding replaces the owner's hardcoded identity; relative paths make it work on any machine.
**Impact:** `plugin/skills/onboarding/SKILL.md` (new), `plugin/scripts/scan-ideas.sh`, `plugin/skills/{spec,scaffold,new-idea,recommend,explore,sync-portfolio}/SKILL.md`, `plugin/templates/shared/CLAUDE.md.tpl`.

## 2026-06-14 — Plugin decision log created
**What:** The plugin's decision log begins.
**Why:** Part of the factory's "document everything" discipline — see [factory/decision-log.md](../../factory/decision-log.md). Until now, decisions about skills/agents lived only in commits.
