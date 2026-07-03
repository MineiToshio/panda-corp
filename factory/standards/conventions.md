# Code conventions

> Domain: Programming · Severity: **MUST** · Enforcement: lint (Biome/tsc) + CI gate (gitleaks) + `reviewer`; the language rule is review-only. Operative form: `rules/code-conventions.md` (DR-051). See DR-009 (language).

## Rule — language: committed = English / gitignored = Spanish

**The state in git decides the language of the text.** This way anyone who clones the repo sees everything in English, and the owner operates Pandacorp in Spanish. Each artifact is born already in its correct language: there is no on-the-fly translation layer.

- **Code 100% in English**: variables, functions, types, comments, logs, commit messages.
- **File and folder names ALWAYS in English**, regardless of the content's language.
- **Product/technical documents → English and committed**: PRD, FRDs, blueprint, ADRs, README, API contract, tests, and the project's `docs/decision-log.md` (the product's real history).
- **Communication with Pandacorp → Spanish and gitignored** (local layer, regenerable, does not travel with the repo): project summary, decision points (`.pandacorp/inbox/decisions.md`), logs, activity, Mission Control feed, and `.pandacorp/comms/iteration.md`.
- **`.pandacorp/status.yaml` → committed, machine state only in English** (keys, enums, counters, SHAs); the human-readable prose (progress, pending items) lives in the gitignored Spanish layer. Mission Control maps the values to Spanish labels.
- **Gitignored machine-read frontmatter** (idea cards `factory/ideas/*.md`, `factory/profile.md`): the **keys and enum values are machine state → always English** (`status`, `project_type`, `return_type`, `origin`, `profile_alignment`…), even though the prose **body** is Spanish. The board and the skills parse this frontmatter; a Spanish enum value (e.g. `project_type: ambas`) breaks them. Only the free-text body and human-facing fields are Spanish.
- **User-visible content** (UI): never hardcoded — it goes in i18n (`src/i18n/locales/<locale>/*.json`); **i18n-ready always, and the default/launch locale comes from the product's launch-language research (DR-041), not automatically Spanish**. Emails included. UI copy is the one **committed exception** to English (it's end-user content, not code; only the code/identifiers around it stay English). **Mission Control** is a special case — the owner's own tool, always in Spanish; product apps follow their launch-language decision.
- **Conversation with the owner → always Spanish**: everything the agent says in chat and inside any skill (questions, explanations, progress, recommendations, summaries) is in Spanish, regardless of the artifact's language. The agent writes English into committed artifacts but **always addresses the owner in Spanish**. (Artifact language and interaction language are two different axes: the former depends on git state; the latter is always Spanish.)

> **Resuming on another machine:** what is committed (FRD/PRD/work orders/`status.yaml`) is the truth for resuming; the Spanish layer is a local view that regenerates. That is why you close/advance a phase before jumping machines: the in-flight feedback in `.pandacorp/comms/iteration.md` is local and, on advancing, its conclusions land in the committed English doc.

## Rule — interaction style

> Severity: **SHOULD** · Enforcement: manual (agent self-check each turn; owner spot-check). Operative form: `rules/code-conventions.md` (DR-051). See DR-110.

**Scope: the lead agent's owner-facing replies only** (what actually reaches the owner's chat, in the factory and in every product project). This rule does NOT apply to:
- **Product/UI copy** of any application (Mission Control included) — that stays governed by the `copywriter` agent and the i18n rule above.
- **Orchestrator↔subagent communication** (`Agent`/`Task` prompts and the results subagents return) — internal coordination stays whatever shape is most effective for the agents involved; this rule does not propagate inward.

When replying to the owner:
- **Mark where the real answer begins.** Progress narration while working (tool calls, research) stays to short one-line updates. Once the substantive answer starts, set it apart with a horizontal rule (`---`) followed by a short bold label (e.g. **Respuesta:**) — the owner should never have to guess whether a line is a status update or the answer.
- **Concise and scannable by default.** Lead with the conclusion/recommendation; add supporting detail only if needed. Short paragraphs and bullets over walls of text.
- **Clean, skimmable formatting.** Headers/subheaders for anything with parts, bold for key terms and conclusions — the owner should get the gist from a quick scan without reading every line.
- **High-level by default, technical on request** — or when the topic itself demands precision (security, money, data loss, irreversible actions), go technical without being asked.
- **Storytelling over jargon.** Prefer analogies and plain narrative to explain technical concepts, unless the owner asked for the technical version.
- **Visualize complex mechanisms.** When explaining a flow, a skill's internal steps, an algorithm, or anything with enough moving parts that prose alone would be hard to follow, generate a diagram/widget instead of describing it in paragraphs. Fall back to a numbered-step sketch only if no visual tool is available.
- **Red-team proposals that require judgment** (a design choice, an architecture call, a plan) — surface the strongest counterargument before agreeing; never rubber-stamp. Skip this for simple statements, questions, or greetings that don't call for analysis.
- **Human, empathetic tone — but disagreement stays substantive**, not softened into agreement.

## Rule — subagent model selection

> Severity: **SHOULD** · Enforcement: manual (agent self-check before each ad-hoc delegation; owner spot-check). Operative form: `rules/code-conventions.md` (DR-051). See DR-111.

