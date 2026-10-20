# External services, accounts and secrets

> Domain: Operation · Severity: **MUST** (scope, account identity, secrets, human gates) / **SHOULD** (provider choices) · Enforcement: architecture/release checklist + catalog validator + gitleaks. Operative form: `plugin/templates/rules/external-services.md`. Decisions: DR-035..038, DR-134.

## 1. Reuse before provisioning

Read `factory/services/catalog.yaml` and the owner's private account registry before selecting a service. The catalog is public know-how, not evidence of an active account or deployed integration. Private account metadata lives by default at `<projectsRoot>/pandacorp-vault/services/accounts.yaml`; project associations live at `<project>/.pandacorp/accounts/services.yaml`. Mission Control derives global/project Accounts views from these records. Never store passwords, token values, recovery codes or OAuth secrets there. `backup-pandacorp-state.sh` snapshots project account associations and only vault `services/accounts.yaml` additively with private permissions, not adjacent credentials. Restore the reviewed dated metadata snapshot to its original path with mode 600; snapshots never become another writable source. This local metadata backup is unrelated to app database/R2 backups. GitHub is standard shared repository infrastructure, not a service-selection/account-catalog item.

For new MVPs, deploy on Vercel under `<resource_slug>.pandatrack.app`, unless the owner chooses otherwise. Use the project's exact lowercase hyphenated `resource_slug` (for example `funko-tracker`), without adding a `pandacorp-` prefix. Keep existing resource names and integrations; adoption does not authorize migration or cloud changes.

## 2. Account and environment model

Reuse the authorized account and separate applications with provider-native resources and least-privilege credentials. Shared billing/quotas are NOT independent per-app allowances, and native resource boundaries do not prove equivalent security isolation across providers.

| Service | Reuse and resource convention |
|---|---|
| Neon | One project/application named exactly `resource_slug`; dev/prod branches with separate roles/URLs. Project name and SQL database name are distinct: do not rename an existing SQL database. `DATABASE_URL` pooled; `DATABASE_URL_UNPOOLED` direct when required by the framework/migrations. |
| Cloudflare R2/DNS | Shared authorized account and existing root zone. Only if files are needed: private `<slug>-dev` and `<slug>-prod` buckets. Real R2 in local dev and production, same adapter/object scheme, different config and scoped credentials. Example `funko-tracker-dev` / `funko-tracker-prod`, variable `R2_BUCKET_PRIVATE`. No routine staging bucket. CORS/lifecycle follow each environment's origins. No custom database backups to R2 in MVP/v1 (DR-012). |
| Google Cloud OAuth | Default shared PandaTrack project, client per application; same client ID/secret across approved dev/staging/prod callback origins for that app. This is an explicit shared trust boundary, not database isolation. Ask for an app outside that context or a genuine security/provider constraint. No staging environment created by default. |
| Namecheap | Same authorized registrar account for current/new root domains. New MVP subdomains do not require domain purchases. DNS remains Cloudflare. |
| Vercel | Shared authorized account/team, project named `resource_slug`; environment-scoped variables. Owner decides plans/payment. Preserve commercial-use warning under DR-035; reverify current terms before release. |
| Resend | Reuse verified shared `pandatrack.app` domain; restricted sending key per app/environment when supported. `hello@pandatrack.app` sender with app display name, app-prefixed subject and contextual Reply-To. No new domain per app by default. |
| ImprovMX | Shared `hello@pandatrack.app` inbox/forwarding. `hello+<slug>@pandatrack.app` can carry context if the configured wildcard/plus delivery is verified. Mail sent directly to generic hello without subject/context cannot reliably identify an app. Explicit aliases only for a real routing need. |
| Modal | Optional job compute, selected for Funko Tracker exports after isolated POC. On-demand, scale to zero, no warm fleet; stop new exports on free-credit exhaustion. No card, paid upgrade, higher limit or paid fallback without explicit approval. Verify actual workspace credits/limits rather than assume public pricing applies. |

Kit is **off by default**: ask whether the owner wants a mailing list, then resolve now/deferred/excluded. PostHog, Sentry, multilingual i18n and SEO retain separate explicit architecture decisions (DR-131); internal projects are asked too. Deferred/excluded services receive no SDK, stub, credentials, required env validation, gates or work orders. Polar remains a payments policy candidate for the first paid app, not a default MVP resource. Cloudinary is not selected for new MVP storage. Document existing integrations without removing/migrating them.

