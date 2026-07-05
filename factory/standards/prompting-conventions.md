# Prompting conventions — factory agents & skills

> Domain: Factory operation · Severity: **SHOULD** (PROMPT-4/5 are **MUST**) · Enforcement: manual (edit ritual + fresh-context verifier pass, PROMPT-6) + `claude plugin validate` + the derived-drift gate (frontmatter side). **factory-internal — not injected** into product projects. See DR-114 (2026-07-04, Fable sprint WS3).

How the factory's prompt surface — `plugin/agents/*.md` (14) and `plugin/skills/*/SKILL.md` (25) — is written and edited. These files are consumed daily by **Opus 4.8 / Sonnet-class models**: capable instruction-followers that reason well from goals and constraints, degrade when shouted at in triplicate, and over-trigger on absolutist imperatives written for weaker models. The conventions below keep the prompts effective for the models actually in use without ever softening the factory's governance.

## Rule — PROMPT-1 Goals and constraints over step enumeration

State the outcome the agent owns and the constraints that bind it; enumerate steps ONLY where order is normative (a gate sequence, a state write that must precede another, a TDD cycle). A step list that merely narrates what any competent model would do anyway (read the file → think → edit) is noise that buries the binding steps. Trust the model's judgment inside the constraint envelope — that is what the JUDGE/STANDARD tiers are for.

## Rule — PROMPT-2 Emphasis is a scarce resource

Reserve **bold**, CAPS and "NEVER/ALWAYS/MUST" for the genuinely load-bearing tokens: fail-closed semantics, state-machine words (`VERIFIED`, `IN_REVIEW`, `BLOCKED`), human gates, and the handful of rules whose violation is expensive to unwind. A prompt where every third sentence shouts has no way left to mark what actually matters — emphasis inflation is how load-bearing rules get lost. Never repeat an instruction in multiple phrasings "to make sure": repetition dilutes; one precise statement in the right place binds.

## Rule — PROMPT-3 One rule, one home; origin as pointer, not war story

Each normative rule appears ONCE per file, in the section where it operationally belongs; elsewhere, cross-reference it. Keep the rule's origin as a terse parenthetical — `(DR-072)`, `(BL-0001)`, `(the personal-page-v2 shell-404 incident)` — never as an inline narrative retelling the incident: the story lives in the decision log / lesson, the prompt carries the rule. A paragraph that mixes rule + rationale + exception + anecdote is split so that one bullet = one rule; rationale survives only where it changes behavior (e.g. *why* the fallback order matters when picking one).

## Rule — PROMPT-4 The never-degrade list is verbatim-stable (MUST)

When editing any prompt, the following are copied/moved exactly and never paraphrased, softened or "simplified": **human gates** (production deploy, money, data deletion, external comms, idea selection, design choice); **language rules** (DR-009 — committed English / gitignored Spanish / owner interaction always Spanish); **documentation discipline** (two layers: canonical doc + decision log); **fail-closed gate semantics** (missing harness = RED, ambiguous parse = failure, never "passes by default"); **state-machine contracts** (status tokens, who may write which frontmatter field, file paths of the state layer). A recalibration that touches one of these lines is not a recalibration — it is a governance change and goes through `/pandacorp:learn` + the owner.

## Rule — PROMPT-5 Frontmatter is policy, not prose (MUST)

`name:`, `description:`, `tools:`, `disallowedTools:`, `model:` and `effort:` pins are contracts (DR-111 tiering; the Codex mirrors are generated from them). A prompt edit never changes frontmatter silently: a `model:`/`tools:` change is its own decision with its own decision-log entry. `description:` stays the trigger-optimized summary (it is what the orchestrator and the owner's slash menu match on) — keep it accurate, front-loaded, and behavior-complete.

## Rule — PROMPT-6 Fresh-context verification of every prompt edit

After recalibrating a prompt file, an INDEPENDENT fresh-context pass (a different agent, or at minimum a separate verification turn that reads only old + new) extracts every normative element from the OLD text — rules, gates, thresholds, file paths, state tokens, DR/BL/LESSON references — and asserts each survives in the NEW text, or is explicitly listed as an intentional removal with its reason in the decision log. This is constitution rule 4 (agents never check off their own checks) applied to prompt surgery: the author of a rewrite is blind to what it dropped.

## Rule — PROMPT-7 Skimmable shape

Agent files target ≤ ~120 lines; a section a maintainer cannot skim in one screen gets subsectioned or tabled. Prefer: the role in one line → the binding rules (grouped by lens/concern) → the SOP/hand-off contract. Shared boilerplate that must appear in several agents (e.g. the memory-RETRIEVE block, DR-047) is kept byte-identical across them (grep-verifiable) so a future change can sweep it mechanically — divergent near-copies are how sweeps decay (audit-20 D2).

## How it is verified

- **PROMPT-4/5:** the fresh-context verifier pass (PROMPT-6) checks them per edit; frontmatter drift additionally trips `check-derived-drift.sh` (the Codex TOMLs regenerate from frontmatter+body) and `claude plugin validate`.
- **PROMPT-1/2/3/7:** manual — reviewer/self-check at edit time against this file; the owner spot-checks.
- **PROMPT-6:** review-only (the edit ritual itself); its evidence is the verifier's checklist recorded in the editing session/decision log.

## Why

The prompt surface was written incrementally across model generations; prescriptive scaffolding that once helped weaker models now *reduces* quality on Opus 4.8/Sonnet — over-triggered tools, mechanical compliance over judgment, and load-bearing rules buried in emphasis inflation and thousand-word paragraphs. But every clause in these prompts traces to a DR or a paid-for incident, so the failure mode of "clean it up" is silently dropping a rule that exists because something broke (the ACE context-collapse trap: a wholesale rewrite erodes accumulated detail). These conventions thread that needle: recalibrate the *form* for the models in use, verify the *content* survived, and treat governance lines as untouchable.
