---
description: Incorporates durable know-how into the Pandacorp factory — an engineering standard, a decision rule, or a new plugin skill (the skill's authoring and evaluation are delegated to the native skill-creator skill). Use when the owner wants to add/adjust a convention, a pre-approved default, or a new capability that will be injected into projects. Runs IN the factory (panda-corp).
---

# /pandacorp:learn

It teaches the factory something **durable** (the factory learns it): a **standard** (`factory/standards/`), a **decision rule** (`factory/decisions/registry.yaml`), or a new plugin **skill**. It is what the "New standard" / "New decision rule" / "New skill" buttons in Mission Control trigger. Runs IN the factory. (It used to be called `codify`.)

`$ARGUMENTS` (or the conversation): what you want the factory to learn, in plain language (e.g.: `/pandacorp:learn "every form must have anti-spam protection"`).

**Two entry points:** (a) the owner teaches something fresh; or (b) you **promote a lesson from `factory/memory/`** that `/pandacorp:memory` + the `librarian` surfaced. `learn` is the **apply / promote stage** of the self-learning loop (DR-047): harvesting and proposing live in `/pandacorp:memory`; here you turn a durable, corroborated lesson into a standard / decision rule / skill — under the eval-gate (it ships with its verifier) **and** the owner gate. Promotion is HIGH-RISK (DR-047): always the owner's call.

## Steps

1. **Classify** what the owner is asking for: is it a **standard** (a rule for how things are built, injected into projects), a **decision rule** (a pre-approved default so the AI doesn't ask every time), or a **skill** (a new capability/command)? If it's ambiguous, ask.
2. **Research the minimum** (delegate to the `researcher` if needed): concrete values, best practices, how it is verified. What the owner says is high-level; make it concrete.
3. **If it is a STANDARD:**
   - Decide the **domain** (Programming, Architecture, Design, Technology, Quality, Security, Operations, Data/Privacy, Product/Docs) and whether it goes in an existing file or a new one (`factory/standards/<slug>.md`).
   - Write it in the **"executable standard"** form: **Rule** (categorical) · **How it is verified** (binary check, pluggable into `verify.sh`/CI) · **Why** (rationale). Mark the **severity** (MUST/SHOULD/MAY) and **enforcement** (lint/CI/checklist/human gate).
   - If it introduces something verifiable, say how it enters the gate (lint rule, test, CI step).
   - Update `factory/standards/README.md` (index + category).
   - **PROPAGATE to projects (mandatory, DR-051) — a standard that isn't injected is dead on arrival.** If the standard governs how projects are built (most do), reflect it in the **injectable rule library** so it actually reaches every project:
     - **General (all-stack)** → edit/add the matching file in `${CLAUDE_PLUGIN_ROOT}/templates/rules/` with `applies_when: always`.
     - **Tech-specific** → the matching `rules/*.md` with the right `applies_when` token (`react`/`nextjs`/`tailwind`/`prisma`/`next-intl`/`posthog`/`sentry`/`web-ui`/`public-web`); if it's a brand-new technology bucket, add a new `rules/<slug>.md` **and** register it in `rules/README.md`'s catalog + the `applies_when` table.
     - **Hard-enforceable** (lint/typecheck/test) → also wire it into the relevant `templates/stack-*/STACK.md` lint config / `verify.sh` so violations FAIL the gate, not just sit in prose.
     - **Bump `${CLAUDE_PLUGIN_ROOT}/templates/OVERLAY_VERSION`** (same MAJOR for a compatible rule change) — this is the trigger that makes `/pandacorp:upgrade` carry the change into existing projects on their next skill run. A standard change that skips the rule library + OVERLAY bump never reaches projects (this is exactly the drift that motivated DR-051).
   - Factory-internal-only standards (build orchestration, the factory's own ops) don't ship to projects → no rule-library change; note that explicitly so it's a decision, not an omission.
4. **If it is a DECISION RULE:**
   - Add `DR-NNN` to `registry.yaml` with `pattern`, `default` (the pre-approved behavior), `requires_human` (true/false) and `note` if needed. If the values live in a standard, **point to it** (don't duplicate them).
5. **If it is a SKILL (create or improve) — DON'T reinvent: delegate to `skill-creator` (native):**
   - **Justify first.** A skill is created from a **measured and recurring gap** (deviations in `.pandacorp/comms/progress.md`, the `reviewer`'s findings, repeated calls to the `researcher`, golden-path deviations), not from a hunch. Without a recurring gap, it is almost never a skill — reconsider it as a standard, or as nothing.
   - **Authoring + evaluation with `skill-creator`.** Have the native skill create/edit the `SKILL.md` and run its eval (baseline-vs-skill with assertions + optimization of the description for triggering, with holdout). **Accept only if** the benchmark (delta vs baseline) and the triggering precision improve. To improve an existing one: preserve its name/directory, snapshot the old one, baseline-vs-new.
   - **Place it in the plugin, following the naming convention (mandatory):** the directory is `plugin/skills/<slug>/SKILL.md`, where `<slug>` is **kebab-case, in English, WITHOUT the `pandacorp:` prefix** (the prefix is added automatically by the plugin namespace); the body H1 is `# /pandacorp:<slug>`. So a skill at `plugin/skills/review-launch/` is invoked as `/pandacorp:review-launch`. NEVER put the `pandacorp:` prefix in the directory name nor in a `name:` frontmatter field — every skill is reached as `/pandacorp:<slug>`, uniformly. **Tight** description (use case first, ≤1,536 chars; include what it does AND when to trigger). `disable-model-invocation: true` if it has side effects. Watch the description budget with `/doctor`.
   - **If instead of creating you are going to ADOPT an external skill:** never auto-install. Audit it (the `security-auditor`'s lens: `allowed-tools`, `!`shell``, MCP, environment variables), **vendor a pinned copy** inside the plugin, and treat it as a dependency (DR-001). First-party (`anthropic-skills`) = high trust; community = reference + vendored, never direct installation.
   - **It is an owner gate**: creating or adopting a skill is something you approve.
6. **Confirm to the owner** what was created/changed and where. Remember the activation step: **commit + `claude plugin update pandacorp@panda-corp` + restart** (if you touched the plugin) — Mission Control warns of the drift (FRD-15).

## Rules

- **Don't invent values**: if you don't know the correct threshold/value, research it or ask. A standard without a concrete verifier is prose, not a contract.
- **Reuse before creating**: if it fits in an existing file (`quality.md`, `patterns.md`…), expand it instead of creating a new one. For skills: a skill with internal variants (`references/`) rather than many near-duplicates — *sprawl* saturates the description budget and causes triggering collisions.
- **Don't reinvent the native stuff**: for skills, `skill-creator` does the authoring and the evaluation; `learn` only adds the owner gate, the placement in the plugin, the security policy and the activation ritual.
- **Skill naming is fixed and uniform:** every skill is `plugin/skills/<kebab-slug>/SKILL.md` (slug in English, NO `pandacorp:` prefix) and is invoked as `/pandacorp:<slug>` — the namespace adds the prefix, so never hardcode it in the directory or a `name:` field. A new skill must match all the others (e.g. `review-launch` → `/pandacorp:review-launch`).
- New `MUST`s that could break in-flight projects (strict CSP, a11y-gate): introduce them first as `SHOULD`/warning and promote them when they mature.
- PRODUCT decisions (what to build) don't go here — that's `iterate`/`spec`. `learn` is only for the HOW (standards), the governance (decision rules) and the capabilities (skills).
- **Self-learning loop (DR-047):** promoting a `factory/memory/` lesson into a standard/DR/skill is the loop's apply stage and is HIGH-RISK → always the owner gate + the eval-gate (a new standard ships with its verifier; a new skill passes `skill-creator`'s benchmark). A lesson reaches you with **`promotion: proposed`** (queued by `/pandacorp:memory review`). After promoting, **back-link**: add the new standard/DR/skill to the source lesson's `links:` and set **`promotion: approved`**, so the lineage is traceable. If the owner rejects, set **`promotion: rejected`** (it stays a useful lesson, just not a rule). Never delete the lesson.