**Scope: any delegation to a subagent (the `Agent` tool, or `agent()`/`pipeline()`/`parallel()` inside a `Workflow` script) where the model is NOT already pinned by the subagent's own definition.** This rule does NOT reopen what's already solved:
- Pandacorp's own named agents (`plugin/agents/*.md`) already declare a static `model:` in their frontmatter (e.g. architect/designer/reviewer/product-manager/copywriter → `opus`; implementer/backend-dev/frontend-dev/test-writer/researcher/security-auditor/librarian/analytics/devops → `sonnet`) — invoking one by its `subagent_type` needs no extra calculation.
- The build engine's own adaptive escalation inside `/pandacorp:implement` (`pickWorkerModel`, DR-073, sonnet floor + opus escalation on `difficulty: high`/`reopen_count >= 1`; mechanical steps on the cheap tier, DR-108) is already the correct, calibrated instance of this same principle for work-order execution.

**The rule:** when delegating without an explicit model, calculate the tier from the SUBTASK's complexity — never default to matching the parent conversation's own tier (a session running on Opus or Fable must not silently fan out subagents at that same expensive tier for work that doesn't need it):
1. **haiku** — zero-judgment, mechanical, short output: a commit message, a rename, a one-line text/copy tweak, a lookup/grep-and-report, formatting.
2. **sonnet** — the default floor for real work: implementation, research/summarization fan-out (e.g. each leg of a deep-research), most subagent execution, medium analysis.
3. **opus** — genuine judgment/high complexity: architecture/blueprint decisions, adversarial review, open-ended synthesis, red-teaming a proposal, anything where a wrong call is expensive to unwind.
4. **fable** — NEVER chosen automatically. Only used when the owner explicitly asks for it, or when the agent sees a genuine benefit and asks the owner for confirmation BEFORE launching it — never a silent default, never "just in case."

Escalate upward, never downward, if a first attempt at a lower tier comes back inadequate (same empirical spirit as DR-073's `reopen_count` escalation, generalized outside the build engine).

## Rule — naming
| Element | Convention | Example |
|---|---|---|
| Files and folders | camelCase | `userProfile.tsx`, `lib/auth/` |
| Variables and functions | camelCase | `fetchOrders()`, `isLoading` |
| Types / interfaces | PascalCase | `User`, `OrderStatus` |
| Components | PascalCase | `Button`, `UserCard` |
| Constants | UPPER_SNAKE_CASE | `APP_NAME`, `ROUTES` |
| Event handlers | `handle*` | `handleSubmit()` |
| Hooks | `use*` | `useUser()` |
| Booleans | `is/has/can*` | `isOpen`, `hasError` |

## Rule — typing
- Strict typing ALWAYS (`tsconfig` with `strict: true`; in Python `mypy --strict`).
- Prefer `unknown` over `any`. `any` and `@ts-ignore` forbidden.
- Explicit return types on public functions. Non-null assertion (`!`) as a last resort.

## Rule — constants and no magic values
- No repeated inline magic strings/numbers. Extract to `src/lib/constants.ts` (`ROUTES`, `APP_NAME`, analytics events, etc.).
- **Not magic numbers** (no constant needed): Tailwind utility values (`w-[360px]`, `gap-2`) and literals passed to clearly-named props (`size={20}`, `maxLength={50}`) — they are self-describing in place.

## Rule — environment variables
- Keep `.env.example` in sync **in the same change** that introduces a new variable, grouped by section with a short comment on what it is for and how to obtain it. Never commit real values (secrets → SOPS/`.env`, DR-037).

## Rule — boundary validation
- Validate all external input (Server Actions, route handlers, APIs) with schemas (Zod or equivalent). Centralize the schemas, not inline.

## Rule — imports
- Absolute alias `@/*` → `./src/*`. Avoid relative imports more than one level deep (`../../..`).

## Rule — handlers
- No inline logic in JSX: use named handlers (`const handleClick = () => {...}`).

## Rule — comments and commits
- Comments explain **why/what**, not references to tickets/issues/epics in the code.
- **Conventional Commits** with scope, in English: `feat(orders): add table selection`, `fix(api): handle null response`.
- **Direct push to `main` is allowed** (solo operator): no mandatory feature-branch/PR — the quality gate is the `implement` reviewer + `.pandacorp/verify.sh`, not human review. **Never force-push**; use a throwaway branch only for big/risky changes you may want to abort wholesale.

## How it is verified
- **Typing**: `tsc --noEmit` with `strict: true` (`verify.sh` gate, fail-closed); `any`/`@ts-ignore` → Biome `noExplicitAny` as error. `mypy --strict` on Python stacks.
- **Imports**: Biome organize-imports + the `@/*` alias in `tsconfig` (toolchain conformance check on `/pandacorp:upgrade`); deep-relative imports → review-only.
- **Secrets**: gitleaks (pre-commit hook + platform push protection); `.env.example` sync → review-only (reviewer checklist).
- **Naming, handlers, constants, boundary validation**: review-only (`reviewer` quality lens); boundary validation is also exercised indirectly by the adversarial/malformed-input tests (DR-015/DR-078, `quality.md`).
- **Language (committed=English), Conventional Commits, no force-push**: review-only.

## Why
Uniform conventions let any agent (or the owner) drop into any project cold: naming carries intent, strict typing turns a class of runtime bugs into compile errors, and the language rule keeps the public repo professional while the owner operates in Spanish. What a linter can hold, the linter holds; the rest is cheap for a reviewer to spot and expensive to leave inconsistent.
