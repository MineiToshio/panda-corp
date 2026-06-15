---
description: Prepares and executes the release of a Pandacorp project - security audit, pre-release checklist, deploy to staging and human gate for production. Use inside the project when a version's implementation is complete.
---

# /pandacorp:release

Version release. Runs IN the project (requires `phase: release` in `docs/status.yaml`).

## Steps

1. **Security audit** (`security-auditor` agent): essential web OWASP + **OWASP Top 10 for Agentic Applications** (ASI01–ASI10, DR-017) if the product has agents/LLMs with tools. Critical/high findings block the release — they are fixed (via fast work orders + review) before continuing.
2. **Landing copy + telemetry** (in parallel with the audit):
   - `copywriter`: writes the copy for the MVP's landing (headline, value proposition, benefits, CTA, FAQ) with readable `title`/meta description oriented to search intent (collaborates with `factory/standards/seo-i18n.md`). No claim without backing.
   - `analytics`: verifies that the events in `docs/analytics/events.md` actually fire in the critical flow (not "they should" — evidence) and leaves the funnel of the value hypothesis documented.
3. **Pre-release checklist** (everything verified by commands, not by memory):
   - Full suite + e2e green; lint and typecheck clean
   - Environment variables documented in `.env.example`; secrets ONLY in the deploy environment
   - DB migrations tested (up and down) in a clean environment
   - README with what it is, how to run locally and how to deploy
   - Errors monitored (Sentry or the blueprint's equivalent) and health check active
4. **Deploy to STAGING** (`devops` agent; DR-003: auto-approved with green CI) according to the blueprint's strategy. Smoke test over staging: the critical flows e2e against the real URL.
5. **HUMAN GATE — PRODUCTION (DR-004)**: present the owner with the summary (staging URL so they can test, audit result, production-activation costs if any — DR-005, **including the Vercel Pro warning if the version charges money — DR-035**). Trigger a push to the owner (DR-038). **Wait for their explicit approval. No exceptions.**
6. **Deploy to production** (`devops` agent) after approval + post-deploy verification (smoke test in prod) + rollback plan ready.
7. **Close** (living documentation, DR-018): version tag (semver), **changelog auto-generated from Conventional Commits**, ADRs up to date (propose one if the release included an unrecorded architectural change), README/user docs updated, `docs/status.yaml` → `phase: operation`, the idea's card in the factory → `status: shipped`, portfolio row updated.
8. Report: production URL, version, and a reminder that improvements continue with `/pandacorp:new-version`.

## Rules
- No "deploy and audit later": the audit comes first.
- If the owner doesn't approve, document their reasons in `docs/status.yaml` and generate the adjustment work orders.
