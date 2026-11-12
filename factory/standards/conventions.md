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
- **Decisions are the exception to "concise by default".** When you put a decision to the owner, completeness beats brevity: use the decision card (CONV-20, next rule below). The formatting rules here (scannable, named referents) still apply inside it.

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

## Rule — decisions presented to the owner: the decision card (CONV-20, DR-148)

> Severity: **MUST** · Enforcement: manual (agent self-check before presenting a decision; owner spot-check; reviewer checklist when a skill's question template is authored). Operative form: `plugin/templates/shared/AGENTS.md.tpl` §Language & interaction (DR-051). Owner-stated 2026-11-10.

**Scope: every decision a skill or agent puts to the owner, in the factory and in every product project, under any runtime** — a choice between two or more reasonable alternatives, or a choice with a cost, risk or irreversibility the owner has not been shown (stack, scope, spending, priorities, a promotion or a discard, a gate that has an alternative). It does NOT cover: a bare go-ahead for one action the owner already asked for and understands; browsing a list the owner asked to see (e.g. `discover` teasers, which keep their own widget); product/UI copy; orchestrator↔subagent traffic. When in doubt it is a decision.

1. **As text in the chat, always.** The decision reaches the owner as ordinary chat text. It may ALSO live in an artifact, a document, a widget, a file or an `AskUserQuestion` picker, but never ONLY there: a link, a file path or a picker is a convenience for reading or answering, never the carrier. The chat text alone must let the owner decide.
2. **Three parts, in this order, in Spanish** (the owner-interaction language, CONV-1), under a bold title line (`**Decisión: <short title>**`; with several decisions, `**Decisión N de M: <short title>**`):
   - **Contexto** — ONE punctual paragraph (no bullets, no sub-sections), written as if the owner knew nothing about the topic. In that paragraph: what the piece is and what it does; how it works today; why it must be decided now; what happens if it is not decided (including any default that would apply). Explain every technical term the first time it appears, in plain words. Name every product, file or tool exactly (CONV-11). Every figure says whether it was **measured** (source and date) or is a **projection/estimate**, and "not verified" when it is neither (CONV-13). Punctual means no history, no tangents and no detail the choice does not hinge on; completeness of the facts the decision needs stays mandatory.
   - **Opciones** — lettered **A.**, **B.**, **C.**, **D.**… one bullet per option, each punctual: a bold label (**A. <name>.**) then what would be done, what is gained, what it risks or costs (money, time, effort, reversibility, what the owner would have to operate). An option MAY carry its own extra context when the owner could not understand it otherwise (a term, a prior case, a precondition), still inside that option's bullet. "Do nothing / defer" is its own lettered option when it is a real option.
   - **Recomendada: <letter>** — exactly ONE option, then why, then what would change your mind. "It depends" is not a recommendation; red-team it first (CONV-11). The letter is the one the options use, so the owner can answer with a single letter.
   - Canonical example (shape, not content):

     ```markdown
     **Decisión: ¿dónde guardamos las fotos de producto?**

     **Contexto:** la app muestra una foto por cada figura del catálogo y hoy las lee directamente de la web del fabricante (se "enlazan": no las guardamos, solo apuntamos a su dirección). Hay que decidirlo antes de construir la ficha de producto, porque cambiarlo después obliga a tocar el modelo de datos (estimado: unas 20 tareas). Si no se decide, el valor por defecto es enlazar. Medido el 2026-10-17: las direcciones responden bien desde un cliente que no es navegador y no bloquean el embebido.

     **Opciones:**
     - **A. Enlazar la dirección oficial.** Cero costo y cero trabajo; riesgo medio: sin licencia, mitigado con crédito y retirada a pedido.
     - **B. Servirlas por un proxy del mismo origen.** Igual de barato, algo más de trabajo; resuelve el caso en que el fabricante bloquee el embebido. Un "proxy" es un pequeño intermediario nuestro que pide la foto por nosotros.
     - **C. Copiarlas a nuestro almacenamiento.** Unos 0,5 USD/mes (estimado) y más trabajo; riesgo alto: sería una copia sin licencia.
     - **D. Posponerlo.** Ficha sin foto por ahora; sin riesgo, pero el producto se ve incompleto.

     **Recomendada: A.** Es lo más barato y reversible, y el riesgo legal tiene mitigación. Cambiaría a B si un host bloquea el embebido.
     ```
3. **Several decisions at once: one card per decision, ordered by urgency** (what blocks work or has a deadline first), preceded by a list with ONE line per decision (number, title, "Recomendada: <letter>"). Each card stands alone: repeat the context it needs instead of pointing at another card. Never bundle decisions into a single approval ("approve the stack").
4. **A picker comes after the text, never instead of it.** `AskUserQuestion` (or a widget) carries the same lettered short labels ("A. <name>"), the recommended one first and flagged; the context, the options' trade-offs and the recommendation are already in the chat message.
5. **Persisted copies carry the same three parts and the same lettered options** (the decisions inbox, a decision brief, an ADR); a persisted copy never replaces the chat text with a link.

Within a card the CONV-11 formatting still holds (bold title, bullets, no walls of text). Good formatting is part of the rule: one paragraph of context, one bullet per option, the recommendation set off in bold. A decision card is not shortened by dropping facts the choice needs; it is kept punctual by cutting everything the choice does not need.

Amended 2026-11-12 (owner-stated): context is ONE punctual paragraph for a novice, options are lettered A, B, C, D (each may carry its own context), the recommendation names its letter (DR-148 addendum).

## Rule — clean up after yourself (CONV-21)

> Severity: **MUST** · Enforcement: manual (agent self-check at task close; owner spot-check) plus the `block-dangerous.sh` gate, which lets a recursive delete of a specific named path through and still blocks broad targets. Operative form: `plugin/templates/shared/AGENTS.md.tpl` §Language & interaction. Owner-stated 2026-11-12.

**Scope: every agent in the factory and in every product project, under any runtime, when a task closes.**

- **Remove what you created and no longer need, without asking the owner to run anything.** The git worktrees you made (`git worktree remove <path>`, or `ExitWorktree` with `remove`; the branches stay, so no work is lost) and every scratch, research, experiment or temporary file or folder (the session scratchpad, `/tmp/...`, throwaway clones, build output). Do it yourself, in the same turn that closes the task; never hand the owner a list of `rm`/`git worktree remove` commands to run.
- **Never another session's work.** Do not delete a worktree you did not create, a worktree that is locked or serves a local deployment (DR-089), a path holding uncommitted or unmerged work, or anything under the protected state layer (`.pandacorp/`, `factory/{ideas,memory,profile,portfolio}`, BL-0035). When ownership or cleanliness is unclear, check (`git status`, `git worktree list`) before deleting; if still unclear, leave it and say so.
- **The gate is not the permission boundary.** `block-dangerous.sh` allows a recursive delete of a specific, named path (a deep path, a relative name after `cd`, a temp or scratch dir, a worktree, `node_modules`, `.next`, `dist`, `build`) and blocks a broad one (`/`, `~`, `..`, a temp root or shallow folder, a shallow glob, an unresolved variable with nothing after it). A block means the target was too broad: name the specific directory, do not ask the owner to run it.

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

## Rule — URLs always in English (CONV-18, DR-139)

> Severity: **MUST** · Enforcement: reviewer quality lens + architecture readiness checklist (route map) + `/pandacorp:release` checklist. Owner decision 2026-10-23.

Every URL a product exposes is English, **100% of the time, whatever the app's language** (Spanish, Japanese, French…). The UI copy is localized; the address is not.

- **Route segments and page paths**: `/collection`, `/settings/profile`, `/items/[itemId]`, never `/coleccion`, `/ajustes/perfil`. This includes App Router folder names (`app/collection/page.tsx`), route groups, dynamic-segment names and the `ROUTES` constants.
- **API paths, query-string keys and fixed query values**: `/api/v1/orders?status=pending&sort=newest`, never `?estado=pendiente`.
- **Multilingual apps**: the locale prefix is the only language marker (`/es/collection`, `/fr/collection`); the path after it stays English. Never translate pathnames per locale (no next-intl `pathnames` map, no localized rewrites).
- **Slugs generated from data**: build them from the record's stable ID or an English/canonical slug field; a proper name keeps its spelling transliterated to ASCII kebab-case (`/figures/son-goku`), but a common word never becomes a Spanish (or other non-English) path segment.
- Specs and designs name routes the same way: FRDs, FDDs, prototypes, blueprints and work orders write English paths even when their prose quotes Spanish UI text. Existing projects keep their URLs until a change of their own migrates them (with redirects); upgrade never renames routes.

## Rule — GitHub access through gh CLI (CONV-19)

> Severity: **MUST** · Enforcement: checklist (review-only; reviewer tool-call audit). Owner decision 2026-10-24. Operative form: `rules/code-conventions.md` (`applies_when: always`).

**Rule:** Whenever an agent interacts with GitHub, use the `gh` CLI with the owner's existing keyring authentication. This includes pull requests, issues, CI/Actions status and logs, API calls and releases. Use the relevant `gh` subcommand or `gh api` for REST/GraphQL operations; never use the GitHub MCP connector or bypass `gh` with a direct HTTP client, SDK or browser automation. If `gh` or its authentication is unavailable, report the blocker instead of switching access paths. Do not extract, print or copy keyring tokens. Existing owner gates still apply to the operation being performed; choosing `gh` grants no additional authorization. Ordinary local Git and Git transport remain governed by the Git convention.

**How it is verified:** At handoff, the reviewer's GitHub-access checklist inspects the session's executed tool calls/commands: every GitHub service operation must use `gh`, and there must be zero GitHub MCP or alternate service-access calls. A single violation fails this checklist; no GitHub operations means not applicable. This is review-only, not a lint/CI or `verify.sh` guarantee: repository text alone cannot prove which runtime tools were executed.

**Why:** The owner reported that the GitHub MCP connector failed with an invalid token while `gh` worked with the owner's keyring authentication. Standardizing on that authenticated path avoids divergent credentials and repeated connector failures.

## Rule — project skill names (CONV-17, DR-137)

> Severity: **MUST** · Enforcement: `.pandacorp/check-project-skills.mjs`, called by `doc-lint.sh` / `verify.sh`, plus the skill-authoring review for runtime-specific packaging.

Every new or explicitly renamed skill for a product project has the public name `<project-slug>:<skill-slug>`, with both parts in English kebab-case. Use the project's canonical `project` value in `.pandacorp/status.yaml`, not a display title. For example, `funko-tracker:ingest-catalog` and `funko-tracker:ingest-delta`. Use `ingest-delta` for an incremental-ingestion skill.

- In standalone Claude Code project skills, keep the directory slug (`.claude/skills/ingest-delta/`) and set `name: funko-tracker:ingest-delta`; use the full name in the H1, descriptions, examples, schedules and cross-skill calls. [Claude Code resolves a project skill's frontmatter name separately from its directory alias](https://code.claude.com/docs/en/skills#how-a-skill-gets-its-command-name). Do not publish a second skill just to retain an old command.
- In a plugin, name the plugin after the project and keep each skill directory and `name` as the bare skill slug; the loader supplies `<project-slug>:`. Never add the namespace twice. The factory's own plugin continues to expose `pandacorp:<skill-slug>`.
- For another runtime, use its supported namespace mechanism. Keep portable folder/frontmatter identifiers compliant with that runtime; verify the effective public name rather than inserting an unsupported colon. Do not claim native discovery without checking it.
- A rename updates live canonical docs, examples, routine prompts and contract references together. Preserve append-only history and the ability to read previously persisted extractor identities; a naming change does not authorize a data migration or certify unexecuted skill dry-runs.
- Existing projects receive the rule and its checker through normal overlay upgrade; upgrade never renames product skills. For projects whose immutable `created_with` is older than 8.110.0, missing or unparseable, doc-lint reports naming violations as migration warnings. Projects born on 8.110.0 or newer fail closed. Every new or explicitly renamed skill, including in a legacy project, must pass `node .pandacorp/check-project-skills.mjs --strict --skill <skill-slug>` at authoring review. Existing unrelated skills are not migrated as a side effect of another request; never interrupt a live builder.

## Rule — typing
- Strict typing ALWAYS (`tsconfig` with `strict: true`; in Python `mypy --strict`).
- Prefer `unknown` over `any`. `any` and `@ts-ignore` forbidden.
- Explicit return types on public functions. Non-null assertion (`!`) as a last resort.

## Rule — constants and no magic values
- No repeated inline magic strings/numbers. Extract to `src/lib/constants.ts` (`ROUTES`, `APP_NAME`, analytics events, etc.).
- **Not magic numbers** (no constant needed): Tailwind utility values (`w-[360px]`, `gap-2`) and literals passed to clearly-named props (`size={20}`, `maxLength={50}`) — they are self-describing in place.

## Rule — environment variables
- Keep `.env.example` in sync **in the same change** that introduces a new variable, grouped by section. Never commit real values (secrets → external SOPS store or private `.env.local`/`.env.production` handoffs, DR-037; three-file contract in `external-services.md`).
- **Every variable has its own description (CONV-16, DR-136).** The line directly above each variable (no blank line in between) is a `#` comment saying what it is for and, where it applies, how to obtain it. A comment shared by a block of variables does not count: readers such as Mission Control's Arquitectura tab attach only the immediately preceding comment to the next variable, so the rest of the block shows no purpose. A section header (`# --- Group ---`, `# ====`) or a commented-out assignment is not a description; commented-out optional variables (`# NAME=value`) need their own description too. Write it from the project's own docs and code (architecture.md, blueprints, ADRs, the code that reads it); if the purpose cannot be established, ask the owner rather than invent one.

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

- **GitHub access (CONV-19)**: review-only — the reviewer's GitHub-access checklist audits executed session calls against the binary criteria above; catalog validation does not certify runtime compliance.

- **Project skill names (CONV-17)**: `node .pandacorp/check-project-skills.mjs --strict` rejects missing/duplicate/invalid identity fields, missing frontmatter delimiters, bare or wrong-project names and directory/suffix mismatches in standalone `.claude/skills/`. `doc-lint.sh` invokes `--rollout` before its docs-only early exit: hard for projects born on overlay 8.110.0+, advisory for older/unknown birth versions. Authoring review runs `--strict --skill <slug>` for every new/renamed skill. Full YAML/native syntax and plugin/runtime namespace resolution remain the named skill-authoring review, not a claim of runtime qualification or a full frontmatter parser. Canary: `node --test plugin/scripts/test-project-skill-names.mjs`.
- **Typing**: `tsc --noEmit` with `strict: true` (`verify.sh` gate, fail-closed); `any`/`@ts-ignore` → Biome `noExplicitAny` as error. `mypy --strict` on Python stacks.
- **Imports**: Biome organize-imports + the `@/*` alias in `tsconfig` (toolchain conformance check on `/pandacorp:upgrade`); deep-relative imports → review-only.
- **Secrets**: gitleaks (pre-commit hook + platform push protection); `.env.example` sync → review-only (reviewer checklist).
- **`.env.example` per-variable descriptions (CONV-16)**: `.pandacorp/doc-lint.sh`, run by `verify.sh`, fails on every project (any `created_via`) when a variable has no description comment of its own directly above it; canaried by `canary.sh` step 9 and the factory self-test `plugin/scripts/test-doc-lint-env-example.sh`. Whether the description is accurate stays review-only.
- **URLs in English (CONV-18)**: manual — the architecture readiness checklist rejects a non-English route/API path in the route map, blueprints or work orders; the reviewer's quality lens rejects one in code (`app/**` folder names, `ROUTES`, route handlers, query keys); release confirms the live route list.
- **Naming, handlers, constants, boundary validation**: review-only (`reviewer` quality lens); boundary validation is also exercised indirectly by the adversarial/malformed-input tests (DR-015/DR-078, `quality.md`).
- **Language (committed=English), Conventional Commits, no force-push**: review-only.
- **Decision card (CONV-20)**: manual — the agent checks, before sending, that the chat text holds all three parts (one-paragraph context for a novice, lettered options A, B, C… each with gain/risk, "Recomendada: <letter>" with why and what would change it) and that nothing lives only in a link or picker; owner spot-check. When a skill's question template is authored or edited, the reviewer checks it against the card (no template may carry the decision only in a tool UI or a file). Not machine-checkable: it is a property of a conversation.
- **Clean up after yourself (CONV-21)**: manual — the agent checks at task close that the worktrees and scratch/research/temp files it created are gone and that nothing of another session was touched; owner spot-check. The delete gate in `block-dangerous.sh` is covered by `plugin/scripts/test-block-dangerous.sh` (HOOK-RM section: each allowed and each still-blocked form).
- **Claims and diagnoses (evidence before assertion)**: manual — agent self-check before asserting *or* before building a diagnosis/fix plan on a stand-in, plus owner spot-check; the build-side counterpart is wired (the Stop gate's `verify.sh` + DR-068's fenced run-state receipts), the chat and diagnosis sides are judgment calls by nature.
- **Verified traps**: `matter(` called with a single argument is greppable (a lint/CI candidate); the timestamp and `git add` traps are review-only — they are recognized at the moment the symptom appears, not prevented by a gate.
- **User-facing copy voice**: a `grep` for `—`/`– ` over the copy surface (i18n messages, MDX, generated drafts) is the mechanical check where a content pipeline exists; hand-written copy is reviewer + owner spot-check.

## Why
Uniform conventions let any agent (or the owner) drop into any project cold: naming carries intent, strict typing turns a class of runtime bugs into compile errors, and the language rule keeps the public repo professional while the owner operates in Spanish. What a linter can hold, the linter holds; the rest is cheap for a reviewer to spot and expensive to leave inconsistent.
