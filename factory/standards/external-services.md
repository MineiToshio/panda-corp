# External services, accounts and secrets

> Domain: Operation · Severity: **MUST** (account model, secrets, ToS rule, human gates) / **SHOULD** (service choices) · Enforcement: checklist (provisioning playbook) + human gate (DR-004/005/007/008/035/038) + gitleaks. Playbook-style standard — procedural body. See DR-035..DR-038.

How the factory manages external SaaS services (storage, DB, email, payments, analytics), the **account model**, **secrets** and **provisioning**. Complements `stack.md` (which services) and `infra.md` (local dev). Decisions: DR-035..DR-038. Base stack validated in production by **PandaTrack**.

## 1. Standard service stack (proven)

| Category | Standard service | Account model | Per-app separation |
|---|---|---|---|
| Hosting / deploy | **Vercel** (1 team) | 1 team → 1 project/app | Project + env vars |
| Postgres DB | **Neon** (Prisma + `adapter-pg`) | 1 account → 1 project/app (up to 100 free) | Isolated physical DB |
| Auth | **Better Auth** self-hosted (+ Google OAuth) | in the app's Neon DB | Tables in its DB + 1 OAuth client/app |
| File/photo storage | **Cloudflare R2** (S3 SDK) | 1 account → 1 bucket/app | Bucket + token scoped to the bucket |
| Transactional email | **Resend** | 1 account → 1 domain/app | Verified domain + API key |
| Marketing email / waitlist | **Kit** (ConvertKit) | 1 account → tags/forms per app | Tag/form per app |
| Waitlist capture | **Google Apps Script + Sheet** | 1 Google account → 1 sheet/app | Sheet per app |
| Errors | **Sentry** | 1 org → 1 project/app | Sentry project |
| Product analytics | **PostHog Cloud** | 1 **organization** per app | Each free org: 1M events/month + 1 project |
| Payments | **Polar** (Merchant of Record) | 1 account → 1 product/app | Product/organization per app |

This is the proven default. The `architect` may deviate with a per-project ADR (DR-030), but the state categories (DB, storage, email, payments) are kept unless there's a strong reason.

## 2. Account model: the principle

