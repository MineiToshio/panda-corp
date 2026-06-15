# Catalog of standards and decision rules

> Generated 2026-06-14 from a verified web research effort (32/40 findings survive).
> Guiding principle: **a standard is not text, it's a verifiable contract** — a categorical rule + a binary verifier + a rationale.

## Categorization (8 domains + 2 cross-cutting axes)

8 domains as the primary facet: **Programming · Architecture · Design · Technology · Quality · Security · Operation/Observability · Data/Privacy** (+ Product/Docs). Plus two per-rule axes:
- **Severity (RFC 2119)**: `MUST` (hard failure) / `SHOULD` (flexible with an ADR) / `MAY`. The agent only escalates if it's going to break a MUST.
- **Enforcement**: `lint` · `CI gate` · `checklist` · `human gate / deny rule`.
- **Form of a standard ("executable standard")**: Rule / How it's verified / Why (separate, not mixed).

## NEW standards created (`factory/standards/`)
- **`performance.md`** (Quality, MUST web): CWV p75 (LCP≤2.5s/INP≤200ms/CLS≤0.1); Lighthouse-CI proxy block-on-main; field via PostHog.
- **`web-security.md`** (Security, MUST): OWASP headers with literal values (HSTS/nosniff/Referrer/X-Frame/Permissions); CSP report-only in v1; header-scan in CI; preload submit = human.
- **`observability.md`** (Operation): JSON logs (service.name) + Sentry day 1; OTel as a tiered portable layer.
- **`privacy.md`** (Data, MUST): privacy by design (GDPR Art.25), minimization + RLS, export/delete (Arts.15/17/20), don't log PII.
- **`api-design.md`** (Programming, MUST API): RFC 9457 errors (problem+json) + validation at the edge.
- **`seo-i18n.md`** (Product, SHOULD web): Metadata API, sitemap/robots, next-intl, hreflang.
- **Extensions:** `quality.md` (a11y-gate + performance-gate in CI), `patterns.md` (global error boundary).
- `README.md`: categorization, axes, and canonical form. **What was already covered was not re-codified** (agentic security, living docs, input validation).

## NEW decision rules (`registry.yaml`)
- **DR-024** performance · **DR-025** privacy/PII (escalate if new PII) · **DR-026** minimal observability · **DR-027** security headers · **DR-028** API error contract · **DR-029** feature flags · **DR-030** golden path deviation (per-project ADR; promoting = human). **DR-006 extended** (expand/contract migrations). The DRs point to the standard; the values live there.

## Catalog UI (Mission Control Configuration)
An evolution of FRD-07, **2 levels maximum** (progressive disclosure): Summary (filterable grid with domain/severity/enforcement badges) → Detail (rule with literal values + how it's verified + why). Skills with a mini agent-flow; rules with an auto/human indicator + explanation; standards categorized with Summary/Detail. "New standard"/"New rule"/"New skill" buttons → `/pandacorp:learn`. Future: per-project compliance scorecard (requires `verify.sh` to emit pass/fail per standard to `status.yaml`).

## Caveats
- a11y, strict CSP, and PII **are not 100% script-verifiable** → "automatic gate + reviewer check", not total determinism.
- New MUSTs that would break in-flight projects (CSP, a11y-gate): introduce as SHOULD/warning and promote when mature.
- Correct citations: RFC 9457 (not 7807); GDPR export/delete are Chapter III (not Art. 25).

## Sources
roadie.io · opslevel.com · martinfowler.com/reduce-friction-ai/encoding-team-standards · web.dev/vitals · owasp HTTP_Headers/CSP cheatsheets · rfc-editor.org/rfc/rfc9457 · opentelemetry.io · gdpr-info.eu/art-25 · diataxis.fr · nngroup.com/progressive-disclosure · backstage.spotify.com/soundcheck · nextjs production-checklist