If quotas are dominated by one application, propose isolating that consumer. If many small consumers exhaust a shared allowance, compare lawful capacity/new shared-account options. Check the provider's policy and obtain owner approval before account creation or spending. Never proliferate accounts/organizations to evade fees, including PostHog organizations. Record dated plan/usage/limits; unknown means pending, not invented capacity.

## 3. Proportional preparation and evidence

Architecture inventories account/resource access before the decision round, then **fills every obtainable approved environment value after the decisions and consumer contract are final**. A variable map alone is not delivery. No speculative resources, credential issuance or secret generation at preflight. Materialization uses current authorization and access; missing permission stays actionable pending, not invented readiness. Prefer provider API/CLI for documented operations, browser when necessary; a browser login is not an API token, an installed CLI is not authorized access, and a valid runtime key is not a provisioning key. Verify expected identity, organization and operation-specific scope before acting. Approval of this standard does not authorize provisioning.

For each selected service, record provider ID, private account reference, resource IDs, environment, purpose and evidence date. Reconcile stored IDs and lookup before create; persist returned IDs before retries, and leave ambiguous partial creation pending instead of creating duplicates. Resume from recorded state. Existing resources are never renamed or deleted for uniformity.

Track readiness independently: `detected` (integration found), `researched` (dated official recipe), `account_verified` (identity/access checked), `recipe_tested` (specific operation exercised with evidence), `reusable` (tested recipe and valid inputs for reuse). These are independent evidence dimensions, not a ladder inferred from one browser session. A researched recipe is not tested automation.

Maintain the value-free variable contract in architecture: name, purpose, origin, environment, exact web/worker/migration/local/CI destination, installed or concrete current-version WO consumer, required-now flag, secret-store reference and per-destination status (`pending`, `generated`, `configured`, `verified`, `not_applicable`). A planned consumer can have prepared values but never runtime verification. Obtain provider values through authorized accounts/resources; generate app secrets only for concrete selected consumers (cryptographic randomness and consumer-specific format, independent per purpose/environment). Better Auth, analytics salt, internal revalidation, rate-limit HMAC and signing keys are examples, never a universal checklist. Preserve existing values and rerun idempotently; conflicts are pending, not automatic rotation. Google OAuth’s shared per-app client is the explicit dev/prod exception, not a general secret-sharing rule. Provider administration credentials stay in the machine store, never the app.

Use exactly three root dotenv files: tracked placeholder-only `.env.example`, protected `.env.local` for development and `.env.production` for production handoff. Group by service within labelled destination blocks, with app-generated secrets identified; local-only tooling is last in `.env.local`/`.env.example` and absent from `.env.production`. Only concrete approved production consumers get entries there. Keep different environment/privilege credentials separate using storage aliases and explicit destination selection/export, never extra per-worker/migration/tooling dotenv files or whole-bundle runtime injection. Runtime exports translate aliases to actual consumer names and exclude bootstrap/admin/other-destination values. Check real framework precedence and isolation using synthetic fixtures; a missing selector/build binding stays pending. Existing layouts are consolidated only after inventory, conflict resolution and in-memory value-preservation checks; do not bulk-rewrite existing projects on upgrade. The two private files are gitignored, untracked, mode 600, with no unsafe symlink/hardlink writes or secret output. Use private temporary storage and atomic, single-writer updates preserving original values and refusing concurrent changes. Main-checkout delivery is explicit: ignored worktree files do not merge and production secrets never travel through bootstrap. The private Spanish report `.pandacorp/comms/entrega-entornos.md` (gitignored, mode 600) records per-variable/destination status, value-free checks, evidence and exact pending actor/action. Canonical procedure: architecture `references/environment-delivery.md` (step 9b3). Prepared inputs do not certify host configuration, runtime verification or production readiness.

For approved migration credentials, distinguish **where the command runs** from **which database it changes**. In `.env.local` and `.env.example`, put the migration subsection below the final local/operator-only separator. In `.env.production`, keep a separate production-migration operator subsection. Comments must name local execution from the owner's Mac, the development/production DB target, the actual migration CLI that reads the value, and that it is not uploaded to Vercel/Modal runtime. A connection to production remains a necessary production-target input even when used locally; do not confuse it with local-only tools/fixtures or delete it for not being deployed. No consumer means no speculative migration variable. Target selection and production gates remain explicit; preparation never runs migrations. Detailed layout: architecture `references/environment-delivery.md#migration-credentials-execution-location-versus-database-target`.