- Separate **account** (billing/identity) from **isolation** (the provider's primitive + scoped credential). Isolation does NOT come from having separate accounts: it comes from a Neon project (= isolated physical DB), an R2 bucket, a Resend domain, a PostHog org, a Polar product, each with its own credential.
- **Default: ONE shared account/org per service, separating each app by its native primitive.** One account with N isolated projects gives the same isolation as N accounts, without the operational nightmare — and it is enough for real production with personal data (GDPR).
- **"Free org/project YES, puppet account NO" rule:** using the separation the provider offers (PostHog orgs, Neon projects) is legitimate. Creating multiple accounts with `+alias` to dodge a free-tier cap (e.g. Supabase = 2 projects) **violates the ToS** and risks bans that take down live apps. Test: *"am I using a feature they offer, or evading a charge they set?"* That is why Neon (100 projects/account) is chosen over Supabase for the multi-app model.
- **When to isolate in its own account** (not just a project): it is a **success milestone**, not the default — (a) isolate billing (the app makes money / is going to be sold), (b) blast radius (too important to share fate with the others), or (c) a hard limit that can't be lifted by paying. Until then it stays in the shared account. The migration is cheap because the primitive is already a self-contained silo (a Neon project, an R2 bucket can be picked up and moved).
- **Scaling (growing) ≠ migrating:** each app crosses from free→paid **in its own primitive, in place**, without touching the others (scaling up the Neon project's compute, paying R2 storage above 10 GB, a higher Resend plan, a PostHog org crossing 1M events). Nothing is redone.

## 3. Provisioning: API-first

- By default, create/destroy resources via **API/CLI**, not by clicking dashboards. Almost the entire stack supports it: Neon (API+CLI), Cloudflare R2 (API+Wrangler), Vercel (API+CLI), Resend (API; automatic DNS if the domain lives on Cloudflare), Polar (API), Sentry (API), PostHog (API). Headless = no CAPTCHA/2FA, resumable, autonomous. **That** is what enables "leaving it running".
- **Browser fallback** (Claude-in-Chrome) only for the rare provider without an API: the agent **verifies the active account** (screenshot of the logged-in email) against the one expected for the project BEFORE acting, so it doesn't create resources in the wrong account.
- **Unavoidable (and desired) human gates**: new account signup (CAPTCHA/email verification), entering a card (= DR-005), 2FA in dashboards. At those points the agent **notifies the owner (DR-038) and stops**. API tokens bypass login+2FA entirely; where there is no API, the human touch is accepted (the TOTP seed is not stored — it would degrade 2FA).

## 4. Secrets and credentials

Two separate planes:

- **Runtime** → each project's `.env` (gitignored). `.env.example` documents the variables without values (constitution §12, `web-security.md`).
- **Machine store** (what the agent reads without the owner present) → **SOPS + age**: encrypted file **outside any repo** (e.g. `~/.config/pandacorp/secrets/`), with the `age` private key in the **macOS Keychain**. SOPS encrypts only the *values* (the structure stays readable). It holds: providers' API tokens (for provisioning), credentials generated per app, and —as a fallback— dashboard logins without an API.
- **LastPass = the owner's personal stuff only**, separate from the machine store. Recommended pattern: interactive human manager ≠ non-interactive machine store. Valid alternatives to the store: Infisical (open-source, with auditing), Bitwarden Secrets Manager, 1Password Service Accounts.
- **Threat-model honesty:** encryption at rest protects against leakage (git/backup/stolen disk), **NOT against local compromise** — because the key must be within the agent's reach. It is the trade-off inherent to autonomy. Mitigations: tokens with **least privilege** (scope per project, not account admin), store separate from personal stuff, and the destructive gates (DR-004/005/007/008) still require the owner even though the agent operates unattended.

## 5. Payments — Polar (Merchant of Record)

- **Why MoR:** the owner is in **Peru**, where Stripe direct does not operate (it would require a U.S. LLC). A Merchant of Record is the **legal seller**: it charges globally, handles VAT/taxes and compliance, and **pays the owner in Peru**.
- **Standard: Polar** — Peru supported for payout (via Stripe Connect Express), fees ~4% + $0.40, developer-focused, multi-product. Backup: Lemon Squeezy (pays via PayPal; uncertain roadmap after the Stripe acquisition).
- **Account model:** 1 Polar account → **1 product/organization per app**.
- **Integration:** Polar does not replace Better Auth (identity). The charge is a Polar checkout → **webhook** → the app's Neon DB marks the user as paid. `POLAR_*` variables in `.env`.
- **"Does v1 include payments?"** is decided explicitly in the PRD (see §6 and DR-035).

## 6. Vercel: commercial use = Pro (warning, NEVER blocking)

- Hobby (free) is **non-commercial**: any charge, ad or **donation** counts as commercial. A suspension is of the **WHOLE account** (all the apps inside), with no guaranteed notice.
- **Pro:** $20/month per **seat** (not per project), covers the team's unlimited projects + $20 of included usage credit. **One seat = the whole factory.**
- **Rule (DR-035): do NOT block work over this.** The factory only **WARNS** when a version is going to charge money, at 3 moments: when defining the PRD, in the blueprint (hosting plan) and at release (before the deploy). The owner decides *continue or stop*. It is not a gate.
- Structure: **a single Pro team** for all shipped apps; the day an app turns on payments it goes to the Pro team (don't wait for Vercel's email, because the ban is of the whole account).

## 7. Owner notification on gates (DR-038)

- At **ANY** point that requires a decision/action from the owner (gates DR-004/005/007/008/035, pending items of the `decide` skill, or signup/2FA/payment during provisioning), the agent fires a **push notification**. It reaches the **phone** if Remote Control / the Claude app is connected to the session (already configured on the owner's machine). A one-line, actionable message: *"PandaTrack: enter card in Polar to continue"*.
- **Mission Control** is the "at the desk" view (log of pending items in `.pandacorp/status.yaml`); the **push** is the "I'm away" view. Mission Control is not connected to the phone — the native push covers it.

## 8. Playbook — bringing a project up and down

Naming convention across all services: **`pandacorp-<slug>`**. Everything via API where it exists; what doesn't, browser with account verification + push on gates.

**SETUP:**
1. **Neon**: create project → connection string → Better Auth migrations.
2. **R2** (if it uses files/photos): bucket + token scoped to the bucket.
3. **Vercel**: project in the team. Hobby if pre-launch without monetizing; **Pro** team when monetizing (DR-035).
4. **Resend** (if it sends email): verified domain.
5. **Kit** (if it captures an audience): tag/form per app.
6. **Polar** (if it charges): product.
7. **Sentry**: project. **PostHog**: organization.
8. **Secrets**: tokens and credentials to the SOPS+age store; the project's `.env` wired from there.

**TEARDOWN** (each app is a silo → deleting one does NOT touch the others):
1. Export if keeping (Neon pg_dump, copy of the R2 bucket).
2. Delete the Neon project (DB + Better Auth data = real GDPR deletion).
3. Delete the R2 bucket + revoke its token.
4. Delete the Vercel project + domains.
5. Remove the domain in Resend, the organization in PostHog, the project in Sentry, the product in Polar.
6. Delete the secrets-store entries.

> Deleting cloud resources = **DR-007** (human gate + push DR-038).

## 9. Operational setup of the SOPS+age store

**Once only** (owner's machine):
1. `brew install sops age`.
2. Generate the key: `age-keygen -o ~/.config/pandacorp/age/keys.txt` → produces a **public** key (encrypts) and a **private** one (decrypts). `chmod 600` on the file.
3. Tell SOPS where the key is: `export SOPS_AGE_KEY_FILE=~/.config/pandacorp/age/keys.txt` (in the owner's shell/launchd), or store the private one in the **macOS Keychain** and export it to `SOPS_AGE_KEY` at session start.
4. Create `~/.config/pandacorp/.sops.yaml` with `creation_rules` that encrypt all of the store's `*.sops.yaml` with the age public key.
5. Layout (OUTSIDE any repo): `~/.config/pandacorp/secrets/providers.sops.yaml` (providers' API tokens) + `~/.config/pandacorp/secrets/apps/<slug>.sops.yaml` (per-app credentials).

**Use by the agent** (non-interactive, with the Mac's session open):
- Read: `sops -d <file>.sops.yaml`. Inject into a process: `sops exec-env <file>.sops.yaml '<command>'`. Edit: `sops <file>.sops.yaml` (opens in clear, re-encrypts on save).

**What it holds:**
- `providers.sops.yaml`: API tokens (least privilege) for Neon, Cloudflare, Vercel, Resend, Polar, Sentry, PostHog + base OAuth credentials. This is what enables headless provisioning (§3).
- `apps/<slug>.sops.yaml`: mirror of the app's `.env` (`DATABASE_URL`, `ASSETS_STORAGE_*`, `RESEND_API_KEY`, `POLAR_*`…).
- Fallback: provider dashboard logins without an API.

**Security and backup:**
- Tokens scoped per project; rotate if leaked; never to the repo (not even the encrypted file, by convention).
- **Backup of the age private key = critical**: if lost, the store is unrecoverable. Back it up separately (the only acceptable exception: an entry in the owner's personal LastPass, or an offline copy). The public one can go in clear.

## 10. Foundations (verified facts that back these decisions)

Verified as of **2026-06**; free tiers change — re-verify before treating them as hard numbers.

- **Neon** Free: up to **100 projects/account**, each project = isolated DB. That is why it is the multi-app standard (vs **Supabase** Free = 2 active projects/org, which would force multi-account).
- **Cloudflare R2**: 10 GB free + **free egress**; API tokens **scoped to one bucket**.
- **Vercel**: Pro = **USD 20/seat** (not per project), unlimited projects + USD 20 of credit; Hobby = **non-commercial**, and the suspension is of the **WHOLE account with no guaranteed notice**.
- **PostHog**: Free = **1M events/month + 1 project per organization**; billing is **per organization** → several orgs (one login) = several free tiers. That is why "1 org per app" instead of paying for extra projects.
- **Multi-account with `+alias`** to dodge free-tier caps = **violates the ToS** (Vercel, Supabase) → forbidden (≠ using orgs/projects that the provider does offer as a legitimate feature).
- **Payments from Peru**: Stripe direct does not operate in Peru (it would require a U.S. LLC) → **Merchant of Record**. **Polar** supports payout to Peru (Stripe Connect Express), fees ~4% + USD 0.40; backup Lemon Squeezy.

## How it is verified
- **Secrets never in the repo**: gitleaks (pre-commit + push protection); the SOPS store lives outside any repo by construction (§4).
- **Provisioning playbook followed / naming convention**: checklist in the provisioning steps (§8) — review-only.
- **Human gates (card, signup/2FA, deletion, production)**: deny rules in `.claude/settings.json` + push notification (DR-038) — hard gates.
- **Vercel commercial-use warning**: fired at PRD/blueprint/release checkpoints (skill checklists) — warn, never blocking (DR-035).
- **Free-tier ceilings**: monthly cost check by `/pandacorp:review-launch` (script + owner decision, DR-005).

## Why
One shared account per service with the provider's native isolation primitive gives real per-app silos without multi-account ToS risk; API-first provisioning is what makes unattended operation possible; and the SOPS+age machine store is the honest trade-off that lets the agent operate without the owner present while keeping secrets out of git and blast radius scoped.

---

Cross-refs: `stack.md` (which services), `infra.md` (local dev/Docker/ports), `web-security.md` (secrets), `privacy.md` (PII/GDPR), `observability.md` (Sentry/logs). Decisions: DR-035 (Vercel/payments), DR-036 (standard services + account model), DR-037 (secrets + provisioning), DR-038 (notification on gates).
