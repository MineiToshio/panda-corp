# Rule registry — every rule, its enforcement, its status

The catalog's health metric in one table. Each row is a rule (or tight cluster) from a standard, with **how it is actually enforced today**. Statuses:

- **wired** — a script/CI/lint/hook/deny-rule verifies it automatically (fail-closed unless noted).
- **manual** — a NAMED human/process step verifies it (reviewer lens, skill checklist, human gate). Legitimate for judgment calls; a wiring candidate otherwise.
- **aspirational** — stated but NOTHING verifies it. **An aspirational MUST is a defect** (promise-without-mechanism): wire it or demote it.

Maintained by hand; `check-standards.sh` validates the template shape and that every standard file is represented here. Update the row in the same change that adds/changes/wires a rule (`/pandacorp:learn` step). Last full audit: 2026-07-02 (docs/proposals/24).

| ID | Rule | Sev | File | Enforced by | Status |
|---|---|---|---|---|---|
| CONV-1 | Language: committed=English / gitignored=Spanish | MUST | conventions.md | reviewer (review-only) | manual |
| CONV-2 | Naming conventions (camelCase files, handle*, use*, is/has) | MUST | conventions.md | reviewer quality lens | manual |
| CONV-3 | Strict typing; no `any`/`@ts-ignore` | MUST | conventions.md | `tsc --noEmit` strict + Biome `noExplicitAny` (verify.sh) | wired |
| CONV-4 | No repeated magic values → constants | MUST | conventions.md | reviewer | manual |
| CONV-5 | Secrets never committed | MUST | conventions.md / external-services.md | gitleaks pre-commit + push protection | wired |
| CONV-6 | `.env.example` in sync in the same change | MUST | conventions.md | reviewer checklist | manual |
| CONV-7 | Boundary validation with centralized schemas | MUST | conventions.md | adversarial/malformed-input tests (DR-015/078) + reviewer | manual |
| CONV-8 | Absolute `@/*` imports; no deep relatives | SHOULD | conventions.md | tsconfig alias + Biome organize-imports; depth review-only | wired |
| CONV-9 | Named handlers; no inline JSX logic | SHOULD | conventions.md | reviewer | manual |
| CONV-10 | Conventional Commits; never force-push | MUST | conventions.md | review-only | manual |
| CONV-11 | Owner-facing interaction style (mark answer start, concise/scannable, storytelling, visualize flows, red-team judgment calls) — chat only, not product copy | SHOULD | conventions.md | agent self-check + owner spot-check | manual |
| CONV-12 | Subagent model selection: calculate the tier by subtask complexity (haiku/sonnet/opus) when not already pinned; never inherit the parent conversation's tier; Fable never automatic | SHOULD | conventions.md | agent self-check before ad-hoc delegation + owner spot-check | manual |
| API-1 | RFC 9457 error contract (`application/problem+json`) | MUST | api-design.md | verify.sh grep gate (4xx/5xx without `problem()` = RED) + snippet; canaried | wired |
| API-2 | REST: resources, `/v1`, pagination, standard codes | MUST | api-design.md | reviewer | manual |
| STRUCT-1 | `src/` mandatory; reference layout | MUST | structure.md | reviewer + knip (orphans only) | manual |
| STRUCT-2 | Isolated data layer — DB access only in `queries/` | MUST | structure.md | verify.sh grep gate (ORM outside queries/ = RED; type-imports free); canaried | wired |
| STRUCT-3 | Tests only in `_tests/` folders | MUST | structure.md | structure guard in verify.sh | wired |
| STRUCT-4 | Component single-file/multi-file convention | SHOULD | structure.md | reviewer | manual |
| STRUCT-5 | Promotion rule (smallest scope that fits) | SHOULD | structure.md | reviewer | manual |
| STRUCT-6 | Feature-centric docs skeleton + stable IDs | MUST | structure.md | doc-lint (advisory) + reviewer | manual |
| PAT-1 | Server Components default; minimal client boundaries | SHOULD | patterns.md | Biome react/next domains (partial) + reviewer | manual |
| PAT-2 | Every Server Action authenticates/authorizes inside | MUST | patterns.md | reviewer correctness lens + adversarial tests | manual |
| PAT-3 | Optimistic UI as default mutation pattern | SHOULD | patterns.md | reviewer | manual |
| PAT-4 | Composition rules (drilling ≤3, stable keys, no nested defs, derive-don't-sync) | SHOULD | patterns.md | Biome react rules (keys/nested) + reviewer (rest) | manual |
| PAT-5 | Semantic HTML; no `<div onClick>` | MUST | patterns.md | Biome `a11y` group (error) | wired |
| PAT-6 | Tokens only — no hardcoded colors | MUST | patterns.md | visual-fidelity gate (DR-056) + reviewer | manual |
| PAT-7 | Empty/loading/error states designed | MUST | patterns.md | FRD completeness checklist (DR-100) + reviewer | manual |
| PAT-8 | Global error net (global-error/error/not-found) | MUST | patterns.md | file-presence check in verify.sh | wired |
| PAT-9 | Analytics on key interactions, centralized events | SHOULD | patterns.md | analytics agent checklist (hardening) | manual |
| PAT-10 | Caching/revalidation discipline: explicit cache + tags; invalidate after mutation (tag for data / path for pages) | MUST | patterns.md | reviewer correctness lens + Biome next domain (partial) | manual |
| PAT-11 | Forms via Server Actions + `useActionState` (progressive enhancement); client state: URL for shareable views, context cross-cutting only, no default global store | SHOULD | patterns.md | reviewer + Biome react domain (partial) | manual |
| QUAL-1 | Tests+type+lint+build gates, fail-closed | MUST | quality.md | verify.sh (`set -euo pipefail`, error-on-warnings) | wired |
| QUAL-2 | Dead code (knip) + circular deps (madge) | MUST | quality.md | verify.sh | wired |
| QUAL-3 | Browser gates: smoke/visual/responsive/shell (missing harness = RED) | MUST | quality.md | verify.sh e2e (DR-055/056/074/075) | wired |
| QUAL-4 | Observability-fidelity gate (monitors) | MUST | quality.md / observability.md | Playwright + state tests (DR-066) | wired |
| QUAL-5 | Readiness + completeness (DR-100) | MUST | quality.md | `[NEEDS CLARIFICATION]` grep gate + reviewer AC-coverage | wired |
| QUAL-6 | Adversarial reviewer tests; builder-blind acceptance suite | MUST | quality.md | FRD gate process (DR-015/080) | manual |
| QUAL-7 | Mutation testing ≥60% new logic at FRD close | SHOULD | quality.md | Stryker/mutmut (FRD close + CI) | manual |
| QUAL-8 | Property-based tests for invariants; REQUIRED for parsers | MUST (parsers) | quality.md | fast-check parser-test family (DR-078) | wired |
| QUAL-9 | Fail-loud read boundaries; no silent `[]` | MUST | quality.md | malformed-fixture tests + data-presence spec (DR-078) | wired |
| QUAL-10 | Gate canary — gates still bite | MUST (on upgrade) | quality.md | `verify.sh --canary` (DR-079) | wired |
| QUAL-11 | Migrations versioned, reversible, down tested | MUST | quality.md | FRD gate reviewer lens | manual |
| QUAL-12 | TDD per work order (RED→GREEN→refactor) | MUST | quality.md | engine reads test results per WO | manual |
| QUAL-13 | E2E hygiene: teardown cleanup, deterministic keys | SHOULD | quality.md | reviewer | manual |
| A11Y-1 | WCAG 2.2 AA | MUST | accessibility.md | Biome `a11y` + axe-core over built pages | wired |
| A11Y-2 | Tap targets: 24px gate floor / 44px design target | MUST | accessibility.md | axe `target-size` in Responsive Gate (DR-074) | wired |
| A11Y-3 | Focus visible + AA contrast | MUST | accessibility.md | reviewer (not linter-detectable) | manual |
| A11Y-4 | Respect `prefers-reduced-motion` | MUST | accessibility.md | reviewer | manual |
| PERF-1 | Core Web Vitals p75 budgets (LCP/INP/CLS) | MUST | performance.md | Lighthouse CI block-on-main + PostHog field RUM | wired |
| PERF-2 | JS budget; no unjustified bundle regressions | MUST | performance.md | bundle-analyzer + Lighthouse budget (needs per-project budget in blueprint) | manual |
| PERF-3 | No waterfalls; request dedup; dynamic-import heavy; no barrel imports in hot paths | SHOULD | performance.md | review-only | aspirational |
| PERF-4 | `next/image` + `next/font` | MUST | performance.md | Biome next domain (`noImgElement`) + reviewer | manual |
| SEC-1 | Security headers (HSTS, XFO, nosniff…) | MUST | web-security.md | `e2e/headers.spec.ts` in verify.sh (tiered: external=hard / internal=advisory) | wired |
| SEC-2 | CSP present from day 1 (report-only OK in v1; enforce ratchet at maturity) | MUST | web-security.md | `e2e/headers.spec.ts` (presence) + security-auditor enforce ratchet (named) | wired |
| SEC-3 | Pinned deps; immutable installs | MUST | web-security.md | pnpm lockfile + frozen-lockfile install | wired |
| SEC-4 | New-release cooldown (~7 days) before adopting | SHOULD | web-security.md | architect install step checks release date + `.npmrc` minimum-release-age | manual |
| SEC-5 | No install lifecycle scripts (`ignore-scripts`) | MUST | web-security.md | `.npmrc` config presence | manual |
| SEC-6 | Secret scanning | MUST | web-security.md | gitleaks + platform push protection | wired |
| SEC-7 | SSRF-safe outbound fetch (`safeFetch` wrapper) | MUST | web-security.md | security-auditor hardening check + shipped snippet (STACK.md) | manual |
| SEC-8 | Rate-limit auth + public endpoints | MUST | web-security.md | security-auditor hardening checklist + shipped middleware pattern (STACK.md) | manual |
| PRIV-1 | Data minimization at the model (privacy by design) | MUST | privacy.md | blueprint review (human gate) | manual |
| PRIV-2 | Export + delete of a person's data supported | MUST | privacy.md | ACs in the owning FRD (FRD gate: tests + reviewer) + hardening checklist | manual |
| PRIV-3 | Never log PII or secrets | MUST | privacy.md | security-auditor PII grep vs data model + Sentry redact-before-send helper | manual |
| PRIV-4 | New PII / third-party sharing escalates to owner | MUST | privacy.md | human gate (DR-025) | manual |
| OBS-1 | Structured logs baseline (Pino) | MUST | observability.md | hardening checklist | manual |
| OBS-2 | Sentry error tracking from day 1 | MUST | observability.md | hardening checklist (DR-026/085) | manual |
| OBS-3 | Liveness/freshness fidelity (live ⇔ running ∧ fresh) | MUST | observability.md | Observability-fidelity gate (DR-066) | wired |
| OBS-4 | Free-tier cost ceilings checked monthly | SHOULD | observability.md | review-launch script + owner (DR-005) | manual |
| SEO-1 | Metadata API per page + sitemap + robots | SHOULD | seo-i18n.md | release checklist | manual |
| SEO-2 | i18n: no hardcoded visible strings | MUST (if i18n) | seo-i18n.md | release checklist | manual |
| SEO-3 | hreflang/canonical per locale | SHOULD | seo-i18n.md | release checklist | manual |
| PORT-1 | Runtime capability matrix consulted before assuming a capability exists outside Claude Code | SHOULD | agent-portability.md | agent self-check (matrix in AGENTS.md context) | manual |
| PORT-2 | Neutral model tiers (MECH/STANDARD/JUDGE) mapped per runtime; most expensive tier never automatic | SHOULD | agent-portability.md | agent self-check + owner spot-check (generalizes CONV-12) | manual |
| PORT-3 | Tool translation table applied when a skill references a Claude-native tool under another runtime | MUST | agent-portability.md | table injected via AGENTS.md §Runtime portability (always in context) + owner spot-check | manual |
| PORT-4 | Skill invocation protocol: human gates, Spanish interaction and doc discipline never degrade cross-runtime | MUST | agent-portability.md | Codex verification rounds (2026-07-04) + owner spot-check | manual |
| PORT-5 | Codex build writes require the exact promoted EXPERIMENTAL attended-foreground single-target profile; broader Codex forms are denied and other non-Claude runtimes remain read/review-only | MUST | agent-portability.md | capability-policy gate + installed attended canary; R10/R11 separately gate switching and unattended/overnight expansion | wired |
| PORT-6 | Claude-only surfaces (engine, supervisor, hooks enforcement) never assumed elsewhere; enforced rules still bind as instructions | MUST | agent-portability.md | stated in AGENTS.md; hook port tracked in BL-0030 | manual |
| MEM-1 | Every lesson's `source:` names a checkable locator (date, id, run id, file, sha, URL); anchorless prose is reject-at-harvest, never a candidate | MUST | memory-harvesting.md | `validate-memory.sh` anchor gate (fail-closed; run by the `memory` skill + the daily `pandacorp-memory-review` routine) | wired |
| MEM-2 | The store grows by verified experience, never by introspection; a reflection lesson cites only evidence-anchored `LESSON-NNNN` ids (never another reflection) | MUST | memory-harvesting.md | `librarian` refine step 1 (DEFAULT-REJECT) + the MEM-1 anchor gate as backstop | manual |
| DOC-1 | Two layers always: canonical doc + decision log | MUST | documentation.md | reviewer FRD gate + phase gates | manual |
| DOC-2 | Source-of-truth hierarchy respected upstream | MUST | documentation.md | doc-lint (advisory) + reviewer | manual |
| DOC-3 | Root README populated (what it does + how to run), never left the scaffold placeholder | SHOULD | documentation.md | doc-lint (greenfield hard-eligible: placeholder gone once PRD exists) + release pre-release checklist | manual |
| STACK-1 | Golden path by default, latest stable | SHOULD | stack.md | blueprint ADR (owner approves) | manual |
| STACK-2 | Version policy (latest new / stay in-flight / compatible brownfield) | MUST | stack.md | review-only | manual |
| STACK-3 | Never homemade auth | MUST | stack.md / constitution §12 | blueprint review | manual |
| EXT-1 | Account model: shared account + native isolation primitive; ToS rule | MUST | external-services.md | provisioning playbook checklist | manual |
| EXT-2 | Machine secrets in SOPS+age store outside repos | MUST | external-services.md | convention + gitleaks (repo side) | manual |
| EXT-3 | Human gates on spend/signup/deletion | MUST | external-services.md / infra.md | deny rules in `.claude/settings.json` + push (DR-038) | wired |
| EXT-4 | Vercel commercial-use warning at 3 checkpoints | MUST | external-services.md | skill checklists (PRD/blueprint/release) | manual |
| INFRA-1 | Dev DB/services via Docker Compose in-repo | MUST | infra.md | scaffold template + reviewer | manual |
| INFRA-2 | Ports from the central ledger | MUST | infra.md | scaffold/architecture automation (`factory/ports.yaml`) | wired |
| INFRA-3 | Backup schedule/retention + restore TESTED before external release and after schema majors | MUST | infra.md | release checklist + post-schema-major drill (named) | manual |
| INFRA-4 | Incident response: classify → rollback → postmortem | MUST | infra.md | runbook (manual) | manual |
| DES-1 | Design tokens are a frozen contract | MUST | design.md | design-token/visual gates (DR-056) | wired |
| DES-2 | Prototype fidelity: responsive + shell-presence gates | MUST | design.md / quality.md | verify.sh e2e (DR-074/075) | wired |
| DES-3 | Owner's visual gate before build | MUST | design.md | human gate (design phase) | manual |
| BUILD-1 | Doc-driven orchestration: state machine, per-FRD gates, heartbeat, change queue | MUST | build-orchestration.md | the build engine + verify.sh (DR-050) + engine simulation suite (`plugin/scripts/test-pandacorp-build.mjs`: brakes, DR-060 waves, DR-086 resume, fail-safe, safe points) | wired |
| ERR-1 | Taxonomy: expected = typed control flow / unexpected = boundary + Sentry; never swallow an error | MUST | error-handling.md | reviewer correctness lens + DR-078 malformed-fixture tests (QUAL-9) | manual |
| ERR-2 | Server Actions return typed results; route handlers use `problem()` | MUST | error-handling.md | route side: verify.sh problem() gate (API-1, wired); action side: reviewer correctness lens | manual |
| ERR-3 | UI error state renders the domain error, never a raw exception; error net present | MUST | error-handling.md | error-net file presence (PAT-8, wired) + reviewer | manual |
| DATA-1 | Singular models, explicit relation names, `createdAt`/`updatedAt` on every model | MUST | data-modeling.md | blueprint readiness gate (DR-100) + reviewer | manual |
| DATA-2 | Hard delete default + GDPR erasure; soft delete only with stated blueprint reason + every read filters it | MUST | data-modeling.md | blueprint review + PRIV-2 FRD ACs + reviewer | manual |
| DATA-3 | Enums for closed value sets; no magic-string states | MUST | data-modeling.md | blueprint readiness gate + reviewer | manual |
| DATA-4 | N+1 prevention: include/select in one query in the data layer; never query in a loop | MUST | data-modeling.md | reviewer correctness lens over queries/ (isolation substrate: STRUCT-2, wired) | manual |
| DATA-5 | Denormalize only with a measured reason + an ADR | SHOULD | data-modeling.md | blueprint review + reviewer (ADR presence) | manual |
| DATA-6 | Deterministic dev-only seed script; tests use factories, not the seed | SHOULD | data-modeling.md | reviewer | manual |
| AUTH-1 | RBAC declared in the blueprint data model; resource-level authz in data layer/action, never UI-only | MUST | auth.md | blueprint readiness gate (DR-100) + reviewer/adversarial wrong-user tests (PAT-2) | manual |
| AUTH-2 | No homemade auth; Better Auth cookie sessions with defaults (httpOnly/secure/sameSite) | MUST | auth.md | blueprint review (STACK-3) + security-auditor hardening checklist | manual |
| AUTH-3 | OAuth scopes minimal | MUST | auth.md | security-auditor hardening checklist | manual |
| AUTH-4 | Account deletion = full erasure path | MUST | auth.md | PRIV-2 FRD ACs (FRD gate) + hardening checklist | manual |
| RES-1 | Explicit timeout on every outbound call (AbortSignal.timeout, DB statement_timeout, SDK options) | MUST | resilience.md | reviewer correctness lens + security-auditor hardening (with SEC-7 safeFetch review) | manual |
| RES-2 | Retries: backoff + jitter, idempotent ops only, one layer (outermost), never nested | MUST | resilience.md | reviewer correctness lens | manual |
| RES-3 | Fallback hierarchy: stale-labeled → degraded UI → honest error; never fake liveness | SHOULD | resilience.md | reviewer + OBS-3 gate where a monitor exists | manual |
| RES-4 | Bulkhead: a third-party outage never takes down the core flow | MUST | resilience.md | reviewer + adversarial dependency-down tests (DR-015) | manual |
| JOB-1 | Work > ~5s or retriable side effects run as jobs (Cron/queue); idempotent handler + idempotency key | MUST | background-jobs.md | reviewer correctness lens + adversarial run-twice tests (DR-015) | manual |
| JOB-2 | Bounded retries + visible dead-letter (Sentry + queryable state); never silently drop a job | MUST | background-jobs.md | reviewer + hardening checklist (Sentry on failure, OBS-2) | manual |
| JOB-3 | Job runs log start/end/duration; long jobs heartbeat | SHOULD | background-jobs.md | hardening checklist (OBS-1) | manual |
| DEP-1 | Cadence: security patches ASAP; minors batched; majors deliberate; never bump mid-build | SHOULD | dependency-lifecycle.md | reviewer (flags unrelated bumps in feature changes) | manual |
| DEP-2 | `pnpm audit --audit-level high` clean at hardening + before external release | MUST | dependency-lifecycle.md | security-auditor hardening pass runs it (named; CI wiring candidate) | manual |
| DEP-3 | Licenses permissive-only (MIT/Apache/BSD/ISC); copyleft/unusual escalates to owner | MUST | dependency-lifecycle.md | architect install step (with SEC-4 cooldown check) + human gate | manual |
| DEP-4 | Removal hygiene: a dep no longer imported is removed in the same change | MUST | dependency-lifecycle.md | knip in verify.sh (QUAL-2) | wired |
| FLAG-1 | MVP default: no flag system; flags earn their place at first real users (PostHog = golden path, ADR) | SHOULD | feature-flags.md | blueprint review (named manual step) | manual |
| FLAG-2 | Flag hygiene: name/owner/expiry; past-expiry flag = defect; never flag-gate a security fix | MUST (if flags) | feature-flags.md | reviewer quality lens + review-launch expired-flags check | manual |
| AIIMPL-1 | Comments = why/invariants; never diff narration, conversation/ticket refs, or tutorial comments | MUST | ai-implementation.md | reviewer quality lens | manual |
| AIIMPL-2 | No doc files in `src/`, no parallel doc trees — docs live in `docs/` per the FRD skeleton | MUST | ai-implementation.md | reviewer + doc-lint (advisory) + structure review (STRUCT-1) | manual |
| AIIMPL-3 | Verify against the INSTALLED framework version, not training memory (AGENTS.md pointer) | MUST | ai-implementation.md | DR-102 repo-grounding gate (architecture 9b + implement preflight) | manual |
| AIIMPL-4 | Cite `LESSON-NNNN` when a factory memory lesson is applied | SHOULD | ai-implementation.md | memory citation-count script (/pandacorp:memory status) | manual |
| PROMPT-1 | Prompts state goals/constraints; steps enumerated only where order is normative | SHOULD | prompting-conventions.md | edit-time self-check vs the standard + owner spot-check | manual |
| PROMPT-2 | Emphasis is scarce: CAPS/NEVER/bold reserved for load-bearing tokens; no repeated phrasings | SHOULD | prompting-conventions.md | edit-time self-check + owner spot-check | manual |
| PROMPT-3 | One rule one home; incident origin as (DR/BL) pointer, never inline war-story | SHOULD | prompting-conventions.md | edit-time self-check + owner spot-check | manual |
| PROMPT-4 | Never-degrade list (gates, language, doc discipline, fail-closed semantics, state contracts) is verbatim-stable in prompt edits | MUST | prompting-conventions.md | fresh-context verifier pass per edit (PROMPT-6) | manual |
| PROMPT-5 | Frontmatter (name/description/tools/model/effort) is policy — never changed silently by a prompt edit | MUST | prompting-conventions.md | verifier pass + `check-derived-drift.sh` (TOML regen) + `claude plugin validate` | wired |
| PROMPT-6 | Every prompt edit gets an independent fresh-context normative-survival verification | MUST | prompting-conventions.md | the edit ritual itself (named step); evidence in the editing session/decision log | manual |
| PROMPT-7 | Skimmable shape (~≤120-line agents); shared boilerplate byte-identical across files | SHOULD | prompting-conventions.md | grep-comparable blocks + reviewer at edit time | manual |

## Burn-down: aspirational rules

**Aspirational MUSTs: 0** — the 2026-07-02 list (API-1, STRUCT-2, SEC-2, SEC-7, SEC-8, PRIV-3) was closed the same day (Phase 2 of docs/proposals/24): API-1/STRUCT-2/SEC-2 got fail-closed gates; SEC-4/SEC-7/SEC-8/PRIV-3 got NAMED manual checks + shipped helpers (the safe path is now the easy path). Remaining SHOULD-tier: **PERF-3** (waterfalls/dedup/barrel imports — review-only; candidate for a future lint pass).

## Counts (2026-07-04, post PROMPT rules)

131 rules → **31 wired · 99 manual · 1 aspirational (SHOULD)** · **0 aspirational MUST**. PROMPT-1..7 (prompting conventions for the agent/skill prompt surface, DR-114, Fable sprint WS3) added 2026-07-04 — PROMPT-5 wired via `check-derived-drift.sh` + `claude plugin validate`; the rest `manual` with the NAMED edit ritual (PROMPT-6 fresh-context verifier pass). PORT-1..6 (multi-runtime portability, DR-113) added 2026-07-04 — all `manual` with NAMED steps (AGENTS.md-injected tables, Codex verification rounds, file-based gates); the derived-copy drift check is now **wired** (`plugin/scripts/check-derived-drift.sh`, Stop hook in the factory: TOML regen diff + manifest version sync + `.agents/skills` symlink, fail-closed + self-tested — 2026-07-04, closes audit-20 P1-16's mechanical slice); remaining wiring candidate: the BL-0030 hook port. DOC-3 (root README populated, DR-112) added 2026-07-03. CONV-12 (subagent model selection, DR-111) added 2026-07-02. The 2026-07-02 catalog expansion (error-handling, data-modeling, auth, resilience, background-jobs, dependency-lifecycle, feature-flags, ai-implementation + PAT-10/11) added 32 rows, honestly registered: mostly `manual` with NAMED steps (reviewer lenses, blueprint readiness gate, security-auditor/hardening checklists, human gates) — each is a wiring candidate where a lint/gate can hold it. Health metric: wired share should only go up; the aspirational-MUST list stays at zero — `check-standards.sh` warns if one reappears.