A new provider discovered during implementation returns to the minimal architecture decision: approve current scope, add a public recipe and private/project references, then continue. A dependency must not silently expand infrastructure. Recipe documentation records purpose, account separation, environments, access URL, API/CLI/browser route, steps, quotas with source/date and honest readiness; never hardcode personal identities in committed know-how.

## 4. Secrets and credentials

Two separate planes:

- **Runtime/handoff** → each project's protected gitignored `.env.local` (development) and `.env.production` (production handoff), with service/destination sections and explicit per-process exports; never load/upload the full combined bundle. The third root file, tracked `.env.example`, documents names/destinations without values. Check framework precedence and consolidate legacy layouts with preservation checks (constitution §12, `web-security.md`).
- **Machine store** (what the agent reads without the owner present) → **SOPS + age**: encrypted file **outside any repo** (e.g. `~/.config/pandacorp/secrets/`), with the `age` private key in the **macOS Keychain**. SOPS encrypts only the *values* (the structure stays readable). It holds: providers' API tokens (for provisioning), credentials generated per app, and —as a fallback— dashboard logins without an API.
- **LastPass = the owner's personal stuff only**, separate from the machine store. Recommended pattern: interactive human manager ≠ non-interactive machine store. Valid alternatives to the store: Infisical (open-source, with auditing), Bitwarden Secrets Manager, 1Password Service Accounts.
- **Threat-model honesty:** encryption at rest protects against leakage (git/backup/stolen disk), **NOT against local compromise** — because the key must be within the agent's reach. It is the trade-off inherent to autonomy. Mitigations: tokens with **least privilege** (scope per project, not account admin), store separate from personal stuff, and the destructive gates (DR-004/005/007/008) still require the owner even though the agent operates unattended.

## 5. Payments

Polar remains the preferred Merchant of Record candidate under DR-035, subject to current payout/fee verification when the first paid application is approved. Do not create payment accounts, products, keys or SDKs for an unpaid MVP. Preserve the explicitly approved product's integration; do not migrate it from this catalog.

## 6. Hosting and gates

All new web projects deploy on Vercel by default. At PRD, architecture and release, warn about applicable commercial-use terms and costs; the owner decides how to pay (DR-035). No subscriptions, cards, purchases, scope grants, DNS mutations, external messages, production deployments or destructive actions are authorized merely by choosing a provider. Retain the applicable human gates. Notify through runtime-native channels when available; otherwise actionable chat plus pending file, without claiming a phone notification was delivered.

## 7. Safe operations

Preparation produces reviewable inputs, not speculative infrastructure management. Teardown requires an explicit owner gate and an inventory of owned resources/dependents. Never delete a shared domain, Google project, inbox, account or key used by another application. Revoke/delete only the selected app's owned resources after approved retention/export steps.

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
- `apps/<slug>.sops.yaml`: app credentials separated by environment and destination, corresponding to its private delivery (`DATABASE_URL`, `ASSETS_STORAGE_*`, `RESEND_API_KEY`, `POLAR_*`…).
- Fallback: provider dashboard logins without an API.

**Security and backup:**
- Tokens scoped per project; rotate if leaked; never to the repo (not even the encrypted file, by convention).
- **Backup of the age private key = critical**: if lost, the store is unrecoverable. Back it up separately (the only acceptable exception: an entry in the owner's personal LastPass, or an offline copy). The public one can go in clear.

## How it is verified

- `node plugin/scripts/validate-service-catalog.mjs` validates the public provider contract, IDs, dated sources, automation routes and secret-free structure; `node plugin/scripts/test-service-catalog.mjs` proves malformed inputs fail.
- Architecture step 9b3 and independent review manually check the private report: approved contract/consumer coverage, existing-value preservation, dev/prod separation, untracked/ignored regular mode-600 files, correct targets, exactly three root dotenv files, service/destination grouping, local-only blocks last and absent in production, correct alias exports/no cross-destination or development fallback (synthetic fixtures), no secret output and actionable pending items. This is a manual checklist, not an installed automatic secret-file validator. Architecture checklist also verifies account lookup, scope decisions, resource naming, variable destinations, dated quota evidence and pending steps. Release rechecks only selected services and actual environment readiness. These are manual checks, not a cloud connectivity certificate.
- Gitleaks checks repository secret leakage; it does not certify private account metadata or provider permissions.
- `bash factory/standards/check-standards.sh` validates standard registry and operative-form coverage.

## Why

Reuse identity and billing while isolating resources, keep MVP scope explicit, and distinguish documentation from working automation. A dated honest pending state is safer and cheaper than duplicate accounts, unexpected charges or invented readiness.
