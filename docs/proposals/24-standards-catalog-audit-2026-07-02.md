# Proposal 24 — Standards catalog audit + improvement plan (2026-07-02)

**Status:** IMPLEMENTED 2026-07-02 (all 4 phases + owner additions: Tier 2, ai-implementation, Next/React canonical depth, stacks B/C + starting points; plugin v9.50.0, OVERLAY 8.56.0 — see `factory/decision-log.md` same date)
**Scope:** `factory/standards/` content, document structure/template, injection mechanism (DR-051), and alignment with 2025–2026 state of the art for paved-road catalogs + AI-agent rule injection.
**Method:** 3 parallel audits — (1) full read of all 18 standards + constitution, (2) end-to-end injection verification against two real projects (Mission Control, personal-page-v2; MD5 diffs), (3) internet research (Spotify/Netflix golden paths, production-readiness checklists, Anthropic CLAUDE.md guidance, AGENTS.md 2,500-repo analysis, Cursor rules ecosystem).

---

## Part 1 — Findings (the report)

### 1.1 Catalog content: strong core, asymmetric depth

- 18 files / 10 domains. **Heavily wired**: `quality.md` (15+ fail-closed gates), `build-orchestration.md`, `design.md`, `accessibility.md`.
- **Dangerously thin** (~20 lines each): `api-design.md` (error contract only — no pagination, versioning lifecycle, idempotency, caching headers), `privacy.md` (all 3 rules manual), `seo-i18n.md` (no schema.org/OG depth, checklist-only).
- **Enforcement census** (per-rule): ~43% hard-gated (CI/lint/script), ~57% partly or wholly human. **~18 rules are pure prose with no mechanism** — including rules labeled MUST:
  - `privacy.md` — MUST, zero automated checks (minimization, export/delete, no-PII-in-logs all manual).
  - `api-design.md` — MUST, gate described vaguely ("verify.sh asserts") with no config shown.
  - CSP is report-only (`web-security.md`); dependency new-release cooldown is human discipline; SSRF `safeFetch` is code-review only; rate limiting has no implementation standard.
- This is the known factory meta-pattern **promise-without-mechanism** (proposal 20) surfacing in the standards layer.

### 1.2 Missing domains (gaps for a web-SaaS factory)

Tier 1 (each project reinvents these today, high defect surface):
1. **Error handling taxonomy** — classification, propagation, recovery, circuit breakers, graceful degradation (fragments exist in api-design/conventions/patterns; no canonical strategy).
2. **Data modeling & schema evolution** — entity design, naming, soft-vs-hard delete, denormalization rules, N+1 prevention (only migrations-testing exists in quality.md).
3. **Auth/authz modeling** — roles/permissions declared at blueprint time, RBAC shape, session/token policy (Better Auth is chosen in stack.md but no project-facing standard).
4. **Resilience** — per-layer timeouts, retry+backoff, fallback hierarchies, bulkheads.
5. **API design depth** — pagination semantics, sorting/filtering, versioning lifecycle, idempotency keys, rate-limit headers.

Tier 2: background jobs (queues, retries, idempotency, DLQ), caching strategy (TTL/invalidation/layers), dependency lifecycle (update cadence, security-patch SLA), feature flags (naming, scope, cleanup), rate limiting implementation, secrets rotation, incident response + backup/restore testing (infra.md has 3 lines), monitoring/alerting thresholds, human code-review criteria (reviewer lens checklist).

Deliberately deprioritized for a solo-operator MVP factory: licensing policy, multi-region/DR, GraphQL patterns, WCAG AAA.

### 1.3 Document structure: a template EXISTS but is unevenly applied

