---
name: release
description: Performs and executes the release of a Pandacorp project — deploys/launches it (internal OR external), with the deploy strategy, the pre-release checklist, the launch plan and the human gate for an external production deploy. Sets phase release + the idea to launched. The security/quality/metrics hardening (audit) is NOT here anymore — it is the last step of construction (/pandacorp:implement). Use inside the project once construction is complete (phase release).
---

# /pandacorp:release

**Release = the product is LAUNCHED / live** — internal or external (DR-085). It is no longer "audit + deploy" (the hardening moved to construction; see the callout below). This skill performs the **deploy/launch** (internal or external) + the launch plan, sets `phase: release` and the idea's card → `status: shipped`. From here the product is iterated by filing changes through the single front door (`/pandacorp:change`) and its real results are read (`/pandacorp:review-launch`). Runs IN the project.

> **Internal vs external — same release, tracked by `deploy_target` (DR-085).** Both are a real release of a software product; the only difference is where it runs, recorded as a **status field `deploy_target: internal | external`** in `.pandacorp/status.yaml` (NOT a phase):
> - **internal** — an in-house tool used as-is, with no external host (e.g. Mission Control runs on `127.0.0.1`). "Launch" = it runs locally for the owner; no external deploy, no production gate, no landing/GTM.
> - **external** — deployed to an external server (Vercel / AWS / …) for real users. "Launch" = the production deploy + the launch plan, behind the human production gate (DR-004).
> Determine `deploy_target` from the idea's `return_type` + the architecture: `return_type: personal`/an in-house tool ⇒ `internal`; `monetary`/`mixed`/`opportunity` ⇒ `external`. If unclear, ask the owner (in Spanish).

> **Preflight (DR-045) — is this a Pandacorp project?** This skill mutates the project, so first confirm the Pandacorp marker: `.pandacorp/status.yaml` exists. If it's missing, STOP and tell the owner (in Spanish) that this folder isn't a factory project yet — `/pandacorp:adopt` brings an existing project in, `/pandacorp:spec` creates a new one. Then, if `overlay_version` in `.pandacorp/status.yaml` is behind the plugin's `OVERLAY_VERSION`, run `/pandacorp:upgrade` first (silent for compatible bumps, DR-048) so this skill runs against the current structure. Don't proceed or invent docs over a missing structure.

> **Where the audit went (DR-085).** The security audit, quality gates, telemetry/metrics verification and the rest of the hardening that this skill used to perform are now the **final hardening step of `/pandacorp:implement`** (construction). When this skill runs, construction already left the project audited, green and instrumented (`phase: release` was set by the build's close-out). If construction was somehow skipped or the project is brownfield with no hardening done, the security/quality/metrics work belongs in `/pandacorp:implement`, not here — this skill assumes a hardened build and only ships it.

## Steps

1. **Confirm the build is release-ready (no re-audit here, DR-085).** Verify `.pandacorp/status.yaml` is at `phase: release` and `verify.sh` is green. If the project never went through construction (e.g. a brownfield adopt), STOP and route the hardening to `/pandacorp:implement` — do not re-run the security/quality audit here.
2. **Launch plan + landing copy (external launches; DR-042, return-aware):**
   - `copywriter`: for **external** launches with `return_type` monetary/mixed/opportunity, write the MVP landing copy (headline, value proposition, benefits, CTA, FAQ) with a readable `title`/meta description oriented to search intent (collaborates with `factory/standards/seo-i18n.md`; no claim without backing) and `docs/launch-plan.md` — the primary acquisition channel + 3-5 draft posts/threads for the owner to publish (reusing the communities discovery found), sent under the external-comms gate (DR-008). Deployed ≠ launched: an external app with no users earns nothing. For **internal** / `personal` releases, skip — the owner is the user, there is no landing or GTM.
3. **Pre-release checklist** (everything verified by commands, not by memory):
   - Full suite + e2e green; lint and typecheck clean
   - Environment variables documented in `.env.example`; secrets ONLY in the deploy environment
   - DB migrations tested (up and down) in a clean environment
   - README with what it is, how to run locally and (for external) how to deploy — this should already be populated by `spec`/`architecture` (DR-112/DOC-3); this is the final human-facing confirmation, not the first pass
   - Errors monitored (Sentry or the blueprint's equivalent) and health check active (instrumented in construction)
4. **Deploy / launch — branch on `deploy_target`:**
   - **internal** → there is no external host: confirm the app runs locally for the owner (the dev/preview server on its assigned port — `127.0.0.1`), smoke the critical flows against the local URL, and record `deploy_target: internal`. No staging, no production gate. **If the project gets an always-on local deployment** (a built, served snapshot kept running for the owner), it MUST follow **DR-089**: an isolated worktree under `/Users/Shared/local-deployments/<project>/` (outside `Proyectos/`), served always-on via launchd on the reserved port (DR-089 — full spec in `factory/standards/infra.md`, Local deployments).
   - **external** → **deploy to STAGING** (`devops` agent; DR-003: auto-approved with green CI) per the deploy strategy in `docs/product/architecture.md` (platform). Smoke test over staging: the critical flows e2e against the real URL.
5. **HUMAN GATE — PRODUCTION (DR-004, EXTERNAL only):** present the owner with the summary (staging URL so they can test, production-activation costs if any — DR-005, **including the Vercel Pro warning if the version charges money — DR-035**). Trigger a push to the owner (DR-038). **Wait for their explicit approval. No exceptions.** (Internal releases skip this gate — there is no external production to activate.)
6. **Deploy to production** (`devops` agent, EXTERNAL only) after approval + post-deploy verification (smoke test in prod) + rollback plan ready.
7. **Close** (living documentation, DR-018): version tag (semver), **changelog auto-generated from Conventional Commits**, ADRs up to date (propose one if the release included an unrecorded architectural change), README/user docs updated, `.pandacorp/status.yaml` → `phase: release` + `deploy_target: internal | external`, the idea's card in the factory → `status: shipped`, portfolio row updated. **Reaching `phase: release` is what makes the project eligible for `/pandacorp:review-launch`** (the post-launch loop, DR-043).
8. Report (in Spanish): the live URL (production URL for external, the local `127.0.0.1` URL for internal), the version, and that from here the product is iterated by filing changes through the single front door `/pandacorp:change` and its results read with `/pandacorp:review-launch` (for a large next milestone that warrants its own mini-PRD, that route runs `new-version` internally).

## Rules
- **Release means launched, not audited.** The audit/security/quality/metrics is construction's last step (DR-085); this skill assumes a hardened build and ships it. Never defer hardening to here.
- **`release` is the terminal phase (DR-085).** There is no `operation` phase after it — the project is launched and from here it is iterated. Internal and external are the same `release` concept, distinguished only by `deploy_target`.
- For an **external** launch, if the owner doesn't approve production, document their reasons in `.pandacorp/status.yaml` and generate the adjustment work orders (back to construction).
- A change that requires a second build pass loops back to `/pandacorp:implement` (conceptually allowed); the day-to-day is filed through the single front door `/pandacorp:change` (which routes to the `iterate` engine internally).
