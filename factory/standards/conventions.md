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
- **Name concrete referents — never a vague "the current tool / the app / the extension / the leader".** When you mention a specific product, app, extension, library, endpoint, file or competitor, NAME it exactly (e.g. `Improve Crunchyroll`, not "the current extension"); if the owner hasn't met it in this conversation, gloss it in one line. Without the name the owner cannot follow what you mean — an abstract reference is not context (owner-stated, 2026-07-11).
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

## Rule — claims and diagnoses: evidence before assertion

> Severity: **MUST** · Enforcement: manual (agent self-check before asserting or before building a diagnosis/fix plan on a stand-in; owner spot-check). Operative form: `plugin/templates/shared/AGENTS.md.tpl` §Language & interaction (DR-051). Owner-stated 2026-06-20 ("verify-before-telling", after repeated wrong state claims); codified 2026-07-15; widened 2026-09-03 to internal diagnoses and fix plans (promoted from `LESSON-0069`, a 7-instance synthesis across panda-corp + personal-page-v2).

**Scope: every factual claim any agent makes to the owner about the state of code, data, systems or processes — in the factory and in every product project, under any runtime — AND every internal diagnosis, fix plan or "done" declaration built on such a claim, even when nothing is said to the owner.** It governs statements of fact; it does not slow down opinions, recommendations or plans, which are visibly judgment.

- **No claim without an observation.** A statement of fact is anchored to something observed with a tool in the CURRENT session: a file read (`file:line`), a command's output, a live fetch/query. Never asserted from conversation context, training memory, or "a quick look" — the owner works across several parallel sessions, so this conversation's context is routinely stale.
- **Measure real state; recorded state is a claim, not evidence.** A flag (`running: true`), a status field, a cached count or a prior audit's finding was written by some writer at some time — cross-check it against live signals (mtime vs now, a live process listing, the actual current content) before repeating it. This is the chat-facing face of constitution §22/§24 and of the machine-surface rules DR-066/DR-068.
- **A subagent's report is a claim too.** A fact reported by a delegated agent — especially a cheap-tier scan — is re-verified before the lead agent asserts it to the owner or builds on it (the LESSON-0027 audit-snapshot rule, generalized).
- **The rule binds BEFORE the assertion, not only at it.** A doc, a past audit finding, a recognized failure pattern, a self-review, a recorded flag: each is a *stand-in* for the live artifact and can silently diverge from it. Before diagnosing a failure, building a fix plan, or declaring something done on top of one, insert one direct, tool-mediated read of the live artifact — the current code/frontmatter/state (not the audit that described it), the actual computed value (not the doc's claim about it), the real HTTP response (not the `phase` flag), a literal fact-by-fact diff (not a confident holistic re-read), and a check from the actual consuming runtime (not the one that built it). Ground truth beats a stand-in for ground truth, always.
- **Label the unverified.** What could not be verified is said as such ("no lo he verificado") or stated as a hypothesis with the concrete check that would confirm it — never delivered with the same confidence as observed fact. When uncertainty remains, investigate more instead of guessing.

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

## Rule — verified traps (each cost the factory the same bug twice)

> Severity: **SHOULD** · Enforcement: review-only + the greppable `matter(` check below. Promoted 2026-09-03 from `LESSON-0005`, `LESSON-0009` and `LESSON-0103` — each corroborated on two distinct projects, each rediscovered from scratch the second time.

- **Never compare ISO-8601 timestamp strings lexicographically** to pick the most recent one unless every producer is verified to stamp the identical offset AND the identical fractional-second precision (`…42Z` sorts *after* `…42.920Z` as raw characters). Compare via `Date.parse` at the point of comparison, or — when you own every emitter of a shared stream — pin one timestamp format at every emitter so the invariant holds structurally (`LESSON-0009`).
- **`gray-matter@4` caches on the raw content string.** Always call `matter(content, { excerpt: false })`, never bare `matter(content)`: the internal LRU is keyed by content, so a second parse of the same string returns the cached result — and a first call that threw on malformed YAML still populates it, so the second call silently returns `{ data: {} }` instead of throwing. Round-trip check: `matter.stringify()` always appends a trailing newline, so normalize it before diffing written output against the pre-write body (`LESSON-0005`).
- **`git add <path>` on an already-tracked file under a later-gitignored directory is refused** — and the refusal can persist even when `git check-ignore` on that exact path reports nothing. Try `git add -u -- <path>` first (only touches tracked paths, skips the ignore check); fall back to `git add -f -- <path>`. Never weaken `.gitignore` to work around it (`LESSON-0103`).

## Rule — user-facing copy voice

> Severity: **SHOULD** · Enforcement: reviewer + a `grep` check where an automated content pipeline exists. Operative form: `rules/code-conventions.md` (DR-051). Owner-stated 2026-07-09; promoted 2026-09-03 from `LESSON-0123`.

- **The em dash (`—`), and the en dash (`–`) used as a sentence separator, are banned from user-facing product copy** — UI strings, i18n messages, MDX pages, blog posts, metadata, and anything an automated content generator drafts. They are the most reliable single tell of AI-generated prose. Substitute a period, colon, comma or parentheses. A normal hyphen inside compound words and a middle dot (`·`) as a structural separator stay fine.
- This binds **product copy only** — not code, not committed technical docs, not the factory's own prose, and not chat with the owner (CONV-11). Where a content pipeline exists, make it a mechanical check on the pipeline's output (`grep` for the two characters), not a guideline a human remembers to apply.

## How it is verified
- **Typing**: `tsc --noEmit` with `strict: true` (`verify.sh` gate, fail-closed); `any`/`@ts-ignore` → Biome `noExplicitAny` as error. `mypy --strict` on Python stacks.
- **Imports**: Biome organize-imports + the `@/*` alias in `tsconfig` (toolchain conformance check on `/pandacorp:upgrade`); deep-relative imports → review-only.
- **Secrets**: gitleaks (pre-commit hook + platform push protection); `.env.example` sync → review-only (reviewer checklist).
- **Naming, handlers, constants, boundary validation**: review-only (`reviewer` quality lens); boundary validation is also exercised indirectly by the adversarial/malformed-input tests (DR-015/DR-078, `quality.md`).
- **Language (committed=English), Conventional Commits, no force-push**: review-only.
- **Claims and diagnoses (evidence before assertion)**: manual — agent self-check before asserting *or* before building a diagnosis/fix plan on a stand-in, plus owner spot-check; the build-side counterpart is wired (the Stop gate's `verify.sh` + DR-068's fenced run-state receipts), the chat and diagnosis sides are judgment calls by nature.
- **Verified traps**: `matter(` called with a single argument is greppable (a lint/CI candidate); the timestamp and `git add` traps are review-only — they are recognized at the moment the symptom appears, not prevented by a gate.
- **User-facing copy voice**: a `grep` for `—`/`– ` over the copy surface (i18n messages, MDX, generated drafts) is the mechanical check where a content pipeline exists; hand-written copy is reviewer + owner spot-check.

## Why
Uniform conventions let any agent (or the owner) drop into any project cold: naming carries intent, strict typing turns a class of runtime bugs into compile errors, and the language rule keeps the public repo professional while the owner operates in Spanish. What a linter can hold, the linter holds; the rest is cheap for a reviewer to spot and expensive to leave inconsistent.