`README.md:38-43` defines the "executable standard" shape (Rule → How verified → Why) and a preamble convention (`> Domain · Severity · Enforcement`). Reality:
- 7/18 files follow it fully (accessibility, api-design, observability, performance, privacy, quality, web-security).
- 6+ files have **no preamble** and ad-hoc structure: conventions, stack, structure, patterns, external-services, documentation, design, build-orchestration.
- Nothing validates the template (doc-lint doesn't check standards files).
- No central **rule registry**: there is no index of all ~100 rules with their enforcement status, so nobody can see which MUSTs are actually wired.

### 1.4 Injection mechanism (DR-051): verified end-to-end, design is state-of-the-art, two real weaknesses

The cascade works and was verified with evidence, not assumption:

```
factory/standards/ (canonical long-form, 18 files)
  → plugin/templates/rules/ (16 operative files, frontmatter applies_when)
    → project docs/rules/ (copied selectively by scaffold/architecture, stack-matched)
      → agent context (CLAUDE.md @docs/rules/README.md recursive import)
```

- **Selective, stack-aware**: Mission Control (internal Next.js tool) correctly received 11 rules and NOT prisma/i18n/web-security/analytics. ✅
- **Sync**: OVERLAY_VERSION (8.55.4) + `/pandacorp:upgrade` preflight (DR-048) overwrites verbatim. Mission Control: all rule files byte-identical to plugin (MD5). ✅
- **Real drift found**: personal-page-v2 at overlay 8.51.0 (4 versions behind); its `typescript.md` still references the deprecated ESLint rule instead of Biome `useImportType`. Root cause: **upgrade only fires on skill invocation** — a quiet project drifts indefinitely. ⚠️
- **Standards↔rules sync contract is unverified**: `/pandacorp:learn` requires updating the rule file + OVERLAY_VERSION in the same change, but nothing audits that `plugin/templates/rules/` actually matches `factory/standards/` content. ⚠️
- **Canary is optional after upgrade** (DR-079 exists but doesn't block) — a rotted gate config can pass silently. ⚠️
- **Context budget**: the full rule library is 573 lines; a typical web project always-loads ~450 lines of rules + guide.md + CLAUDE.md. Research consensus (Anthropic, HumanLayer): >~300 always-loaded lines measurably degrades instruction-following ("bloated CLAUDE.md files cause Claude to ignore your actual instructions"). We are above budget. ⚠️

### 1.5 State-of-the-art alignment (internet research, 21 sourced findings)

Key takeaways applied to us:
1. **Prose is advisory; hooks/CI are deterministic** (Anthropic). Health metric for a catalog: **% of rules with a named automated check**. Every prose-only rule will eventually be ignored.
2. **Don't spend context on what a linter can check** — style/mechanical rules belong in Biome config, not in rule prose (we partially violate this: rule files restate things biome.json already enforces).
3. **One good/bad code example beats three paragraphs** (GitHub 2,500-repo AGENTS.md analysis); boundaries as **always / ask first / never**.
4. **Progressive disclosure**: thin always-loaded layer + on-demand deep docs (paths/skills). Our two-layer design (rules = operative, standards = long-form) already matches this — the fix is trimming the operative layer, not restructuring.
5. **Compliance by convenience** (Spotify/Netflix): scaffolding that starts projects already-compliant beats rules that demand compliance. Our verbatim gate-config install (DR-059) is exactly this pattern — extend it.
6. Structured per-task context injection lifts agent decision compliance ~49% (arXiv 2605.08112) — supports retrieving the relevant standard at task time (the build engine already injects DR-specific directives into work orders; generalize it).

---

## Part 2 — Improvement plan (4 phases, each shippable independently)

### Phase 1 — Template + rule registry (cheap, highest visibility)
1. Formalize the standard template (update `README.md` + doc-lint): preamble (`Domain · Severity · Enforcement`) + **Rule** (imperative bullets) + **Enforced by** (NAMED check: lint rule / verify.sh section / hook / "review-only") + **Why** (1–3 lines) + **Example** (good/bad, where it clarifies) + **Exceptions** (when + ADR).
2. Migrate the 6+ non-conforming files to the template (content mostly unchanged; restructure).
3. Build the **rule registry**: one generated table (rule ID, title, severity, file, enforcement tier, wired/manual/aspirational). Wire into doc-lint so a MUST without a named check is flagged. This turns the enforcement gap into a visible burn-down list.

### Phase 2 — Close the MUST-without-gate holes (enforcement)
1. `api-design`: real RFC 9457 contract test in the stack template's verify.sh/e2e.
2. `privacy`: PII-in-logs grep/scan check; export/delete as acceptance criteria injected into blueprint when the data model has personal data.
3. `web-security`: CSP from report-only → enforce (per-project ratchet); dependency cooldown as an install-time script check; SSRF `safeFetch` presence check (grep for raw fetch to user-supplied URLs).
4. Rate limiting: middleware in the stack template (compliance by convenience) instead of a prose rule.
5. Evaluate overlay hooks (PostToolUse lint-after-edit; Stop gate) for invariants that today are prose.

### Phase 3 — New standards (the gaps that matter)
Tier 1 first: `error-handling.md`, `data-modeling.md`, `auth.md`, `resilience.md`, plus expanding `api-design.md`. Each born per the DR-051 contract: canonical file + injectable rule (`applies_when`) + named check + OVERLAY_VERSION bump. Tier 2 as demand appears (background-jobs, caching, dependency-lifecycle, feature-flags; expand infra.md incident-response/backup sections).

### Phase 4 — Injection tuning
1. **Context budget pass**: measure the real always-loaded token cost per project; trim rule files toward example-driven brevity; delete every rule Biome/tsc already enforces (pointer to the config instead). Target ≤~300 lines always-loaded.
2. **Standards↔rules conformance auditor**: script that checks every project-facing standard has a matching rule file and flags content divergence (DR-059-style, for docs).
3. **Drift watch**: `/pandacorp:sync-portfolio` (or the MC drift banner, FRD-15) also reports projects whose `overlay_version` lags OVERLAY_VERSION, so quiet projects surface.
4. **Canary after upgrade becomes blocking** where `canary.sh` exists.

Suggested order: 1 → 2 → 4 → 3 (registry first makes the rest measurable; new standards last so they're born into the fixed template).

---

## Sources (research highlights)
Spotify golden paths · Netflix paved road/guardrails · Cortex/OpsLevel/SigNoz production-readiness · Anthropic Claude Code best practices + context engineering · HumanLayer CLAUDE.md guide · GitHub AGENTS.md 2,500-repo analysis · Cursor rules docs · Google style-guide enforcement philosophy · danger-js · Lighthouse CI budgets · arXiv 2605.08112 (context-injection compliance study). Full citations in the research agent transcript.
